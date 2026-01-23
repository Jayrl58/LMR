import { describe, it, expect } from "vitest";
import { applyMove, legalMoves } from "../../src/engine";
import { makeState, P, setPeg, makeTrack, findPeg } from "../helpers";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

function getTrackLen(state: unknown): number {
  // Prefer explicit values if present; otherwise use a conservative fallback.
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

describe("Scenario: kill on landing", () => {
  it("landing on an opponent kills them (sent to base) without triggering home entry", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    let state = makeState({ playerCount: 2 });

    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, p0);

    // Choose indices away from homeEntry (avoid start, intermediate, and target == homeEntry).
    let start = mod(homeEntry + 5, len);
    let target = mod(start + 2, len);

    // If we accidentally hit homeEntry (edge/wrap), shift further.
    if (start === homeEntry || target === homeEntry) {
      start = mod(homeEntry + 9, len);
      target = mod(start + 2, len);
    }

    // Place p0 peg 0 at start
    state = setPeg(state, p0, 0, makeTrack(start));

    // Place p1 peg 0 at target (so p0 landing kills p1)
    state = setPeg(state, p1, 0, makeTrack(target));

    const moves = legalMoves(state, p0, [2]);

    const killMove = moves.find(
      (m: any) =>
        m.kind === "advance" &&
        m.actorPlayerId === p0 &&
        m.pegIndex === 0 &&
        m.steps === 2
    );

    expect(killMove).toBeTruthy();

    const { state: next } = applyMove(state, killMove as any);

    const p0Peg0 = findPeg(next, p0, 0);
    const p1Peg0 = findPeg(next, p1, 0);

    // p0 should be on track at the target index
    expect(p0Peg0.position.zone).toBe("track");
    expect((p0Peg0.position as any).index).toBe(target);

    // p1 should be killed back to base
    expect(p1Peg0.position.zone).toBe("base");
  });
});
