import type { GameState } from "../types";
import { legalMoves } from "./publicApi";
import { applyMoveWithSync } from "./sync";
import type { MoveResponse, TurnContext } from "./serverEnvelope";

function sameMove(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validate a proposed move and return a server-style response.
 *
 * LOCKED TURN MODEL:
 * - Dice are external
 * - Same actor continues until they run out of pending dice to resolve
 *
 * IMPORTANT:
 * - `dice` is treated as the authoritative *pending dice* list for this decision point,
 *   with the selected die in slot 0.
 * - The move MUST spend exactly one die: `dice[0]`.
 * - Remaining dice (if any) are returned in `turn.pendingDice`.
 */
export function tryApplyMoveWithResponse(
  state: GameState,
  actorId: string,
  dice: readonly number[],
  proposedMove: unknown
): MoveResponse {
  // Require at least one pending die, and spend exactly one: dice[0]
  const selectedDie = Array.isArray(dice) && dice.length > 0 ? dice[0] : undefined;
  if (typeof selectedDie !== "number" || !Number.isFinite(selectedDie)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Move requires a selected die (dice[0]).",
      },
    };
  }

  // Validate move against legalMoves for the selected die only.
  const moves = legalMoves(state, actorId as any, [selectedDie] as const);
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

  // Spend exactly one die (the selected die at index 0). Preserve remaining order as provided.
  const remaining = dice.slice(1);

  const turn = ({
    nextActorId: actorId,
    dicePolicy: "external",
    awaitingDice: remaining.length === 0,
    pendingDice: remaining,
  } as any) as TurnContext;

  return { ok: true, result, turn };
}
