import { describe, it, expect } from "vitest";

import { makeState, setPeg, P } from "../helpers";
import { legalMoves } from "../../src/engine";

describe("Entry on 6 (Rules v1.7.1) — entry is NOT forced when other moves exist", () => {
  const DIE_6 = [6] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  function trackPos(index: number) {
    return { zone: "track", index } as any;
  }

  it("If an enter-on-6 move exists and another legal advance exists, entry is not forced", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    // Ensure entry-on-6 exists: peg0 in base.
    state = setPeg(state, A, 0, basePos(A));

    // Create a non-entry legal move on die=6 by placing peg1 on a track index
    // where advance-by-6 is legal. We derive such an index by searching moves.
    // Start with a benign placement and then scan for an advance move.
    state = setPeg(state, A, 1, trackPos(0));

    // If this placement doesn't yield an advance, walk forward until we find a track index that does.
    // (Bounded scan keeps this deterministic and avoids hardcoding geometry.)
    let moves: any[] = [];
    let foundAdvance = false;

    for (let idx = 0; idx <= 60; idx++) {
      state = setPeg(state, A, 1, trackPos(idx));
      moves = legalMoves(state as any, A as any, DIE_6 as any) as any[];

      foundAdvance = moves.some(
        (m: any) =>
          m.kind === "advance" &&
          m.pegIndex === 1 &&
          m.from?.zone === "track" &&
          m.to?.zone === "track"
      );

      if (foundAdvance) break;
    }

    expect(foundAdvance).toBe(true);

    const hasEnter = moves.some(
      (m: any) => m.kind === "enter" && m.from?.zone === "base" && m.to?.zone === "track"
    );
    const hasAdvance = moves.some(
      (m: any) => m.kind === "advance" && m.from?.zone === "track" && m.to?.zone === "track"
    );

    expect(hasEnter).toBe(true);
    expect(hasAdvance).toBe(true);

    // Guardrail: if entry were forced, we'd only see enter moves.
    const allAreEnter = moves.every((m: any) => m.kind === "enter");
    expect(allAreEnter).toBe(false);
  });
});
