import { describe, it, expect } from "vitest";
import { applyMove, legalMoves } from "../../src/engine";
import { makeState, P, setPeg, makeTrack, findPeg } from "../helpers";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

function getTrackLen(state: unknown): number {
  const s: any = state as any;
  return (
    s?.board?.trackLength ??
    s?.board?.trackLen ??
    s?.trackLength ??
    s?.trackLen ??
    56
  );
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

describe("Scenario: no kill on pass-over", () => {
  it("passing over an opponent does not kill them; only landing does", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    let state = makeState({ playerCount: 2 });

    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, p0);

    // Choose safe indices away from p0 homeEntry.
    // We want: start -> mid -> target (2 steps), with opponent on mid, and landing on target.
    let start = mod(homeEntry + 5, len);
    let mid = mod(start + 1, len);
    let target = mod(start + 2, len);

    // Shift if any accidentally hits homeEntry
    if (start === homeEntry || mid === homeEntry || target === homeEntry) {
      start = mod(homeEntry + 10, len);
      mid = mod(start + 1, len);
      target = mod(start + 2, len);
    }

    // p0 peg 0 starts at start
    state = setPeg(state, p0, 0, makeTrack(start));

    // p1 peg 0 is on the square that will be PASSED OVER (mid)
    state = setPeg(state, p1, 0, makeTrack(mid));

    const moves = legalMoves(state, p0, [2]);

    const move = moves.find(
      (m: any) =>
        m.kind === "advance" &&
        m.actorPlayerId === p0 &&
        m.pegIndex === 0 &&
        m.steps === 2
    );

    expect(move).toBeTruthy();

    const { state: next } = applyMove(state, move as any);

    const p0Peg0 = findPeg(next, p0, 0);
    const p1Peg0 = findPeg(next, p1, 0);

    // p0 lands on target
    expect(p0Peg0.position.zone).toBe("track");
    expect((p0Peg0.position as any).index).toBe(target);

    // p1 should still be on mid (not killed)
    expect(p1Peg0.position.zone).toBe("track");
    expect((p1Peg0.position as any).index).toBe(mid);
  });
});
