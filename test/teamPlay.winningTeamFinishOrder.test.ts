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
  it("teamFinishOrder(teamId) returns winners in finish order (first finisher first)", () => {
    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);

    // Default teams: teamA = p0,p2 and teamB = p1,p3
    const teamA = game.players["p0"].teamId;
    expect(typeof teamA).toBe("string");

    // Winner team A finishes, in order: p2 then p0
    finish(game, "p2");
    finish(game, "p0");

    // Ensure engine recognizes team completion
    expect(isTeamFinished(game as any, teamA)).toBe(true);

    const winners = teamFinishOrder(game as any, teamA);
    expect(winners).toEqual(["p2", "p0"]);
  });
});
