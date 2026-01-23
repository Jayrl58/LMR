import { describe, it, expect } from "vitest";
import { legalMoves } from "../../src/engine";
import { makeState, P, setPeg, makeTrack, makeHome } from "../helpers";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

describe("Scenario: blocked forced home entry", () => {
  it("if home[0] is occupied, a peg on home-entry cannot advance with dice [1]", () => {
    const pid = P("p0");

    let state = makeState({ playerCount: 2 });

    // Put p0 peg 0 on the home-entry track index
    const homeEntryIdx = getHomeEntryTrackIndex(state, pid);
    state = setPeg(state, pid, 0, makeTrack(homeEntryIdx));

    // Occupy home[0] with p0 peg 1
    state = setPeg(state, pid, 1, makeHome(pid, 0));

    const moves = legalMoves(state, pid, [1]);

    // The advance move for peg 0 should NOT be present
    const advancePeg0 = moves.find(
      (m: any) => m.kind === "advance" && m.actorPlayerId === pid && m.pegIndex === 0
    );

    expect(advancePeg0).toBeUndefined();
  });
});
