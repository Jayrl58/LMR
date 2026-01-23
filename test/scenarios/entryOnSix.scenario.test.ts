import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, findPeg } from "../helpers";
import { legalMoves, tryApplyMoveWithResponse } from "../../src/engine";

describe("Entry on 6 (Rules v1.7.1 — roll=6 scenarios)", () => {
  const DIE_6 = [6] as const;

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
   * Derive the moving player's Point index by enumerating enter moves on die=6.
   * Avoids hardcoding board geometry assumptions.
   */
  function pointIndexFor(state: any, pid: any): number {
    const moves = legalMoves(state as any, pid as any, DIE_6 as any) as any[];
    const enter = moves.find(
      (m: any) =>
        m.kind === "enter" &&
        m.from?.zone === "base" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );
    if (!enter) {
      throw new Error(`Could not derive Point for ${String(pid)}: no enter move on die=6`);
    }
    return enter.to.index;
  }

  it("C.x: Own peg blocks entry onto the Point (roll=6)", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const point = pointIndexFor(state, A);

    // Occupy A's Point with A's own peg1.
    state = setPeg(state, A, 1, trackPos(point));

    // Ensure peg0 is in base.
    state = setPeg(state, A, 0, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_6 as any) as any[];

    // No enter move should exist when destination is occupied by own peg.
    const hasEnter = moves.some((m: any) => m.kind === "enter");
    expect(hasEnter).toBe(false);
  });

  it("C.x: Other player's peg does NOT block entry; entry kills on landing (roll=6)", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const point = pointIndexFor(state, A);

    // Put B peg0 on A's Point (this should be capturable on entry).
    state = setPeg(state, B, 0, trackPos(point));

    // A peg0 in base.
    state = setPeg(state, A, 0, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_6 as any) as any[];
    const enter = moves.find((m: any) => m.kind === "enter");

    expect(enter).toBeTruthy();

    const next = applyOk(state, A, DIE_6, enter);

    // A peg0 should be on the Point.
    const aPos = findPeg(next, A, 0).position;
    expect(aPos.zone).toBe("track");
    expect(aPos.index).toBe(point);

    // B peg0 should be killed back to base.
    const bPos = findPeg(next, B, 0).position;
    expect(bPos.zone).toBe("base");
  });

  it("C.x: When all pegs are in base, entry is the only kind of legal move (roll=6), and capture on entry applies", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const point = pointIndexFor(state, A);

    // Put *all* pegs for both players in base.
    for (const pid of Object.keys(state.players ?? {})) {
      state = setPeg(state, pid, 0, basePos(pid));
      state = setPeg(state, pid, 1, basePos(pid));
      state = setPeg(state, pid, 2, basePos(pid));
      state = setPeg(state, pid, 3, basePos(pid));
    }

    // Place B peg0 on A's Point so entry will capture.
    state = setPeg(state, B, 0, trackPos(point));

    const moves = legalMoves(state as any, A as any, DIE_6 as any) as any[];

    // Entry must be the only *kind* of legal move.
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.kind).toBe("enter");
    }

    // Apply one enter move and verify capture.
    const next = applyOk(state, A, DIE_6, moves[0]);

    const aPos = findPeg(next, A, 0).position;
    expect(aPos.zone).toBe("track");
    expect(aPos.index).toBe(point);

    const bPos = findPeg(next, B, 0).position;
    expect(bPos.zone).toBe("base");
  });
});
