// src/engine/constants.ts

// Placeholder constants used by this snapshot's test suite.
// Track length assumes 4 arms * 14 spaces (56). Tests only rely on small indices and modular increment.
export const TRACK_LENGTH = 56;

// Base entry is allowed on these rolls.
export const BASE_ENTRY_ROLLS: readonly number[] = [1, 6];

export function normalizeTrackIndex(i: number): number {
  const m = i % TRACK_LENGTH;
  return m < 0 ? m + TRACK_LENGTH : m;
}
