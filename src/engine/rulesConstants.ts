// src/engine/rulesConstants.ts

// Only rolls that allow leaving Base.
export const BASE_ENTRY_ROLLS: ReadonlySet<number> = new Set([1, 6]);

// Offsets from a player's arm start (track entry index).
// Canonical: 1-Spot is +8, Point is +13.
export const ONE_SPOT_OFFSET = 8;
export const POINT_OFFSET = 13;
