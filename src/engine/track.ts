// src/engine/track.ts

import type { GameState } from "../types";

/**
 * Returns total number of track spaces.
 * Placeholder: 14 spaces per player.
 */
export function getTrackLength(state: GameState): number {
  return state.config.playerCount * 14;
}

/** Wrap a track index to [0, trackLength). */
export function wrapIndex(state: GameState, index: number): number {
  const len = getTrackLength(state);
  return ((index % len) + len) % len;
}
