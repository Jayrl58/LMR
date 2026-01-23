import { describe, it, expect } from "vitest";

import { makeState, setPeg, findPeg, P, makeTrack, makeHome } from "./helpers";
import { listLegalMoves } from "../src/engine/legalMoves";
import { applyMove } from "../src/engine/applyMove";
import { getTrackEntryIndex } from "../src/engine/boardMapping";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";
import { normalizeTrackIndex } from "../src/engine/constants";

describe("Movement", () => {
  it("forced home turn (T1): if on home-entry track spot, next step goes to home[0]", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    const homeEntryIdx = getHomeEntryTrackIndex(s, A);
    s = setPeg(s, A, 0, makeTrack(homeEntryIdx));

    const moves = listLegalMoves(s, [1]);

    const m = moves.find((x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home");
    expect(m).toBeTruthy();
    expect((m as any).to).toEqual(makeHome(A, 0));

    const illegalTrackContinue = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "track"
    );
    expect(illegalTrackContinue).toBeFalsy();
  });

  it("forced turn mid-move: stepping onto home-entry track spot forces next step into home[0]", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    const homeEntryIdx = getHomeEntryTrackIndex(s, A);

    // With roll 2: step1 -> homeEntryIdx, step2 -> home[0]
    const start = homeEntryIdx - 1;
    s = setPeg(s, A, 0, makeTrack(start));

    const moves = listLegalMoves(s, [2]);

    const m = moves.find((x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home");
    expect(m).toBeTruthy();
    expect((m as any).to).toEqual(makeHome(A, 0));

    const anyTrackAlternative = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "track"
    );
    expect(anyTrackAlternative).toBeFalsy();
  });

  it("blocked forced turn mid-move: if home[0] is occupied, entire move is illegal (no track alternative)", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    const homeEntryIdx = getHomeEntryTrackIndex(s, A);

    const start = homeEntryIdx - 1;
    s = setPeg(s, A, 0, makeTrack(start));

    // Block home[0] with own peg
    s = setPeg(s, A, 1, makeHome(A, 0));

    const moves = listLegalMoves(s, [2]);

    const anyPeg0Advance = moves.find((x) => x.kind === "advance" && x.pegIndex === 0);
    expect(anyPeg0Advance).toBeFalsy();
  });

  it("blocked forced turn: if home[0] is occupied by own peg, no move exists (no track alternative)", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    const homeEntryIdx = getHomeEntryTrackIndex(s, A);
    s = setPeg(s, A, 0, makeTrack(homeEntryIdx));
    s = setPeg(s, A, 1, makeHome(A, 0));

    const moves = listLegalMoves(s, [1]);

    const anyPeg0Advance = moves.find((x) => x.kind === "advance" && x.pegIndex === 0);
    expect(anyPeg0Advance).toBeFalsy();
  });

  it("cannot land on your own peg: advance landing on own occupied track spot is illegal", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    // Roll 2 from track 1 lands on track 3
    s = setPeg(s, A, 0, makeTrack(1));
    s = setPeg(s, A, 1, makeTrack(3)); // own peg occupies destination

    const moves = listLegalMoves(s, [2]);

    const landingOnOwn = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "track" && x.to.index === 3
    );
    expect(landingOnOwn).toBeFalsy();
  });

  it("cannot land on your own peg: base entry onto own occupied destination entry spot is illegal", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    const entryIdx = getTrackEntryIndex(s, A);
    const oneSpotIdx = normalizeTrackIndex(entryIdx + 8);

    // Put one of A's pegs on the roll-1 entry destination (1 Spot) already
    s = setPeg(s, A, 1, makeTrack(oneSpotIdx));

    const moves = listLegalMoves(s, [1]); // base entry roll

    const anyEnter = moves.find(
      (x) => x.kind === "enter" && x.to.zone === "track" && x.to.index === oneSpotIdx
    );
    expect(anyEnter).toBeFalsy();
  });

  it("cannot pass your own peg anywhere: own peg on path blocks track move", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    // Keep indices away from placeholder home-entry (p0 home-entry is track 6)
    // path for roll 3 from track 1 is: 2,3,4 (passes through 3)
    s = setPeg(s, A, 0, makeTrack(1));
    s = setPeg(s, A, 1, makeTrack(3));

    const moves = listLegalMoves(s, [3]);

    const peg0Moves = moves.filter((x) => x.kind === "advance" && x.pegIndex === 0);
    expect(peg0Moves.length).toBe(0);
  });

  it("home exact-fit only: overshoot beyond home[3] is illegal", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    s = setPeg(s, A, 0, makeHome(A, 2));
    const moves = listLegalMoves(s, [2]);

    const peg0Moves = moves.filter((x) => x.kind === "advance" && x.pegIndex === 0);
    expect(peg0Moves.length).toBe(0);
  });

  it("base entry mapping sanity: entry index exists and is deterministic per seat", () => {
    const s = makeState({ playerCount: 4, currentSeat: 0 });
    const A = P("p0");
    const idx = getTrackEntryIndex(s, A);
    expect(typeof idx).toBe("number");
    expect(idx).toBe(0);
  });

  // --------------------
  // Finish / placement (per LMR rule: progressive targets 3,2,1,0 by arrival order)
  // --------------------

  it("finish: first finisher is the peg that reaches home[3]", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    // With 0 finished pegs, finish target is home[3]
    s = setPeg(s, A, 0, makeHome(A, 2));

    const moves = listLegalMoves(s, [1]);
    const m = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home" && x.to.index === 3
    );
    expect(m).toBeTruthy();

    const s2 = applyMove(s, m as any).state;

    expect(findPeg(s2, A, 0).position).toEqual(makeHome(A, 3));
    expect(findPeg(s2, A, 0).isFinished).toBe(true);
  });

  it("finish: 2nd finisher finishes at home[2] when one peg already finished", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    // One peg already finished at home[3]
    s = setPeg(s, A, 1, makeHome(A, 3), true);

    // Next peg should finish at home[2]
    s = setPeg(s, A, 0, makeHome(A, 1), false);

    const moves = listLegalMoves(s, [1]);
    const m = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home" && x.to.index === 2
    );
    expect(m).toBeTruthy();

    const s2 = applyMove(s, m as any).state;

    expect(findPeg(s2, A, 0).position).toEqual(makeHome(A, 2));
    expect(findPeg(s2, A, 0).isFinished).toBe(true);
  });

  it("finish: player.hasFinished becomes true when the 4th peg finishes at home[0]", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    // Pre-finish three pegs occupying home[3], home[2], home[1]
    s = setPeg(s, A, 1, makeHome(A, 3), true);
    s = setPeg(s, A, 2, makeHome(A, 2), true);
    s = setPeg(s, A, 3, makeHome(A, 1), true);

    // Last peg sits on home-entry track spot; roll 1 forces into home[0] and should finish
    const homeEntryIdx = getHomeEntryTrackIndex(s, A);
    s = setPeg(s, A, 0, makeTrack(homeEntryIdx), false);

    const moves = listLegalMoves(s, [1]);
    const m = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home" && x.to.index === 0
    );
    expect(m).toBeTruthy();

    const s2 = applyMove(s, m as any).state;

    expect(findPeg(s2, A, 0).position).toEqual(makeHome(A, 0));
    expect(findPeg(s2, A, 0).isFinished).toBe(true);
    expect(s2.players[A].hasFinished).toBe(true);
  });

  it("finish: finishedOrder appends a player exactly once when they finish", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");

    s = setPeg(s, A, 1, makeHome(A, 3), true);
    s = setPeg(s, A, 2, makeHome(A, 2), true);
    s = setPeg(s, A, 3, makeHome(A, 1), true);

    const homeEntryIdx = getHomeEntryTrackIndex(s, A);
    s = setPeg(s, A, 0, makeTrack(homeEntryIdx), false);

    const moves = listLegalMoves(s, [1]);
    const m = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home" && x.to.index === 0
    );
    expect(m).toBeTruthy();

    const s2 = applyMove(s, m as any).state;
    expect(s2.finishedOrder).toEqual([A]);

    const s3 = applyMove(s2, { id: "pass", kind: "pass", actorPlayerId: A, reason: "forced_pass" }).state;
    expect(s3.finishedOrder).toEqual([A]);
  });
});
