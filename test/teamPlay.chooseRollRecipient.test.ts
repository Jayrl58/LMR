import { describe, it, expect } from "vitest";

import { makeState } from "../src/engine/makeState";
import { chooseRollRecipient, legalMoves } from "../src/engine/publicApi";

function markPlayerFinished(game: any, playerId: string) {
  if (!game.players?.[playerId]) throw new Error(`missing player ${playerId}`);
  game.players[playerId].hasFinished = true;

  const pegs = game.pegStates?.[playerId];
  if (Array.isArray(pegs)) {
    for (const p of pegs) p.isFinished = true;
  }
}

/**
 * Force "no legal moves" for a player by putting all pegs in home and marking finished.
 * This is stronger than setting player.hasFinished alone, because legalMoves is peg/state-driven.
 */
function forceNoMoves(game: any, playerId: string) {
  markPlayerFinished(game, playerId);

  const pegs = game.pegStates?.[playerId];
  if (!Array.isArray(pegs)) throw new Error(`missing pegStates for ${playerId}`);

  for (const p of pegs) {
    p.isFinished = true;
    // Generic "home" position shape used by many parts of the codebase.
    // If your SpotRef shape differs, this is the only line you may need to adjust.
    p.position = { zone: "home", playerId, index: 0 };
  }
}

describe("teamPlay: chooseRollRecipient", () => {
  it("when teamPlay is OFF, the roller is always the recipient", () => {
    const game = makeState({ playerCount: 4, teamPlay: false } as any);

    const recipient = chooseRollRecipient(game as any, "p0" as any, [1] as any);
    expect(recipient).toBe("p0");
  });

  it("when teamPlay is ON and the roller has NOT finished, the roller is the recipient", () => {
    const game = makeState({ playerCount: 4, teamPlay: true } as any);

    const recipient = chooseRollRecipient(game as any, "p0" as any, [1] as any);
    expect(recipient).toBe("p0");
  });

  it("when teamPlay is ON and the roller HAS finished, delegate to first teammate with legal moves", () => {
    const game = makeState({ playerCount: 4, teamPlay: true } as any);

    // makeState default teams: p0+p2, p1+p3
    markPlayerFinished(game, "p0");

    const teammateMoves = legalMoves(game as any, "p2" as any, [1] as any);
    expect(teammateMoves.length).toBeGreaterThan(0);

    const recipient = chooseRollRecipient(game as any, "p0" as any, [1] as any);
    expect(recipient).toBe("p2");
  });

  it("when teamPlay is ON and the roller is finished but teammates have no moves, return roller", () => {
    const game = makeState({ playerCount: 4, teamPlay: true } as any);

    markPlayerFinished(game, "p0");
    forceNoMoves(game, "p2");

    // sanity: teammate truly has no moves on die=1
    const teammateMoves = legalMoves(game as any, "p2" as any, [1] as any);
    expect(teammateMoves.length).toBe(0);

    const recipient = chooseRollRecipient(game as any, "p0" as any, [1] as any);
    expect(recipient).toBe("p0");
  });
});
