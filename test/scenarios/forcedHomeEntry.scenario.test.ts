import { describe, it, expect } from "vitest";
import { applyMove, legalMoves } from "../../src/engine";
import { makeState, P, setPeg, makeTrack, findPeg } from "../helpers";
import { getHomeEntryTrackIndex } from "../../src/engine/homeMapping";

describe("Scenario: forced home entry", () => {
  it("peg on home-entry + dice [1] must enter home[0]", () => {
    const pid = P("p0");

    // Start with a normal valid state
    let state = makeState({ playerCount: 2 });

    // Put p0 peg 0 exactly on the home-entry track index
    const homeEntryIdx = getHomeEntryTrackIndex(state, pid);
    state = setPeg(state, pid, 0, makeTrack(homeEntryIdx));

    // Get legal moves for p0 with dice [1]
    const moves = legalMoves(state, pid, [1]);

    // Choose the ADVANCE move for peg 0 (ignore ENTER moves for base pegs)
    const moveForPeg0 = moves.find(
      (m: any) => m.kind === "advance" && m.actorPlayerId === pid && m.pegIndex === 0
    );

    expect(moveForPeg0).toBeTruthy();

    const { state: next } = applyMove(state, moveForPeg0 as any);

    const moved = findPeg(next, pid, 0);

    expect(moved.position.zone).toBe("home");
    expect((moved.position as any).index).toBe(0);
    expect((moved.position as any).playerId).toBe(pid);
  });
});
