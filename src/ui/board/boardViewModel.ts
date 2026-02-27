// src/ui/board/boardViewModel.ts
//
// Board rotation helpers.
//
// Convention:
// - Diagrams/examples: seat 0 is treated as "bottom" by default.
// - In-game: rotate per-client so the local player appears at bottom.
// - Positive degrees are clockwise; we return values normalized to [-180, 180).

/**
 * Normalize degrees into the range [-180, 180).
 */
export function normalizeDeg(deg: number): number {
  // Robust modulo for negatives.
  let d = ((deg % 360) + 360) % 360; // [0, 360)
  if (d >= 180) d -= 360; // [-180, 180)
  return d;
}

/**
 * Compute rotation (degrees) to bring `localSeat` to bottom, given an N-player board.
 *
 * @param playerCount Number of seats around the board (4, 6, 8).
 * @param localSeat   The seat index for the local player (0..playerCount-1).
 * @param diagramBottomSeat Optional: which seat is "bottom" in authored diagram art. Default 0.
 *
 * Examples:
 * - 4P: delta = 90. seat 1 => -90, seat 3 => +90.
 * - 6P: delta = 60. seat 4 => +120.
 * - 8P: delta = 45. seat 5 => +135.
 */
export function computeBoardRotationDeg(
  playerCount: number,
  localSeat: number,
  diagramBottomSeat: number = 0,
): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) {
    throw new Error(`computeBoardRotationDeg: invalid playerCount: ${playerCount}`);
  }

  const delta = 360 / playerCount;

  // If diagramBottomSeat is the seat that appears at bottom in source art, then:
  // - localSeat === diagramBottomSeat => rotation 0
  // - localSeat one step clockwise => rotate board counterclockwise (negative)
  const stepsFromDiagramBottom = localSeat - diagramBottomSeat;
  const rotation = -stepsFromDiagramBottom * delta;

  return normalizeDeg(rotation);
}