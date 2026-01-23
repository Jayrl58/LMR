import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, findPeg, makeHome } from "../helpers";
import { legalMoves, tryApplyMoveWithResponse } from "../../src/engine";

describe("Scenario: forced entry when all non-base pegs are finished", () => {
  const DIE_1 = [1] as const;
  const DIE_6 = [6] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  function applyOk(state: any, pid: any, dice: readonly number[], move: any): any {
    const res: any = tryApplyMoveWithResponse(state as any, pid as any, dice as any, move);
    expect(res.ok).toBe(true);
    return res.result.nextState;
  }

  function oneSpotIndexFor(state: any, pid: any): number {
    const moves = legalMoves(state as any, pid as any, DIE_1 as any) as any[];
    const enter = moves.find(
      (m: any) =>
        m.kind === "enter" &&
        m.from?.zone === "base" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );
    if (!enter) throw new Error(`No enter move on die=1 for ${String(pid)} to derive 1-Spot.`);
    return enter.to.index;
  }

  function pointIndexFor(state: any, pid: any): number {
    const moves = legalMoves(state as any, pid as any, DIE_6 as any) as any[];
    const enter = moves.find(
      (m: any) =>
        m.kind === "enter" &&
        m.from?.zone === "base" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );
    if (!enter) throw new Error(`No enter move on die=6 for ${String(pid)} to derive Point.`);
    return enter.to.index;
  }

  it("roll [1]: when all non-base pegs are finished, the only kind of legal move is enter", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const oneSpot = oneSpotIndexFor(state, A);

    // A: peg0 in base; all other pegs finished.
    state = setPeg(state, A, 0, basePos(A));
    state = setPeg(state, A, 1, makeHome(A, 3), true);
    state = setPeg(state, A, 2, makeHome(A, 3), true);
    state = setPeg(state, A, 3, makeHome(A, 3), true);

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.kind).toBe("enter");
      expect(m.to?.zone).toBe("track");
      expect(m.to?.index).toBe(oneSpot);
    }

    const chosen = moves[0];
    const next = applyOk(state, A, DIE_1, chosen);

    const moved = findPeg(next, A, chosen.pegIndex);
    expect(moved.position.zone).toBe("track");
    expect(moved.position.index).toBe(oneSpot);

    // Finished pegs remain finished.
    expect(findPeg(next, A, 1).isFinished).toBe(true);
    expect(findPeg(next, A, 2).isFinished).toBe(true);
    expect(findPeg(next, A, 3).isFinished).toBe(true);
  });

  it("roll [6]: when all non-base pegs are finished, the only kind of legal move is enter", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const point = pointIndexFor(state, A);

    // A: peg0 in base; all other pegs finished.
    state = setPeg(state, A, 0, basePos(A));
    state = setPeg(state, A, 1, makeHome(A, 3), true);
    state = setPeg(state, A, 2, makeHome(A, 3), true);
    state = setPeg(state, A, 3, makeHome(A, 3), true);

    const moves = legalMoves(state as any, A as any, DIE_6 as any) as any[];

    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.kind).toBe("enter");
      expect(m.to?.zone).toBe("track");
      expect(m.to?.index).toBe(point);
    }

    const chosen = moves[0];
    const next = applyOk(state, A, DIE_6, chosen);

    const moved = findPeg(next, A, chosen.pegIndex);
    expect(moved.position.zone).toBe("track");
    expect(moved.position.index).toBe(point);

    // Finished pegs remain finished.
    expect(findPeg(next, A, 1).isFinished).toBe(true);
    expect(findPeg(next, A, 2).isFinished).toBe(true);
    expect(findPeg(next, A, 3).isFinished).toBe(true);
  });
});
