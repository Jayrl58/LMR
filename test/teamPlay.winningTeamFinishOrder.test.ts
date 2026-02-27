import { describe, it, expect } from "vitest";

import { makeState } from "../src/engine/makeState";
import { teamFinishOrder, isTeamFinished } from "../src/engine";

function finish(game: any, pid: string) {
  game.players[pid].hasFinished = true;

  const pegs = game.pegStates?.[pid];
  if (Array.isArray(pegs)) {
    for (const p of pegs) p.isFinished = true;
  }

  if (Array.isArray(game.finishedOrder) && !game.finishedOrder.includes(pid)) {
    game.finishedOrder.push(pid);
  }
}

describe("teamPlay: winning team players are listed in order of finish", () => {

  it("4P: teamFinishOrder(teamId) returns winners in finish order (first finisher first)", () => {
    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);

    // Default teams: teamA = p0,p2 and teamB = p1,p3
    const teamA = game.players["p0"].teamId;
    expect(typeof teamA).toBe("string");

    // Winner team A finishes, in order: p2 then p0
    finish(game, "p2");
    finish(game, "p0");

    expect(isTeamFinished(game as any, teamA)).toBe(true);

    const winners = teamFinishOrder(game as any, teamA);
    expect(winners).toEqual(["p2", "p0"]);
  });

  it("6P (3x2): winning team players are listed in finish order", () => {
    const game: any = makeState({ playerCount: 6, teamPlay: true } as any);

    // Default 3x2 opposite pairs: (p0,p3) (p1,p4) (p2,p5)
    const team = game.players["p0"].teamId; // team of p0/p3
    expect(typeof team).toBe("string");

    // Finish in order: p3 then p0
    finish(game, "p3");
    finish(game, "p0");

    expect(isTeamFinished(game as any, team)).toBe(true);

    const winners = teamFinishOrder(game as any, team);
    expect(winners).toEqual(["p3", "p0"]);
  });

  it("8P (4x2): winning team players are listed in finish order", () => {
    const game: any = makeState({ playerCount: 8, teamPlay: true } as any);

    // Default 4x2 opposite pairs: (p0,p4) (p1,p5) (p2,p6) (p3,p7)
    const team = game.players["p0"].teamId; // team of p0/p4
    expect(typeof team).toBe("string");

    // Finish in order: p4 then p0
    finish(game, "p4");
    finish(game, "p0");

    expect(isTeamFinished(game as any, team)).toBe(true);

    const winners = teamFinishOrder(game as any, team);
    expect(winners).toEqual(["p4", "p0"]);
  });

});
