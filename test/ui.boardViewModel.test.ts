// test/ui.boardViewModel.test.ts
import { describe, it, expect } from "vitest";
import { computeBoardRotationDeg, normalizeDeg } from "../src/ui/board/boardViewModel";

describe("ui: boardViewModel", () => {
  it("normalizeDeg constrains angles into [-180, 180)", () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(180)).toBe(-180);
    expect(normalizeDeg(181)).toBe(-179);
    expect(normalizeDeg(-181)).toBe(179);
    expect(normalizeDeg(540)).toBe(-180);
  });

  it("4P: seat 0 is bottom in diagrams; each seat rotates into bottom", () => {
    // delta = 90
    expect(computeBoardRotationDeg(4, 0)).toBe(0);
    expect(computeBoardRotationDeg(4, 1)).toBe(-90);
    expect(computeBoardRotationDeg(4, 2)).toBe(-180);
    expect(computeBoardRotationDeg(4, 3)).toBe(90);
  });

  it("6P: seat 0 is bottom in diagrams; each seat rotates into bottom", () => {
    // delta = 60
    expect(computeBoardRotationDeg(6, 0)).toBe(0);
    expect(computeBoardRotationDeg(6, 1)).toBe(-60);
    expect(computeBoardRotationDeg(6, 2)).toBe(-120);
    expect(computeBoardRotationDeg(6, 3)).toBe(-180);
    expect(computeBoardRotationDeg(6, 4)).toBe(120);
    expect(computeBoardRotationDeg(6, 5)).toBe(60);
  });

  it("8P: seat 0 is bottom in diagrams; each seat rotates into bottom", () => {
    // delta = 45
    expect(computeBoardRotationDeg(8, 0)).toBe(0);
    expect(computeBoardRotationDeg(8, 1)).toBe(-45);
    expect(computeBoardRotationDeg(8, 2)).toBe(-90);
    expect(computeBoardRotationDeg(8, 3)).toBe(-135);
    expect(computeBoardRotationDeg(8, 4)).toBe(-180);
    expect(computeBoardRotationDeg(8, 5)).toBe(135);
    expect(computeBoardRotationDeg(8, 6)).toBe(90);
    expect(computeBoardRotationDeg(8, 7)).toBe(45);
  });

  it("supports non-zero diagram bottom seat (diagram convention override)", () => {
    // If a diagram were authored with seat 2 at bottom in the source art,
    // rotation should compensate so localSeat=2 yields 0.
    expect(computeBoardRotationDeg(6, 2, 2)).toBe(0);
    // localSeat=3 should rotate -60 to bring 3 to bottom.
    expect(computeBoardRotationDeg(6, 3, 2)).toBe(-60);
  });
});