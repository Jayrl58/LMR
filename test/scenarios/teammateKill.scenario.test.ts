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

describe("Scenario: teammate kill", () => {
  it("landing on a teammate kills them (sent to base)", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // Create a 2-player state with p0 and p1 on the SAME team if your helpers support it.
    // If makeState already sets teams, this is fine; otherwise, adjust to your helper’s team config.
    let state = makeState({ playerCount: 2 });

    // Force team assignment (if your state shape includes it)
    // If your makeState already configures teams, this will be ignored safely by TS casts.
    (state as any).teams = [{ id: "T0", members: [p0, p1] }];

    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, p0);

    // Choose safe indices away from homeEntry
    let start = mod(homeEntry + 5, len);
    let target = mod(start + 2, len);
    if (start === homeEntry || target === homeEntry) {
      start = mod(homeEntry + 9, len);
      target = mod(start + 2, len);
    }

    // p0 peg 0 will land on target
    state = setPeg(state, p0, 0, makeTrack(start));

    // teammate p1 peg 0 is sitting on target
    state = setPeg(state, p1, 0, makeTrack(target));

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

    expect(p0Peg0.position.zone).toBe("track");
    expect((p0Peg0.position as any).index).toBe(target);

    // Teammate should be killed back to base
    expect(p1Peg0.position.zone).toBe("base");
  });
});
