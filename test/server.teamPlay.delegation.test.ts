import { describe, it, expect } from "vitest";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

import { chooseRollRecipient, legalMoves } from "../src/engine";
import { makeState } from "../src/engine/makeState";

describe("server: teamPlay delegation (roller rolls, teammate moves)", () => {
  it("roll from finished player delegates legalMoves to teammate; only teammate may submit move; turn owner remains roller", () => {
    const p0 = "p0";
    const p2 = "p2";

    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);
    game.players[p0].hasFinished = true;

    // sanity: engine says delegate
    expect(chooseRollRecipient(game as any, p0 as any, [1] as any)).toBe(p2);
    expect(legalMoves(game as any, p2 as any, [1] as any).length).toBeGreaterThan(0);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDie: undefined,
      actingActorId: undefined,
    };

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, die: 1 } as any);
    expect(r1.serverMessage.type).toBe("legalMoves");

    const lm1: any = r1.serverMessage as any;
    expect(lm1.actorId).toBe(p2);
    expect(lm1.moves.length).toBeGreaterThan(0);
  });
});
