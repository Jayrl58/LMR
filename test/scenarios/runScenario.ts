import { applyMove, legalMoves } from "../../src/engine";
import type { GameState } from "../../src/types";

export type Scenario = {
  name: string;

  // Actor (player id)
  actorId: string;

  // Dice for this turn (required because legalMoves expects dice)
  dice: readonly number[];

  // Starting state
  initial: GameState;

  // Assertions (optional)
  expectLegalMoveCount?: number;

  // If set, apply the Nth legal move
  chooseMoveIndex?: number;

  // Optional post-apply assertion
  expectPhase?: GameState["phase"];
};

export function runScenario(s: Scenario) {
  // public legalMoves signature is (state, actorId, dice)
  const moves = legalMoves(s.initial, s.actorId as any, s.dice);

  if (typeof s.expectLegalMoveCount === "number") {
    if (moves.length !== s.expectLegalMoveCount) {
      throw new Error(
        `[${s.name}] expected ${s.expectLegalMoveCount} legal moves, got ${moves.length}`
      );
    }
  }

  if (typeof s.chooseMoveIndex === "number") {
    const move = moves[s.chooseMoveIndex];
    if (!move) {
      throw new Error(`[${s.name}] chooseMoveIndex out of range`);
    }

    // IMPORTANT: applyMove takes a Move, not an action wrapper
    const { state: next } = applyMove(s.initial, move as any);

    if (s.expectPhase && next.phase !== s.expectPhase) {
      throw new Error(
        `[${s.name}] expected phase ${s.expectPhase}, got ${next.phase}`
      );
    }

    return { moves, next };
  }

  return { moves };
}
