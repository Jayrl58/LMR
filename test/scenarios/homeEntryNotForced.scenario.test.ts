import { describe, it, expect } from "vitest";

import { makeState, setPeg, P } from "../helpers";
import { legalMoves } from "../../src/engine";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

describe("Home Entry (Rules v1.7.1) — home entry is NOT forced when other moves exist", () => {
  const DIE_1 = [1] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  it("If home-entry advance is legal and an entry move also exists, home entry is not forced", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    // Put A peg0 on home-entry using engine mapping (no hardcoded geometry).
    const homeEntryIdx = getHomeEntryTrackIndex(state as any, A as any) as number;
    state = setPeg(state, A, 0, ({ zone: "track", index: homeEntryIdx } as any));

    // Ensure a second legal move exists on die=1: keep peg1 in base (entry on 1).
    state = setPeg(state, A, 1, basePos(A));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];
    expect(moves.length).toBeGreaterThan(0);

    // Home entry move: peg0 advances from track(home-entry) -> home on die=1.
    const homeEntryMoves = moves.filter(
      (m: any) =>
        m.pegIndex === 0 &&
        m.from?.zone === "track" &&
        m.from?.index === homeEntryIdx &&
        m.to?.zone === "home" &&
        typeof m.to.index === "number"
    );

    // Entry move exists: base -> track "enter".
    const hasEntry = moves.some(
      (m: any) => m.kind === "enter" && m.from?.zone === "base" && m.to?.zone === "track"
    );

    expect(homeEntryMoves.length).toBeGreaterThan(0);
    expect(hasEntry).toBe(true);

    // Guardrail: since entry exists, we are not in a forced-home-entry-only situation.
    const allMovesAreHomeEntry = moves.every(
      (m: any) =>
        m.from?.zone === "track" &&
        m.from?.index === homeEntryIdx &&
        m.to?.zone === "home" &&
        typeof m.to.index === "number"
    );
    expect(allMovesAreHomeEntry).toBe(false);
  });
});
