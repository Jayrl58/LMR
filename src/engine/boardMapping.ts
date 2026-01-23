// src/engine/boardMapping.ts

import type { GameState, PlayerId } from "../types";

// Placeholder mapping used by tests:
// - Track entry index is deterministic by seat, 14 per seat.
export function getTrackEntryIndex(state: GameState, playerId: PlayerId): number {
  const seat = state.players[playerId].seat;
  return seat * 14;
}
