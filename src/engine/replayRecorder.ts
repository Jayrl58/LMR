import type { GameState } from "../types";
import { hashState } from "./stateHash";
import type { ReplayEntry, ReplayLog } from "./replay";

/**
 * Append a single replay entry for a move, given the before/after states.
 * Pure function: does not mutate inputs.
 */
export function recordMove(
  log: ReplayLog,
  before: GameState,
  move: unknown,
  after: GameState
): ReplayLog {
  const entry: ReplayEntry = {
    beforeHash: hashState(before),
    move,
    afterHash: hashState(after),
  };

  return [...log, entry];
}
