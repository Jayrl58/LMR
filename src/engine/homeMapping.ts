// src/engine/homeMapping.ts

import type { GameState, PlayerId } from "../types";
import { getTrackEntryIndex } from "./boardMapping";

// Placeholder mapping used by tests:
// - Home entry track index is entry + 6.
export function getHomeEntryTrackIndex(state: GameState, playerId: PlayerId): number {
  return getTrackEntryIndex(state, playerId) + 6;
}
