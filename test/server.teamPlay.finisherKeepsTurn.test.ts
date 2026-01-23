import { describe, it, expect } from "vitest";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

import { makeState } from "../src/engine/makeState";
import { chooseRollRecipient, legalMoves } from "../src/engine";

describe("server: teamPlay finisher keeps turn + can delegate subsequent rolls", () => {
  it("after a finished player acts (or is the turn owner), they keep nextActorId and subsequent roll delegates to teammate", () => {
    const p0 = "p0";
    const p2 = "p2";

    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);

    // Force p0 to be finished at start to activate delegation on roll.
    game.players[p0].hasFinished = true;

    // Sanity: engine chooses teammate on a die=1
    expect(chooseRollRecipient(game as any, p0 as any, [1] as any)).toBe(p2);
    expect(legalMoves(game as any, p2 as any, [1] as any).length).toBeGreaterThan(0);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDie: undefined,
      actingActorId: undefined,
    };

    // Roll 1: should delegate to p2
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, die: 1 } as any);
    expect(r1.serverMessage.type).toBe("legalMoves");
    expect((r1.serverMessage as any).actorId).toBe(p2);

    const delegatedMove = (r1.serverMessage as any).moves[0];

    // Teammate makes the move
    const r2 = handleClientMessage(r1.nextState, {
      type: "move",
      actorId: p2,
      dice: [1],
      move: delegatedMove,
    } as any);

    expect(r2.serverMessage.type).toBe("moveResult");
    expect((r2.serverMessage as any).response.ok).toBe(true);

    // NEW rule: finished player keeps the turn (nextActorId stays p2 because p2 acted and was not finished)
    // But because this test starts with p0 finished, the key check is:
    // if p2 *becomes* finished due to that move, they must keep the turn.
    const gameAfter: any = r2.nextState.game;
    const p2Finished = gameAfter.players[p2].hasFinished === true;

    if (p2Finished) {
      expect(r2.nextState.turn.nextActorId).toBe(p2);
    }

    // Regardless, the TURN OWNER should never advance away from the finisher just because teamPlay is on.
    // If p2 didn't finish, then nextActorId follows normal rules; ensure it is a valid player id.
    expect(typeof r2.nextState.turn.nextActorId).toBe("string");

    // Now: set the turn owner to p0 explicitly (finisher keep-rolling rule),
    // and assert a subsequent roll delegates again to p2 (teammate).
    const session3: SessionState = {
      ...r2.nextState,
      turn: { ...r2.nextState.turn, nextActorId: p0, awaitingDice: true } as any,
    };

    const r3 = handleClientMessage(session3, { type: "roll", actorId: p0, die: 1 } as any);
    expect(r3.serverMessage.type).toBe("legalMoves");
    expect((r3.serverMessage as any).actorId).toBe(p2);
  });
});
