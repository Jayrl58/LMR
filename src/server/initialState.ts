import type { GameState } from "../types";

/**
 * Minimal production-safe initial state factory.
 * Replace/extend later as you add lobby/game creation flows.
 */
export function createInitialState(playerCount: number): GameState {
  // For now, rely on the engine's existing state shape defaults.
  // This assumes your GameState type can be constructed via object literals
  // or you already have an internal initializer elsewhere.
  //
  // If you already have an engine initializer (preferred), wire it here.
  throw new Error(
    "createInitialState is not implemented yet. Wire this to your engine initializer."
  );
}
