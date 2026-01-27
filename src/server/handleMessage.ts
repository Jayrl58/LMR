import type { GameState } from "../types";
import type { ClientMessage, ServerMessage, TurnInfo } from "./protocol";
import {
  legalMoves,
  chooseRollRecipient,
  tryApplyMoveWithResponse,
  serializeState,
  hashState,
} from "../engine";

export type SessionState = {
  game: GameState;
  turn: TurnInfo;

  /**
   * External-dice (Option A): remaining dice that are still resolvable this turn.
   * When present and non-empty, the server must NOT require a new roll.
   */
  pendingDice?: number[];

  /**
   * Acting player for the last roll (may be teammate under team play distribution).
   * Only this player may submit the next "move".
   */
  actingActorId?: string;

  /**
   * Banked extra rolls earned from earlier dice (1 or 6),
   * to be used AFTER all pendingDice are resolved.
   *
   * Rule intent: if you resolve a 6 first while another die remains, you don't
   * get to roll immediately; the extra roll is banked until the pending dice are done.
   */
  bankedExtraDice?: number;
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
  return withReqId(
    {
      type: "stateSync",
      roomCode,
      state: serializeState(s.game),
      stateHash: hashState(s.game),
      turn: { ...(s.turn as any), pendingDice: s.pendingDice ?? [], bankedExtraDice: s.bankedExtraDice ?? 0 } as any,
    } as any,
    reqId
  );
}

function mkLegalMoves(
  roomCode: string,
  actorId: string,
  dice: number[],
  moves: unknown[],
  turn?: any,
  reqId?: string
): ServerMessage {
  // actorId here is the RECIPIENT who may submit the move.
  // Send both dice (preferred) and die (legacy) for compatibility.
  const die = dice[0];
  return withReqId({ type: "legalMoves", roomCode, actorId, dice, die, moves, ...(turn ? { turn } : {}) } as any, reqId);
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

function isExtraRollFromDice(dice: number[]): boolean {
  return dice.some((d) => d === 1 || d === 6);
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

      const banked0 = Number.isInteger((state as any).bankedExtraDice)
        ? ((state as any).bankedExtraDice as number)
        : (Number.isInteger((state as any).bankedExtraRolls)
            ? ((state as any).bankedExtraRolls as number)
            : 0);

      // Banking semantics (Option C): when banked extra rolls exist, the next roll must be exactly ONE die
      // (banked rolls are rolled one-at-a-time, even if doubleDice is enabled).
      if (banked0 > 0 && dice.length !== 1) {
        return {
          nextState: state,
          serverMessage: mkError(
            "BAD_TURN_STATE",
            "When banked extra dice exist, roll must specify exactly one die.",
            reqId
          ),
        };
      }

const rollerId = String(state.turn.nextActorId);
      // Consume one banked extra die *when a roll is actually taken*.
      const bankedAfterConsume = banked0 > 0 ? banked0 - 1 : 0;

      // Earned extra rolls are determined by the ROLL outcome (not by what die you later spend).
      const bankedEarned = isExtraRollFromDice(dice) ? 1 : 0;
      const bankedAfterRoll = bankedAfterConsume + bankedEarned;

      // Choose who ACTS for this roll (may be teammate).
      const recipientId = String(
        chooseRollRecipient(state.game as any, rollerId as any, dice as any)
      );

      const moves = legalMoves(state.game as any, recipientId as any, dice as any) as any[];

      // Auto-pass when no legal moves (turn owner advances)
      if (moves.length === 0) {
        const nextActorId = computeNextActorId(state.game as any, rollerId);
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
          bankedExtraDice: bankedAfterRoll,
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
        pendingDice: dice,
        actingActorId: recipientId,
        bankedExtraDice: bankedAfterRoll,
      };

      return {
        nextState,
        serverMessage: mkLegalMoves(roomCode, recipientId, dice, moves, { ...(nextTurn as any), pendingDice: dice, bankedExtraDice: bankedAfterRoll }, reqId),
      };
    }

    case "getLegalMoves": {
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

      const dice = normalizeDice(msg as any);
      if (!dice) {
        return {
          nextState: state,
          serverMessage: mkError("BAD_MESSAGE", "Invalid getLegalMoves dice.", reqId),
        };
      }

      // ENFORCEMENT: When pendingDice exists, getLegalMoves must request EXACTLY ONE die.
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

        // The requested die must be available in pendingDice.
        const chk = subtractDice(state.pendingDice, dice);
        if (!chk.ok) {
          return {
            nextState: state,
            serverMessage: mkError(
              "BAD_TURN_STATE",
              "Requested die is not available in pending dice.",
              reqId
            ),
          };
        }
      }

      const rollerId = String(state.turn.nextActorId);
      const recipientId = String(
        chooseRollRecipient(state.game as any, rollerId as any, dice as any)
      );
      const moves = legalMoves(state.game as any, recipientId as any, dice as any) as any[];

      return {
        nextState: state,
        serverMessage: mkLegalMoves(
          roomCode,
          recipientId,
          dice,
          moves,
          {
            ...(state.turn as any),
            awaitingDice: state.turn.awaitingDice,
            pendingDice: Array.isArray(state.pendingDice) ? state.pendingDice : [],
            bankedExtraDice: Number.isInteger((state as any).bankedExtraDice)
              ? ((state as any).bankedExtraDice as number)
              : (Number.isInteger((state as any).bankedExtraRolls)
                  ? ((state as any).bankedExtraRolls as number)
                  : 0),
          } as any,
          reqId
        ),
      };
    }

    case "move": {
      const rollerId = String(state.turn.nextActorId);
      const actingId = String(state.actingActorId ?? rollerId);

      // Only the acting player can MOVE (may be teammate under team-play distribution).
      if ((msg as any).actorId !== actingId) {
        return {
          nextState: state,
          serverMessage: mkError(
            "NOT_YOUR_TURN",
            `Not your turn. Expected actorId=${actingId}.`,
            reqId
          ),
        };
      }

      const diceUsed = normalizeDice({ dice: (msg as any).dice });
      if (!diceUsed) {
        return {
          nextState: state,
          serverMessage: mkError("BAD_MESSAGE", "Invalid move dice.", reqId),
        };
      }

      // ENFORCEMENT: When pendingDice exists, move must spend EXACTLY ONE die.
      let remainingDice: number[] = [];
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

        const sub = subtractDice(state.pendingDice, diceUsed);
        if (!sub.ok) {
          return {
            nextState: state,
            serverMessage: mkError(
              "BAD_TURN_STATE",
              "Move die is not available in pending dice.",
              reqId
            ),
          };
        }
        remainingDice = sub.remaining;
      }

      const response = tryApplyMoveWithResponse(
        state.game as any,
        (msg as any).actorId as any,
        diceUsed as any,
        (msg as any).move
      );

      if (response.ok) {
        const nextGame: any = response.result.nextState as any;
        const engineTurn = (response.result as any).turn ?? state.turn;

        const teamPlayOn = nextGame?.config?.options?.teamPlay === true;

        // bank extra rolls are earned by the ROLL outcome (in the roll handler)
        const banked0 = Number.isInteger(state.bankedExtraDice)
          ? (state.bankedExtraDice as number)
          : 0;
        const banked1 = banked0;

        const delegated = state.actingActorId && state.actingActorId !== rollerId;

        // If there are still pending dice remaining, we must remain in resolve mode:
        // - same roller keeps control
        // - awaitingDice stays false
        // - pendingDice keeps the remainder
        if (
          Array.isArray(state.pendingDice) &&
          state.pendingDice.length > 0 &&
          remainingDice.length > 0
        ) {
          const nextTurn: TurnInfo = {
            ...engineTurn,
            nextActorId: rollerId, // keep control with the roller while resolving dice
            awaitingDice: false,
          };

          const nextState: SessionState = {
            game: nextGame,
            turn: nextTurn,
            pendingDice: remainingDice,
            actingActorId: undefined, // next resolution may be delegated again
            bankedExtraDice: banked1,
          };

          (response.result as any).turn = nextTurn;

          // Keep moveResult.response.turn consistent with result.turn (authoritative).
          // Include remaining pending dice so clients never think dice cleared early.
          (response as any).turn = { ...(nextTurn as any), pendingDice: remainingDice, bankedExtraDice: banked1 } as any;

          return {
            nextState,
            serverMessage: mkMoveResult(roomCode, response, reqId),
          };
        }

        // Otherwise, dice resolution is complete (either no pendingDice existed, or it is now empty).
        // Decide who rolls next:
        let nextActorId = engineTurn.nextActorId;
        if (typeof nextActorId !== "string") nextActorId = rollerId;

        // If teammate acted for roller, return control to roller.
        if (delegated) {
          nextActorId = rollerId;
        }

        // Team play finisher keeps the turn (continue rolling/distributing).
        const actorFinished = nextGame?.players?.[(msg as any).actorId]?.hasFinished === true;
        if (teamPlayOn && actorFinished) {
          nextActorId = (msg as any).actorId;
        }

        // Apply banked extra-roll rule:
        // If any extra rolls are banked, the roller keeps the turn to roll again.
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
          bankedExtraDice: banked1,
        };

        (response.result as any).turn = nextTurn;

        // Keep moveResult.response.turn consistent with result.turn (authoritative).
        // Dice resolution is complete here, so pendingDice must be empty.
        (response as any).turn = { ...(nextTurn as any), pendingDice: [], bankedExtraDice: banked1 } as any;

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
