import type { GameState } from "../types";
import type { ClientMessage, ServerMessage, TurnInfo } from "./protocol";
import {
  legalMoves,
  chooseRollRecipient,
  tryApplyMoveWithResponse,
  serializeState,
  hashState,
} from "../engine";

export type PendingDie = { value: number; controllerId: string | null };

export type SessionState = {
  game: GameState;
  turn: TurnInfo;

  /**
   * External-dice (Option A): remaining dice that are still resolvable this turn.
   * When present and non-empty, the server must NOT require a new roll.
   */
  pendingDice?: PendingDie[];

  /**
   * Acting player for the last roll (may be teammate under team play distribution).
   * Only this player may submit the next "move".
   */
  actingActorId?: string;

  /**
   * Banked extra dice earned earlier in the Turn (e.g. from rolling 1/6, or optional kill-roll).
   * These dice are owed to the roller and must be rolled only after all pendingDice are resolved.
   */
  bankedDice?: number;

  /**
   * Legacy inbound-only alias for older tests/clients.
   * Transitional rule: accept on input if bankedDice is absent, but never emit.
   */
};

export type HandleResult = {
  nextState: SessionState;
  serverMessage: ServerMessage;
};

function withReqId(msg: ServerMessage, reqId?: string): ServerMessage {
  if (!reqId) return msg;
  return { ...(msg as any), reqId } as any;
}

function mkError(code: any, message: string, reqId?: string): ServerMessage {
  return withReqId({ type: "error", code, message } as any, reqId);
}

function mkStateSync(roomCode: string, s: SessionState, reqId?: string): ServerMessage {
  // TurnInfo is intentionally minimal in protocol.ts; we attach extra fields (pendingDice, bankedDice)
  // as a runtime-compatible extension used by tests and debug UIs.
  const turnForMsg: any = { ...s.turn };
  if (Array.isArray(s.pendingDice)) turnForMsg.pendingDice = s.pendingDice;
  if (typeof (s as any).bankedDice === "number" && (s as any).bankedDice > 0) {
    turnForMsg.bankedDice = (s as any).bankedDice;
  }

  return withReqId(
    {
      type: "stateSync",
      roomCode,
      state: serializeState(s.game),
      stateHash: hashState(s.game),
      turn: turnForMsg,
    } as any,
    reqId
  );
}


function mkLegalMoves(
  roomCode: string,
  actorId: string,
  dice: number[],
  moves: unknown[],
  reqId?: string
): ServerMessage {
  // actorId here is the RECIPIENT who may submit the move.
  // Send both dice (preferred) and die (legacy) for compatibility.
  const die = dice[0];
  return withReqId({ type: "legalMoves", roomCode, actorId, dice, die, moves } as any, reqId);
}

function mkMoveResult(roomCode: string, response: any, reqId?: string): ServerMessage {
  return withReqId({ type: "moveResult", roomCode, response } as any, reqId);
}

function getActorOrder(game: any): string[] {
  const playersObj = game?.players;
  if (!playersObj || typeof playersObj !== "object") return [];

  const entries = Object.entries(playersObj) as Array<[string, any]>;
  const withSeat = entries.filter(([, p]) => typeof p?.seat === "number");

  if (withSeat.length === entries.length && entries.length > 0) {
    withSeat.sort((a, b) => (a[1].seat as number) - (b[1].seat as number));
    return withSeat.map(([id]) => id);
  }

  return entries.map(([id]) => id).sort();
}

function computeNextActorId(game: any, current: string): string {
  const order = getActorOrder(game);
  if (order.length === 0) return current;
  const idx = order.indexOf(current);
  if (idx < 0) return order[0];
  return order[(idx + 1) % order.length];
}


function getTeamMembers(game: any, rollerId: string): string[] {
  const teamPlayOn = game?.config?.options?.teamPlay === true;
  if (!teamPlayOn) return [rollerId];

  const players = game?.players ?? {};
  const rollerTeamId = players?.[rollerId]?.teamId;
  if (!rollerTeamId) return [rollerId];

  return Object.keys(players).filter((pid) => players?.[pid]?.teamId === rollerTeamId);
}

function isSameTeam(game: any, a: string, b: string): boolean {
  const players = game?.players ?? {};
  const ta = players?.[a]?.teamId;
  const tb = players?.[b]?.teamId;
  return !!ta && ta === tb;
}

function hasAnyLegalMoveForTeam(game: any, rollerId: string, dieValue: number): boolean {
  const members = getTeamMembers(game, rollerId);
  for (const pid of members) {
    const lm = legalMoves(game as any, pid as any, [dieValue] as any) as any[];
    if (Array.isArray(lm) && lm.length > 0) return true;
  }
  return false;
}

function hasLegalMoveForPlayer(game: any, playerId: string, dieValue: number): boolean {
  const lm = legalMoves(game as any, playerId as any, [dieValue] as any) as any[];
  return Array.isArray(lm) && lm.length > 0;
}

/**
 * Normalize a client-provided roll/getLegalMoves/move payload to a dice array.
 * - Preferred: msg.dice
 * - Legacy: msg.die
 */
function normalizeDice(msg: any): number[] | null {
  if (Array.isArray(msg?.dice) && msg.dice.length > 0) {
    const ok = msg.dice.every((n: any) => Number.isInteger(n) && n >= 1 && n <= 6);
    return ok ? msg.dice.slice() : null;
  }
  if (Number.isInteger(msg?.die) && msg.die >= 1 && msg.die <= 6) {
    return [msg.die];
  }
  return null;
}


/**
 * Multiset subtraction: remove each value in `used` from `pool` (once per occurrence).
 * Returns { ok, remaining }.
 */
function subtractDice(pool: number[], used: number[]): { ok: boolean; remaining: number[] } {
  const remaining = pool.slice();
  for (const u of used) {
    const idx = remaining.indexOf(u);
    if (idx < 0) return { ok: false, remaining: pool.slice() };
    remaining.splice(idx, 1);
  }
  return { ok: true, remaining };
}

function subtractPendingDice(
  pool: PendingDie[],
  used: number[]
): { ok: boolean; remaining: PendingDie[] } {
  const remaining = pool.slice();
  for (const u of used) {
    const idx = remaining.findIndex((pd) => pd.value === u);
    if (idx < 0) return { ok: false, remaining: pool.slice() };
    remaining.splice(idx, 1);
  }
  return { ok: true, remaining };
}

function setPendingControllers(pool: PendingDie[], controllerId: string | null): PendingDie[] {
  return pool.map((pd) => ({ ...pd, controllerId }));
}



// overloads
export function handleClientMessage(state: SessionState, msg: ClientMessage): HandleResult;
export function handleClientMessage(
  roomCode: string,
  state: SessionState,
  msg: ClientMessage
): HandleResult;

// implementation
export function handleClientMessage(
  a: string | SessionState,
  b: SessionState | ClientMessage,
  c?: ClientMessage
): HandleResult {
  const hasRoomArg = typeof a === "string";
  const state = (hasRoomArg ? b : a) as SessionState;
  const msg = (hasRoomArg ? c : b) as ClientMessage | undefined;
  const reqId = (msg as any)?.reqId as string | undefined;
  const roomCode = hasRoomArg ? (a as string) : "__local__";

  if (!msg || typeof (msg as any).type !== "string") {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid client message.", reqId),
    };
  }


  // Guard: gameplay is forbidden once the game is ended (Rematch flow).
  if (state.game.phase === "ended") {
    if (msg.type === "roll" || msg.type === "getLegalMoves" || msg.type === "move" || msg.type === "assignPendingDie" || msg.type === "forfeitPendingDie") {
      return {
        nextState: state,
        serverMessage: mkError("ENDED_GAME", "Game is over. Waiting for rematch/new game.", reqId),
      };
    }
  }

  switch (msg.type) {
    
case "roll": {
  // Only the turn owner can ROLL.
  if ((msg as any).actorId !== state.turn.nextActorId) {
    return {
      nextState: state,
      serverMessage: mkError(
        "NOT_YOUR_TURN",
        `Not your turn. Expected actorId=${state.turn.nextActorId}.`,
        reqId
      ),
    };
  }

  // If there are still pending dice to resolve, a new roll is not allowed.
  if (Array.isArray(state.pendingDice) && state.pendingDice.length > 0) {
    return {
      nextState: state,
      serverMessage: mkError(
        "BAD_TURN_STATE",
        "Cannot roll while there are pending dice to resolve.",
        reqId
      ),
    };
  }

  const dice = normalizeDice(msg as any);
  if (!dice) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid roll message dice.", reqId),
    };
  }

  // Transitional normalization: canonical bankedDice; accept legacy inbound-only bank.
  const banked0 = Number.isInteger(state.bankedDice) ? (state.bankedDice as number) : 0;

  // v1.7.4 banked cashout: if N banked extra dice exist, the next roll must consist of exactly N dice.
  if (banked0 > 0 && dice.length !== banked0) {
    return {
      nextState: state,
      serverMessage: mkError(
        "BAD_ROLL",
        `When ${banked0} banked extra dice exist, you must roll exactly ${banked0} dice.`,
        reqId
      ),
    };
  }

  const rollerId = String(state.turn.nextActorId);

  // Banked extra dice are consumed on roll (not on move).
  // v1.7.4: a bank cashout roll consumes the entire existing bank, then adds any newly earned extra dice.
  const earnedFromRoll = dice.reduce((acc, v) => acc + (v === 1 || v === 6 ? 1 : 0), 0);
  const bankedAfter = earnedFromRoll;

  const teamPlayOn = state.game?.config?.options?.teamPlay === true;

  // Team-play delegation model:
  // - Pending dice start UNASSIGNED (controllerId=null).
  // - Turn owner assigns each die to a teammate who has at least one legal move for that die.
  // - If the ENTIRE team has no legal moves for ALL rolled dice, the roll auto-passes.
  if (teamPlayOn) {
    const anyTeamMove = dice.some((v) => hasAnyLegalMoveForTeam(state.game as any, rollerId, v));
    if (!anyTeamMove) {
      const nextActorId = bankedAfter > 0 ? rollerId : computeNextActorId(state.game as any, rollerId);
      const nextTurn: TurnInfo = {
        ...state.turn,
        nextActorId,
        awaitingDice: true,
      };

      const nextState: SessionState = {
        ...state,
        turn: nextTurn,
        pendingDice: undefined,
        actingActorId: undefined,
        bankedDice: bankedAfter,
      };

      return {
        nextState,
        serverMessage: mkStateSync(roomCode, nextState, reqId),
      };
    }

    const nextTurn: TurnInfo = { ...state.turn, awaitingDice: false };

    const nextState: SessionState = {
      ...state,
      turn: nextTurn,
      pendingDice: dice.map((v) => ({ value: v, controllerId: null })),
      actingActorId: undefined,
      bankedDice: bankedAfter,
    };

    return {
      nextState,
      serverMessage: mkStateSync(roomCode, nextState, reqId),
    };
  }

  // Non-team play: roller controls the dice immediately (backward compatible behavior).
  const moves = legalMoves(state.game as any, rollerId as any, dice as any) as any[];

  // Auto-pass when no legal moves.
  // Invariant K: the turn must NOT pass while banked extra dice remain.
  if (moves.length === 0) {
    const nextActorId = bankedAfter > 0 ? rollerId : computeNextActorId(state.game as any, rollerId);
    const nextTurn: TurnInfo = {
      ...state.turn,
      nextActorId,
      awaitingDice: true,
    };

    const nextState: SessionState = {
      ...state,
      turn: nextTurn,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: bankedAfter,
    };

    return {
      nextState,
      serverMessage: mkStateSync(roomCode, nextState, reqId),
    };
  }

  const nextTurn: TurnInfo = { ...state.turn, awaitingDice: false };

  const nextState: SessionState = {
    ...state,
    turn: nextTurn,
    pendingDice: dice.map((v) => ({ value: v, controllerId: rollerId })),
    actingActorId: rollerId,
    bankedDice: bankedAfter,
  };

  const turnForMsg: any = { ...nextTurn };
  if (typeof bankedAfter === "number" && bankedAfter > 0) {
    turnForMsg.bankedDice = bankedAfter;
  }

  return {
    nextState,
    serverMessage: ({ ...(mkLegalMoves(roomCode, rollerId, dice, moves, reqId) as any), turn: turnForMsg } as any),
  };
}


case "assignPendingDie": {
  const rollerId = String(state.turn.nextActorId);

  // Only the current turn owner may assign.
  if ((msg as any).actorId !== rollerId) {
    return {
      nextState: state,
      serverMessage: mkError(
        "NOT_YOUR_TURN",
        `Not your turn. Expected actorId=${rollerId}.`,
        reqId
      ),
    };
  }

  const teamPlayOn = state.game?.config?.options?.teamPlay === true;
  if (!teamPlayOn) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "assignPendingDie is only valid in team play.", reqId),
    };
  }

  if (!Array.isArray(state.pendingDice) || state.pendingDice.length === 0) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "No pending dice to assign.", reqId),
    };
  }

  // Delegation is only allowed when the turn owner has finished all pegs.
  const rollerFinished = state.game?.players?.[rollerId]?.hasFinished === true;
  if (!rollerFinished) {
    return {
      nextState: state,
      serverMessage: mkError(
        "BAD_TURN_STATE",
        "assignPendingDie is only valid when the turn owner has finished all pegs.",
        reqId
      ),
    };
  }

  // Sequential delegation: only one delegated die may be active at a time.
  const anyAssigned = state.pendingDice.some((pd) => pd.controllerId != null);
  if (anyAssigned) {
    return {
      nextState: state,
      serverMessage: mkError(
        "BAD_TURN_STATE",
        "A delegated die is already active; resolve it before assigning another.",
        reqId
      ),
    };
  }

  const dieIndex = Number((msg as any).dieIndex);
  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= state.pendingDice.length) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid dieIndex for assignPendingDie.", reqId),
    };
  }

  const controllerId = String((msg as any).controllerId ?? "");
  if (!controllerId) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Missing controllerId for assignPendingDie.", reqId),
    };
  }

  if (!isSameTeam(state.game as any, rollerId, controllerId)) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "controllerId must be on the same team as the turn owner.", reqId),
    };
  }

  const pd = state.pendingDice[dieIndex];
  if (pd.controllerId != null) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "This pending die is already assigned.", reqId),
    };
  }

  // Guardrail: cannot assign a die to a player who has no legal moves for that die.
  if (!hasLegalMoveForPlayer(state.game as any, controllerId, pd.value)) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "Cannot assign: selected player has no legal moves for this die.", reqId),
    };
  }

  const nextPending = state.pendingDice.map((x, i) => (i === dieIndex ? { ...x, controllerId } : x));

  const nextState: SessionState = {
    ...state,
    pendingDice: nextPending,
    actingActorId: undefined,
  };

  return {
    nextState,
    serverMessage: mkStateSync(roomCode, nextState, reqId),
  };
}

    


case "forfeitPendingDie": {
  const actorId = String((msg as any).actorId ?? "");
  if (!actorId) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Missing actorId for forfeitPendingDie.", reqId),
    };
  }

  // Forfeit is a turn-owner-only acknowledgment gate for dead dice.
  if (actorId !== rollerId) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "Only the turn owner may forfeit pending dice.", reqId),
    };
  }

  if (!Array.isArray(state.pendingDice) || state.pendingDice.length === 0) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "No pending dice to forfeit.", reqId),
    };
  }

  const dieIndex = Number((msg as any).dieIndex);
  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= state.pendingDice.length) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid dieIndex for forfeitPendingDie.", reqId),
    };
  }

  const game = state.game as any;
  const teamPlayOn = game?.config?.options?.teamPlay === true;
  const rollerFinished = game?.players?.[rollerId]?.hasFinished === true;

  // In normal play, only the turn owner resolves dice.
  // In team play finisher delegation mode, a die is "live" if ANY teammate (excluding the finished owner) can move it.
  const resolvers =
    teamPlayOn && rollerFinished ? getTeamMembers(game, rollerId).filter((pid) => pid !== rollerId) : [rollerId];

  function dieIsLive(value: number): boolean {
    return (resolvers.length > 0 ? resolvers : [rollerId]).some((pid) =>
      hasLegalMoveForPlayer(game, String(pid), value)
    );
  }

  // Forfeit is only allowed when NO pending die is live (i.e., team is stuck).
  const anyLive = state.pendingDice.some((pd) => dieIsLive(pd.value));
  if (anyLive) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "Cannot forfeit while any pending die has legal moves.", reqId),
    };
  }

  // Fixed order (FIFO / lowest index) when stuck.
  if (dieIndex !== 0) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "Must forfeit pending dice in order (FIFO).", reqId),
    };
  }

  const target = state.pendingDice[dieIndex];
  if (dieIsLive(target.value)) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_TURN_STATE", "Die is not dead and cannot be forfeited.", reqId),
    };
  }

  const nextPending = state.pendingDice.slice();
  nextPending.splice(dieIndex, 1);

  const nextTurn = {
    ...state.turn,
    awaitingDice: nextPending.length === 0,
  } as any;

  const nextState: SessionState = {
    ...(state as any),
    turn: nextTurn,
    pendingDice: nextPending.length > 0 ? nextPending : undefined,
  } as any;

  return {
    nextState,
    serverMessage: mkStateSync(roomCode, nextState, reqId),
  };
}


case "getLegalMoves": {
  const actorId = String((msg as any).actorId ?? "");
  if (!actorId) {
    return { nextState: state, serverMessage: mkError("BAD_MESSAGE", "Missing actorId.", reqId) };
  }

  const dice = normalizeDice(msg as any);
  if (!dice) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid getLegalMoves dice.", reqId),
    };
  }

  // If pending dice exist, ONLY the controller of that specific die may request legal moves for it.
  if (Array.isArray(state.pendingDice) && state.pendingDice.length > 0) {
    if (dice.length !== 1) {
      return {
        nextState: state,
        serverMessage: mkError(
          "BAD_TURN_STATE",
          "When pending dice exist, getLegalMoves must specify exactly one die.",
          reqId
        ),
      };
    }

    const dieValue = dice[0];
    const anyWithValue = state.pendingDice.some((pd) => pd.value === dieValue);
    if (!anyWithValue) {
      return {
        nextState: state,
        serverMessage: mkError("BAD_TURN_STATE", "Requested die is not available in pending dice.", reqId),
      };
    }

    const match = state.pendingDice.find((pd) => pd.value === dieValue && pd.controllerId === actorId);
    if (!match) {
      const unassigned = state.pendingDice.find((pd) => pd.value === dieValue && pd.controllerId == null);
      return {
        nextState: state,
        serverMessage: mkError(
          "BAD_TURN_STATE",
          unassigned
            ? "Requested die is unassigned. The turn owner must assign it first."
            : "You do not control the requested pending die.",
          reqId
        ),
      };
    }

    const moves = legalMoves(state.game as any, actorId as any, [dieValue] as any) as any[];
    return {
      nextState: state,
      serverMessage: mkLegalMoves(roomCode, actorId, [dieValue], moves, reqId),
    };
  }

  // No pending dice: only the current turn owner may request moves.
  if (actorId !== state.turn.nextActorId) {
    return {
      nextState: state,
      serverMessage: mkError(
        "NOT_YOUR_TURN",
        `Not your turn. Expected actorId=${state.turn.nextActorId}.`,
        reqId
      ),
    };
  }

  const moves = legalMoves(state.game as any, actorId as any, dice as any) as any[];
  return {
    nextState: state,
    serverMessage: mkLegalMoves(roomCode, actorId, dice, moves, reqId),
  };
}


case "move": {
  const actorId = String((msg as any).actorId ?? "");
  if (!actorId) {
    return { nextState: state, serverMessage: mkError("BAD_MESSAGE", "Missing actorId.", reqId) };
  }

  const diceUsed = normalizeDice({ dice: (msg as any).dice });
  if (!diceUsed) {
    return {
      nextState: state,
      serverMessage: mkError("BAD_MESSAGE", "Invalid move dice.", reqId),
    };
  }

  const rollerId = String(state.turn.nextActorId);

  // When pendingDice exists, move must spend EXACTLY ONE die and ONLY the controller may spend it.
  let remainingPendingDice: PendingDie[] = [];
  let spentPendingDie: PendingDie | null = null;

  if (Array.isArray(state.pendingDice) && state.pendingDice.length > 0) {
    if (diceUsed.length !== 1) {
      return {
        nextState: state,
        serverMessage: mkError(
          "BAD_TURN_STATE",
          "When pending dice exist, move must specify exactly one die.",
          reqId
        ),
      };
    }

    const dieValue = diceUsed[0];
    const idx = state.pendingDice.findIndex((pd) => pd.value === dieValue && pd.controllerId === actorId);
    if (idx < 0) {
      const anyWithValue = state.pendingDice.some((pd) => pd.value === dieValue);
      const unassigned = state.pendingDice.some((pd) => pd.value === dieValue && pd.controllerId == null);
      return {
        nextState: state,
        serverMessage: mkError(
          "BAD_TURN_STATE",
          !anyWithValue
            ? "Move die is not available in pending dice."
            : unassigned
              ? "Move die is unassigned. The turn owner must assign it first."
              : "You do not control the move die.",
          reqId
        ),
      };
    }

    spentPendingDie = state.pendingDice[idx];
    remainingPendingDice = state.pendingDice.slice();
    remainingPendingDice.splice(idx, 1);
  } else {
    // No pending dice: only the current turn owner may move (legacy behavior).
    if (actorId !== rollerId) {
      return {
        nextState: state,
        serverMessage: mkError(
          "NOT_YOUR_TURN",
          `Not your turn. Expected actorId=${rollerId}.`,
          reqId
        ),
      };
    }
  }

  const response = tryApplyMoveWithResponse(
    state.game as any,
    actorId as any,
    diceUsed as any,
    (msg as any).move
  );

  if (response.ok) {
    const nextGame: any = response.result.nextState as any;
    const engineTurn = (response.result as any).turn ?? state.turn;

    const teamPlayOn = nextGame?.config?.options?.teamPlay === true;
    const killRollOn = nextGame?.config?.options?.killRoll === true;

    // Banked extra dice are earned on ROLL (when dice show 1 or 6), not on MOVE spend.
    // Therefore, the move step must not add to bank based on diceUsed.
    const banked0 = Number.isInteger(state.bankedDice) ? (state.bankedDice as number) : 0;

    // Kill-roll (glossary-aligned): any successful kill/capture banks +1 extra die (once per capturing move).
    const captureCount =
      (((response.result as any)?.replayEntry?.move?.captures?.length as number | undefined) ??
        ((response.result as any)?.move?.captures?.length as number | undefined) ??
        ((response.result as any)?.result?.move?.captures?.length as number | undefined) ??
        ((response as any)?.result?.move?.captures?.length as number | undefined) ??
        0) || 0;

    const killRollEarned = killRollOn && captureCount > 0 ? 1 : 0;
    const banked1 = banked0 + killRollEarned;

    // If there are still pending dice remaining, normalize them:
    // - Preserve per-die controllerId immutably while the controller still has legal moves.
    // - If a controller no longer has legal moves for their die, unassign it (controllerId=null) IF some teammate can use it.
    // - Forfeit a die only when NO ONE on the team has legal moves for that die.
    if (Array.isArray(state.pendingDice) && state.pendingDice.length > 0 && remainingPendingDice.length > 0) {
      const normalized: PendingDie[] = [];
      for (const pd of remainingPendingDice) {
        const anyTeamMove = teamPlayOn ? hasAnyLegalMoveForTeam(nextGame as any, rollerId, pd.value) : hasLegalMoveForPlayer(nextGame as any, rollerId, pd.value);
        if (!anyTeamMove) {
          // forfeit this die
          continue;
        }

        if (teamPlayOn && pd.controllerId != null) {
          const controllerHas = hasLegalMoveForPlayer(nextGame as any, String(pd.controllerId), pd.value);
          if (!controllerHas) {
            // unassign to allow the turn owner to re-delegate to an eligible teammate
            normalized.push({ ...pd, controllerId: null });
            continue;
          }
        }

        normalized.push(pd);
      }

      if (normalized.length > 0) {
        const nextTurn: TurnInfo = {
          ...engineTurn,
          nextActorId: rollerId, // keep control with the roller while resolving dice
          awaitingDice: false,
        };

        const nextState: SessionState = {
          game: nextGame,
          turn: nextTurn,
          pendingDice: normalized,
          actingActorId: undefined,
          bankedDice: banked1,
        };

        (response as any).turn = { ...nextTurn, pendingDice: normalized } as any;
        (response.result as any).turn = (response as any).turn;

        return {
          nextState,
          serverMessage: mkMoveResult(roomCode, response, reqId),
        };
      }

      // All remaining dice were forfeited.
      remainingPendingDice = [];
    }

    // Dice resolution is complete (either no pendingDice existed, or it is now empty).
    // Decide who rolls next:
    let nextActorId = engineTurn.nextActorId;
    if (typeof nextActorId !== "string") nextActorId = rollerId;

    // Team play finisher keeps the turn (continue rolling/distributing).
    const actorFinished = nextGame?.players?.[actorId]?.hasFinished === true;
    if (teamPlayOn && actorFinished) {
      nextActorId = actorId;
    }

    // Apply banked extra-dice rule:
    // If any extra dice are banked, the roller keeps the turn to roll again.
    // (The bank is consumed when the roll is taken.)
    if (banked1 > 0) {
      nextActorId = rollerId;
    } else {
      // No banked extra: if engine suggests same actor, advance to next actor.
      if (nextActorId === rollerId) {
        nextActorId = computeNextActorId(nextGame, rollerId);
      }
    }

    const nextTurn: TurnInfo = {
      ...engineTurn,
      nextActorId,
      awaitingDice: true,
    };

    const nextState: SessionState = {
      game: nextGame,
      turn: nextTurn,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: banked1,
    };

    (response as any).turn = { ...nextTurn, pendingDice: undefined } as any;
    (response.result as any).turn = (response as any).turn;

    return {
      nextState,
      serverMessage: mkMoveResult(roomCode, response, reqId),
    };
  }

  return {
    nextState: state,
    serverMessage: mkMoveResult(roomCode, response, reqId),
  };
}

default:
      return {
        nextState: state,
        serverMessage: mkError("BAD_MESSAGE", "Unhandled message type.", reqId),
      };
  }
}
