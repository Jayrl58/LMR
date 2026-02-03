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
   * Banked extra dice earned earlier in the Turn (e.g. from rolling 1/6, or optional kill-roll).
   * These dice are owed to the roller and must be rolled only after all pendingDice are resolved.
   */
  bankedExtraDice?: number;

  /**
   * Legacy inbound-only alias for older tests/clients.
   * Transitional rule: accept on input if bankedExtraDice is absent, but never emit.
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
  return withReqId(
    {
      type: "stateSync",
      roomCode,
      state: serializeState(s.game),
      stateHash: hashState(s.game),
      turn: s.turn,
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

      
      // Transitional normalization: canonical bankedExtraDice; accept legacy bankedExtraDice inbound-only.
      const banked0 =
        Number.isInteger(state.bankedExtraDice) ? (state.bankedExtraDice as number) :
        0;

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
      const earnedFromRoll = dice.reduce(
        (acc, v) => acc + (v === 1 || v === 6 ? 1 : 0),
        0
      );
      const bankedAfter = earnedFromRoll;

      // Choose who ACTS for this roll (may be teammate).
      const recipientId = String(
        chooseRollRecipient(state.game as any, rollerId as any, dice as any)
      );

      const moves = legalMoves(state.game as any, recipientId as any, dice as any) as any[];

      // Auto-pass when no legal moves.
      // Invariant K: the turn must NOT pass while banked extra dice remain.
      if (moves.length === 0) {
        const nextActorId = bankedAfter > 0
          ? rollerId
          : computeNextActorId(state.game as any, rollerId);
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
          bankedExtraDice: bankedAfter,
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
        bankedExtraDice: bankedAfter,
      };

            const turnForMsg: any = { ...nextTurn };
      if (typeof bankedAfter === "number" && bankedAfter > 0) {
        turnForMsg.bankedExtraDice = bankedAfter;
      }

      return {
        nextState,
        serverMessage: ({ ...(mkLegalMoves(roomCode, recipientId, dice, moves, reqId) as any), turn: turnForMsg } as any),
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
        serverMessage: mkLegalMoves(roomCode, recipientId, dice, moves, reqId),
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
        const killRollOn = nextGame?.config?.options?.killRoll === true;        // Banked extra dice are earned on ROLL (when dice show 1 or 6), not on MOVE spend.
        // Therefore, the move step must not add to bank based on diceUsed.
        const banked0 =
          Number.isInteger(state.bankedExtraDice) ? (state.bankedExtraDice as number) :
          0;

        // Kill-roll (glossary-aligned): any successful kill/capture (sending an opponent peg to base) banks +1 extra die.
        // (Not +1 per capture; tests assert +1 total per capturing move.)
        const captureCount =
          (((response.result as any)?.move?.captures?.length as number | undefined) ??
            ((response.result as any)?.result?.move?.captures?.length as number | undefined) ??
            ((response as any)?.result?.move?.captures?.length as number | undefined) ??
            0) ||
          0;
        const killRollEarned = killRollOn && captureCount > 0 ? 1 : 0;

        const banked1 = banked0 + killRollEarned;

        const delegated = state.actingActorId && state.actingActorId !== rollerId;

        // If there are still pending dice remaining, check whether any are resolvable.
        if (
          Array.isArray(state.pendingDice) &&
          state.pendingDice.length > 0 &&
          remainingDice.length > 0
        ) {
          const hasAnyLegalMove = remainingDice.some((d) => {
            const lm = legalMoves(nextGame as any, rollerId as any, [d] as any) as any[];
            return Array.isArray(lm) && lm.length > 0;
          });

          if (hasAnyLegalMove) {
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

            (response as any).turn = { ...nextTurn, pendingDice: remainingDice } as any;
            (response.result as any).turn = (response as any).turn;

            return {
              nextState,
              serverMessage: mkMoveResult(roomCode, response, reqId),
            };
          }

          // Otherwise, remaining dice exist but have no legal moves; exhaust them.
          remainingDice = [];
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
          bankedExtraDice: banked1,
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
