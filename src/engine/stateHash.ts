import type { GameState } from "../types";

/**
 * Deterministic hash of GameState.
 * Used for replay verification and multiplayer sync.
 */
export function hashState(state: GameState): string {
  // Determinism is the goal. This builds on the already-locked serialization.
  return JSON.stringify(state);
}
