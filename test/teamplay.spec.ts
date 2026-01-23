import { describe, it, expect } from "vitest";

import { makeState, setPeg, findPeg, P, makeTrack, makeHome, makeBase } from "./helpers";
import { listLegalMoves } from "../src/engine/legalMoves";
import { applyMove } from "../src/engine/applyMove";
import { isTeamFinished, teamFinishOrder } from "../src/engine/teams";
import type { TeamId } from "../src/types";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";
import { resolveRollActor } from "../src/engine/teamTurn";
import { listLegalMovesForPlayer } from "../src/engine/legalMoves";

describe("Team play (explicit teams, up to 4)", () => {
  it("teammate landing kill is legal and occurs (team play does not make teammates safe)", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0");
    const B = P("p1");

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [
      { teamId: "T1" as TeamId, memberPlayerIds: [A, B] },
      { teamId: "T2" as TeamId, memberPlayerIds: [P("p2"), P("p3")] },
    ];
    (s as any).players[A].teamId = "T1";
    (s as any).players[B].teamId = "T1";

    s = setPeg(s, A, 0, makeTrack(1));
    s = setPeg(s, B, 0, makeTrack(4));

    const moves = listLegalMoves(s, [3]);
    const m = moves.find(
      (x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "track" && x.to.index === 4
    );
    expect(m).toBeTruthy();
    expect((m as any).captures.length).toBe(1);

    const s2 = applyMove(s, m as any).state;

    expect(findPeg(s2, A, 0).position).toEqual(makeTrack(4));
    expect(findPeg(s2, B, 0).position.zone).toBe("base");
  });

  it("teamFinishOrder returns members in individual finishedOrder sequence", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0");
    const B = P("p1");
    const C = P("p2");
    const D = P("p3");

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [
      { teamId: "T1" as TeamId, memberPlayerIds: [A, C] },
      { teamId: "T2" as TeamId, memberPlayerIds: [B, D] },
    ];
    (s as any).players[A].teamId = "T1";
    (s as any).players[C].teamId = "T1";
    (s as any).players[B].teamId = "T2";
    (s as any).players[D].teamId = "T2";

    (s as any).finishedOrder = [B, A, D, C];

    expect(teamFinishOrder(s as any, "T1" as TeamId)).toEqual([A, C]);
    expect(teamFinishOrder(s as any, "T2" as TeamId)).toEqual([B, D]);
  });

  it("isTeamFinished true only when all members haveFinished", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0");
    const C = P("p2");

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [{ teamId: "T1" as TeamId, memberPlayerIds: [A, C] }];
    (s as any).players[A].teamId = "T1";
    (s as any).players[C].teamId = "T1";

    expect(isTeamFinished(s as any, "T1" as TeamId)).toBe(false);

    (s as any).players[A].hasFinished = true;
    expect(isTeamFinished(s as any, "T1" as TeamId)).toBe(false);

    (s as any).players[C].hasFinished = true;
    expect(isTeamFinished(s as any, "T1" as TeamId)).toBe(true);
  });

  it("winner declaration: when a team finishes, phase becomes ended and outcome lists winning team players in finish order", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0");
    const B = P("p1");
    const C = P("p2");
    const D = P("p3");

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [
      { teamId: "T1" as TeamId, memberPlayerIds: [A, C] },
      { teamId: "T2" as TeamId, memberPlayerIds: [B, D] },
    ];
    (s as any).players[A].teamId = "T1";
    (s as any).players[C].teamId = "T1";
    (s as any).players[B].teamId = "T2";
    (s as any).players[D].teamId = "T2";

    (s as any).players[A].hasFinished = true;
    (s as any).finishedOrder = [A];

    s = setPeg(s, C, 1, makeHome(C, 3), true);
    s = setPeg(s, C, 2, makeHome(C, 2), true);
    s = setPeg(s, C, 3, makeHome(C, 1), true);

    const cHomeEntryIdx = getHomeEntryTrackIndex(s, C);
    s = setPeg(s, C, 0, makeTrack(cHomeEntryIdx), false);

    (s as any).turn.currentPlayerId = C;

    const moves = listLegalMoves(s, [1]);
    const m = moves.find((x) => x.kind === "advance" && x.pegIndex === 0 && x.to.zone === "home" && x.to.index === 0);
    expect(m).toBeTruthy();

    const s2 = applyMove(s, m as any).state;

    expect(s2.phase).toBe("ended");
    expect(s2.outcome).toBeTruthy();
    expect((s2.outcome as any).kind).toBe("team");
    expect((s2.outcome as any).winnerTeamId).toBe("T1");
    expect((s2.outcome as any).winnerTeamPlayersInFinishOrder).toEqual([A, C]);
  });

  // -------------------------
  // Team-play roll distribution
  // -------------------------

  it("team roll distribution: if current player finished, roll is assigned to a teammate with a legal move", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0"); // finished roller
    const C = P("p2"); // teammate who can move

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [
      { teamId: "T1" as TeamId, memberPlayerIds: [A, C] },
      { teamId: "T2" as TeamId, memberPlayerIds: [P("p1"), P("p3")] },
    ];
    (s as any).players[A].teamId = "T1";
    (s as any).players[C].teamId = "T1";

    // A is finished (all pegs finished)
    (s as any).players[A].hasFinished = true;

    // C has a base peg; roll 1 => should have an enter move
    s = setPeg(s, C, 0, makeBase(C), false);

    // Current player is A (finished), but roll should go to C
    (s as any).turn.currentPlayerId = A;

    const actor = resolveRollActor(s as any, [1]);
    expect(actor).toBe(C);

    const movesForC = listLegalMovesForPlayer(s as any, C, [1]);
    expect(movesForC.length).toBeGreaterThan(0);
  });

  it("team roll distribution: if no teammate has a legal move, actor remains current (caller can produce pass)", () => {
    let s = makeState({ playerCount: 4, currentSeat: 0 });

    const A = P("p0");
    const C = P("p2");

    (s as any).config.options.teamPlay = true;
    (s as any).config.options.teams = [{ teamId: "T1" as TeamId, memberPlayerIds: [A, C] }];
    (s as any).players[A].teamId = "T1";
    (s as any).players[C].teamId = "T1";

    (s as any).players[A].hasFinished = true;

    // Make C effectively immobile for roll 2 (base pegs can't enter on 2)
    s = setPeg(s, C, 0, makeBase(C), false);
    (s as any).turn.currentPlayerId = A;

    const actor = resolveRollActor(s as any, [2]);
    expect(actor).toBe(A);

    const movesForC = listLegalMovesForPlayer(s as any, C, [2]);
    expect(movesForC.length).toBe(0);
  });
});
