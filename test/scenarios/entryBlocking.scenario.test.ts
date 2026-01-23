import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, findPeg } from "../helpers";
import { legalMoves, tryApplyMoveWithResponse } from "../../src/engine";

/**
 * NOTE (intentional):
 * We are explicitly testing the "all pegs in base" case as the canonical
 * scenario where entry is the only *kind* of legal move on a roll of 1.
 *
 * The related scenario where non-base pegs are "finished" is deferred.
 * Make a note to revisit finished-peg handling after this scenario is green.
 */

describe("Entry Blocking & Capture (Rules v1.7.1 — roll=1 scenarios)", () => {
  const DIE_1 = [1] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  function trackPos(index: number) {
    return { zone: "track", index } as any;
  }

  function applyOk(state: any, pid: any, dice: readonly number[], move: any): any {
    const res: any = tryApplyMoveWithResponse(state as any, pid as any, dice as any, move);
    expect(res.ok).toBe(true);
    return res.result.nextState;
  }

  /**
   * Derive the moving player's "1 Spot" index by enumerating enter moves on die=1.
   * Avoids hardcoding board geometry assumptions.
   */
  function oneSpotIndexFor(state: any, pid: any): number {
    const moves = legalMoves(state as any, pid as any, DIE_1 as any) as any[];
    const enter = moves.find(
      (m: any) =>
        m.kind === "enter" &&
        m.from?.zone === "base" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );
    if (!enter) {
      throw new Error(`Could not derive 1 Spot for ${String(pid)}: no enter move on die=1`);
    }
    return enter.to.index;
  }

  it("C.x: Own peg blocks entry onto the 1 Spot (roll=1)", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const oneSpot = oneSpotIndexFor(state, A);

    // Occupy A's 1 Spot with A's own peg1.
    state = setPeg(state, A, 1, trackPos(oneSpot));

    // Ensure peg0 is in base.
    state = setPeg(state, A, 0, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    // No enter move should exist when destination is occupied by own peg.
    const hasEnter = moves.some((m: any) => m.kind === "enter");
    expect(hasEnter).toBe(false);
  });

  it("C.x: Other player's peg does NOT block entry; entry kills on landing (roll=1)", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const oneSpot = oneSpotIndexFor(state, A);

    // Put B peg0 on A's 1 Spot (this should be capturable on entry).
    state = setPeg(state, B, 0, trackPos(oneSpot));

    // A peg0 in base.
    state = setPeg(state, A, 0, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    const enter = moves.find((m: any) => m.kind === "enter");

    expect(enter).toBeTruthy();

    const next = applyOk(state, A, DIE_1, enter);

    // A peg0 should be on the 1 Spot.
    const aPos = findPeg(next, A, 0).position;
    expect(aPos.zone).toBe("track");
    expect(aPos.index).toBe(oneSpot);

    // B peg0 should be killed back to base.
    const bPos = findPeg(next, B, 0).position;
    expect(bPos.zone).toBe("base");
  });

  it("C.x: When all pegs are in base, entry is the only kind of legal move (roll=1), and capture on entry applies", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const oneSpot = oneSpotIndexFor(state, A);

    // Put *all* pegs for both players in base.
    for (const pid of Object.keys(state.players ?? {})) {
      state = setPeg(state, pid, 0, basePos(pid));
      state = setPeg(state, pid, 1, basePos(pid));
      state = setPeg(state, pid, 2, basePos(pid));
      state = setPeg(state, pid, 3, basePos(pid));
    }

    // Place B peg0 on A's 1 Spot so entry will capture.
    state = setPeg(state, B, 0, trackPos(oneSpot));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    // Entry must be the only *kind* of legal move.
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.kind).toBe("enter");
    }

    // Apply one enter move and verify capture.
    const next = applyOk(state, A, DIE_1, moves[0]);

    const aPos = findPeg(next, A, 0).position;
    expect(aPos.zone).toBe("track");
    expect(aPos.index).toBe(oneSpot);

    const bPos = findPeg(next, B, 0).position;
    expect(bPos.zone).toBe("base");
  });
});
