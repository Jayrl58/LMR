import type { GameState } from "../types";
import { applyMove } from "./applyMove";
import { hashState } from "./stateHash";
import type { ReplayEntry } from "./replay";

export type SyncResult = {
  nextState: GameState;
  afterHash: string;
  replayEntry: ReplayEntry;
};

/**
 * Apply a move and return a minimal sync payload:
 * - nextState (authoritative)
 * - afterHash (client/server sync check)
 * - replayEntry (for audit/replay streams)
 */
export function applyMoveWithSync(state: GameState, move: unknown): SyncResult {
  const beforeHash = hashState(state);
  const { state: nextState } = applyMove(state, move as any);
  const afterHash = hashState(nextState);

  const replayEntry: ReplayEntry = {
    beforeHash,
    move,
    afterHash,
  };

  return { nextState, afterHash, replayEntry };
}
