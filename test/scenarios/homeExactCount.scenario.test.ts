import { describe, it, expect } from "vitest";
import { applyMove, legalMoves } from "../../src/engine";
import { makeState, P, setPeg, makeTrack, makeHome, findPeg } from "../helpers";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

describe("Scenario: home exact-count / overshoot", () => {
  function findAdvance(state: any, pid: any, pegIndex: number, die: number) {
    const moves = legalMoves(state, pid, [die]);
    return moves.find(
      (m: any) => m.kind === "advance" && m.actorPlayerId === pid && m.pegIndex === pegIndex
    );
  }

  /**
   * Discover the maximum home index for this board/state by repeatedly advancing
   * peg 0 with die=1 until no further advance exists.
   *
   * This avoids hardcoding home length (e.g., home[0..3]) and stays aligned to engine topology.
   */
  function discoverMaxHomeIndex(state0: any, pid: any): number {
    let state = state0;

    // Put peg0 on home-entry so the first die=1 advance enters home[0].
    const homeEntryIdx = getHomeEntryTrackIndex(state, pid);
    state = setPeg(state, pid, 0, makeTrack(homeEntryIdx));

    // Repeatedly advance with die=1.
    // Track the last observed home index for peg0.
    let lastHomeIndex = -1;

    for (let guard = 0; guard < 32; guard++) {
      const mv = findAdvance(state, pid, 0, 1);
      if (!mv) break;

      const applied = applyMove(state, mv as any);
      state = applied.state;

      const p0 = findPeg(state, pid, 0);
      if (p0.position.zone === "home") {
        lastHomeIndex = (p0.position as any).index;
      }
    }

    if (lastHomeIndex < 0) {
      throw new Error("Could not enter home[0] via home-entry + die=1 while discovering max home index.");
    }

    return lastHomeIndex;
  }

  it("a peg may advance within home only by exact count; overshoot is illegal", () => {
    const pid = P("p0");
    let state = makeState({ playerCount: 2 });

    const maxHome = discoverMaxHomeIndex(state, pid);
    expect(maxHome).toBeGreaterThanOrEqual(0);

    // Set peg0 to the last step before max, if possible.
    // If maxHome is 0, then "before max" doesn't exist; in that case we instead test that
    // from home[0] a die=2 (or any > remaining) is illegal by using maxHome itself.
    const nearMax = Math.max(0, maxHome - 1);

    state = setPeg(state, pid, 0, makeHome(pid, nearMax));

    const remaining = maxHome - nearMax;

    // Exact count: die = remaining should be legal if remaining > 0.
    if (remaining > 0) {
      const mvExact = findAdvance(state, pid, 0, remaining);
      expect(mvExact).toBeTruthy();

      const { state: afterExact } = applyMove(state, mvExact as any);
      const posExact = findPeg(afterExact, pid, 0).position;

      expect(posExact.zone).toBe("home");
      expect((posExact as any).playerId).toBe(pid);
      expect((posExact as any).index).toBe(maxHome);
    }

    // Overshoot: die = remaining + 1 should be illegal (no advance move).
    const mvOver = findAdvance(state, pid, 0, remaining + 1);
    expect(mvOver).toBeUndefined();
  });
});
