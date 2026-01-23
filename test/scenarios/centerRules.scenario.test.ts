import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, findPeg } from "../helpers";
import { legalMoves, tryApplyMoveWithResponse } from "../../src/engine";

describe("Center (Rules v1.7.1 Section F)", () => {
  const DIE_1 = [1] as const;
  const DIE_2 = [2] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  function centerPos() {
    return { zone: "center" } as any;
  }

  function applyOk(state: any, pid: any, dice: readonly number[], move: any): any {
    const res: any = tryApplyMoveWithResponse(state as any, pid as any, dice as any, move);
    expect(res.ok).toBe(true);
    return res.result.nextState; // confirmed by probe output
  }

  function normalizeForCenterExitProbe(state: any, pid: any): any {
    // Ensure a clean board for center-exit enumeration:
    // - mover peg0 in center
    // - all other pegs in base (no accidental blocking/captures)
    // - other players all pegs in base
    let s = state;

    // mover
    s = setPeg(s, pid, 0, centerPos());
    s = setPeg(s, pid, 1, basePos(pid));
    s = setPeg(s, pid, 2, basePos(pid));
    s = setPeg(s, pid, 3, basePos(pid));

    // others
    for (const otherId of Object.keys(s.players ?? {})) {
      if (otherId === pid) continue;
      s = setPeg(s, otherId, 0, basePos(otherId));
      s = setPeg(s, otherId, 1, basePos(otherId));
      s = setPeg(s, otherId, 2, basePos(otherId));
      s = setPeg(s, otherId, 3, basePos(otherId));
    }

    return s;
  }

  /**
   * Per v1.7.1:
   * - Center exit on 1 may go to ANY Point (including Points not owned by active players),
   *   except a Point occupied by the moving player's own Peg.
   *
   * Rather than guessing Point indices, we derive "board Points" by enumerating
   * all legal center-exit moves on a clean board and observing their landing indices.
   */
  function deriveBoardPointsForState(state: any, pid: any): number[] {
    const s = normalizeForCenterExitProbe(state, pid);
    const moves = legalMoves(s as any, pid as any, DIE_1 as any) as any[];

    const landing = new Set<number>();
    for (const m of moves) {
      const next = applyOk(s, pid, DIE_1, m);
      const pos = findPeg(next, pid, 0).position;
      if (pos.zone === "track" && typeof pos.index === "number") {
        landing.add(pos.index);
      }
    }

    return Array.from(landing).sort((a, b) => a - b);
  }

  it("F.1: Center entry is only available from a Point on a roll of 1", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    // Determine a Point index for this state (first in the derived list).
    const points = deriveBoardPointsForState(state, A);
    expect(points.length).toBeGreaterThan(0);

    // Place peg0 on a Point.
    state = setPeg(state, A, 0, ({ zone: "track", index: points[0] } as any));

    // Roll 1: at least one legal move must result in zone=center.
    const moves1 = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    const entersOn1 = moves1.some((m) => {
      const next = applyOk(state, A, DIE_1, m);
      return findPeg(next, A, 0).position.zone === "center";
    });
    expect(entersOn1).toBe(true);

    // Roll 2: no legal move may result in zone=center.
    const moves2 = legalMoves(state as any, A as any, DIE_2 as any) as any[];
    const entersOn2 = moves2.some((m) => {
      const next = applyOk(state, A, DIE_2, m);
      return findPeg(next, A, 0).position.zone === "center";
    });
    expect(entersOn2).toBe(false);
  });

  it("F.3: Center exit is only available on a roll of 1", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    state = setPeg(state, A, 0, centerPos());

    const moves1 = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    const exitsOn1 = moves1.some((m) => {
      const next = applyOk(state, A, DIE_1, m);
      return findPeg(next, A, 0).position.zone === "track";
    });
    expect(exitsOn1).toBe(true);

    const moves2 = legalMoves(state as any, A as any, DIE_2 as any) as any[];
    const exitsOn2 = moves2.some((m) => {
      const next = applyOk(state, A, DIE_2, m);
      return findPeg(next, A, 0).position.zone === "track";
    });
    expect(exitsOn2).toBe(false);
  });

  it("F.4: Center exit destinations are ANY Point, excluding Points occupied by the moving player's own Peg", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const boardPoints = deriveBoardPointsForState(state, A);

    // Per project decision: 2-player uses a 4-arm board, so we expect 4 Points.
    expect(boardPoints.length).toBe(4);

    // Clean board & put peg0 in center.
    state = normalizeForCenterExitProbe(state, A);

    // On a clean board, legal exits should cover ALL Points.
    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    const exitLandings = new Set<number>();
    for (const m of moves) {
      const next = applyOk(state, A, DIE_1, m);
      const pos = findPeg(next, A, 0).position;
      if (pos.zone === "track") exitLandings.add(pos.index);
    }
    expect(Array.from(exitLandings).sort((a, b) => a - b)).toEqual(boardPoints);

    // If one Point is occupied by A's own peg, that Point must be excluded, others remain.
    const blockedPoint = boardPoints[0];
    state = normalizeForCenterExitProbe(makeState({ playerCount: 2 }), A);
    state = setPeg(state, A, 1, ({ zone: "track", index: blockedPoint } as any));

    const movesBlocked = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    const blockedLandings = new Set<number>();
    for (const m of movesBlocked) {
      const next = applyOk(state, A, DIE_1, m);
      const pos = findPeg(next, A, 0).position;
      if (pos.zone === "track") blockedLandings.add(pos.index);
    }

    expect(blockedLandings.has(blockedPoint)).toBe(false);

    for (const p of boardPoints) {
      if (p === blockedPoint) continue;
      expect(blockedLandings.has(p)).toBe(true);
    }

    // Sanity: no exit may land on a non-Point.
    for (const idx of blockedLandings) {
      expect(boardPoints).toContain(idx);
    }
  });

  it("F.4/F.6: Exiting the Center to a Point kills any other player's peg on that destination", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const boardPoints = deriveBoardPointsForState(state, A);
    expect(boardPoints.length).toBe(4);

    // Choose a Point and place B peg0 there.
    const targetPoint = boardPoints[1];

    state = normalizeForCenterExitProbe(state, A);
    state = setPeg(state, B, 0, ({ zone: "track", index: targetPoint } as any));

    // Find an exit move that lands A peg0 on targetPoint.
    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    const landingMove = moves.find((m) => {
      const next = applyOk(state, A, DIE_1, m);
      const aPos = findPeg(next, A, 0).position;
      return aPos.zone === "track" && aPos.index === targetPoint;
    });

    expect(landingMove).toBeTruthy();

    const next = applyOk(state, A, DIE_1, landingMove);

    // B peg0 must be killed back to base.
    const bPos = findPeg(next, B, 0).position;
    expect(bPos.zone).toBe("base");
  });
});
