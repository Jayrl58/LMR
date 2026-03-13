// src/engine/constants.ts

// Shared track geometry constants for all supported boards.
export const ARM_LENGTH = 14;

export function trackLengthForPlayerCount(playerCount: number): number {
  if (playerCount <= 4) return 4 * ARM_LENGTH;
  if (playerCount <= 6) return 6 * ARM_LENGTH;
  return 8 * ARM_LENGTH;
}

// Base entry is allowed on these rolls.
export const BASE_ENTRY_ROLLS: readonly number[] = [1, 6];

export function normalizeTrackIndex(i: number, trackLength: number): number {
  const m = i % trackLength;
  return m < 0 ? m + trackLength : m;
}
