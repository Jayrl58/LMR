import { describe, it, expect } from "vitest";

import { makeState, setPeg, P } from "../helpers";
import { legalMoves } from "../../src/engine";

describe("Center (Rules v1.7.1 Section F) — exit is NOT forced when other moves exist", () => {
  const DIE_1 = [1] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  it("F.x: If a Center-exit is legal and another legal move exists (e.g., entry), exit is not forced", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    // Put A peg0 in Center.
    state = setPeg(state, A, 0, ({ zone: "center" } as any));

    // Ensure another legal move exists on die=1: keep a different peg in base for entry.
    state = setPeg(state, A, 1, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    expect(moves.length).toBeGreaterThan(0);

    // Robust identification: a Center exit is any move for peg0 that goes from center -> track.
    const centerExitMoves = moves.filter(
      (m: any) =>
        m.pegIndex === 0 &&
        m.from?.zone === "center" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );

    // Entry exists if at least one enter move from base -> track exists (any peg).
    const hasEntry = moves.some(
      (m: any) => m.kind === "enter" && m.from?.zone === "base" && m.to?.zone === "track"
    );

    expect(centerExitMoves.length).toBeGreaterThan(0);
    expect(hasEntry).toBe(true);

    // Guardrail: since entry exists, we are not in a forced-exit-only situation.
    const allMovesAreCenterExits = moves.every(
      (m: any) =>
        m.from?.zone === "center" &&
        m.to?.zone === "track" &&
        typeof m.to.index === "number"
    );
    expect(allMovesAreCenterExits).toBe(false);
  });
});
