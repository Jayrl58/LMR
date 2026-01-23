import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, makeHome } from "../helpers";
import { legalMoves } from "../../src/engine";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

describe("Scenario: home entry destination is exclusive (no captures in home)", () => {
  const DIE_1 = [1] as const;

  function basePos(playerId: any) {
    return { zone: "base", playerId } as any;
  }

  it("home-entry + dice [1] may enter home[0] when home[0] is empty", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const homeEntryIdx = getHomeEntryTrackIndex(state as any, A as any) as number;

    state = setPeg(state, A, 0, ({ zone: "track", index: homeEntryIdx } as any));
    state = setPeg(state, A, 1, basePos(A)); // irrelevant, just keeps state realistic

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    const hasHomeEntryAdvance = moves.some(
      (m: any) =>
        m.pegIndex === 0 &&
        m.from?.zone === "track" &&
        m.from?.index === homeEntryIdx &&
        m.to?.zone === "home" &&
        m.to?.playerId === A &&
        m.to?.index === 0
    );

    expect(hasHomeEntryAdvance).toBe(true);
  });

  it("if home[0] is occupied by own peg, home-entry advance is not legal (block)", () => {
    const A = P("p0");
    let state = makeState({ playerCount: 2 });

    const homeEntryIdx = getHomeEntryTrackIndex(state as any, A as any) as number;

    state = setPeg(state, A, 0, ({ zone: "track", index: homeEntryIdx } as any));
    state = setPeg(state, A, 1, makeHome(A, 0));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    const hasHomeEntryAdvance = moves.some(
      (m: any) =>
        m.pegIndex === 0 &&
        m.from?.zone === "track" &&
        m.from?.index === homeEntryIdx &&
        m.to?.zone === "home" &&
        m.to?.playerId === A &&
        m.to?.index === 0
    );

    expect(hasHomeEntryAdvance).toBe(false);
  });

  it("defensive: if home[0] is (illegally) occupied by another player's peg, home-entry advance is still not legal", () => {
    const A = P("p0");
    const B = P("p1");
    let state = makeState({ playerCount: 2 });

    const homeEntryIdx = getHomeEntryTrackIndex(state as any, A as any) as number;

    state = setPeg(state, A, 0, ({ zone: "track", index: homeEntryIdx } as any));

    // Illegal-by-rules state injection: other player's peg in A home[0].
    // Engine should treat this as blocking, not as capturable.
    state = setPeg(state, B, 0, makeHome(A, 0));

    const moves = legalMoves(state as any, A as any, DIE_1 as any) as any[];

    const hasHomeEntryAdvance = moves.some(
      (m: any) =>
        m.pegIndex === 0 &&
        m.from?.zone === "track" &&
        m.from?.index === homeEntryIdx &&
        m.to?.zone === "home" &&
        m.to?.playerId === A &&
        m.to?.index === 0
    );

    expect(hasHomeEntryAdvance).toBe(false);
  });
});
