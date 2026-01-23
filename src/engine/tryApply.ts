import type { GameState } from "../types";
import { legalMoves } from "./publicApi";
import { applyMoveWithSync } from "./sync";
import type { MoveResponse, TurnContext } from "./serverEnvelope";

function sameMove(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function makeTurnContext(actorId: string): TurnContext {
  return {
    nextActorId: actorId,
    dicePolicy: "external",
    awaitingDice: true,
  };
}

/**
 * Validate a proposed move (must be one of legalMoves) and return a server-style response.
 *
 * LOCKED TURN MODEL:
 * - Option C (dice external)
 * - same actor continues until a roll produces no legal moves
 *
 * Consequence:
 * - The next decision point always awaits the next dice input.
 * - Therefore, we do NOT return "nextLegalMoves" here (moves depend on unknown next dice).
 */
export function tryApplyMoveWithResponse(
  state: GameState,
  actorId: string,
  dice: readonly number[],
  proposedMove: unknown
): MoveResponse {
  const moves = legalMoves(state, actorId as any, dice);

  const isLegal = moves.some((m: any) => sameMove(m, proposedMove));

  if (!isLegal) {
    return {
      ok: false,
      error: {
        code: "ILLEGAL_MOVE",
        message: "Move is not legal for the provided state/actor/dice.",
      },
    };
  }

  const result = applyMoveWithSync(state, proposedMove);
  const turn = makeTurnContext(actorId);

  return { ok: true, result, turn };
}
