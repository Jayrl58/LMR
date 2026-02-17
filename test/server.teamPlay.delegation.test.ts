import { describe, it, expect } from "vitest";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

import { chooseRollRecipient, legalMoves } from "../src/engine";
import { makeState } from "../src/engine/makeState";

describe("server: teamPlay delegation (roller rolls, teammate moves)", () => {
  it("roll returns stateSync; turn owner assigns pending die to teammate; teammate requests legalMoves and may move", () => {
    const p0 = "p0";
    const p2 = "p2";

    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);
    game.players[p0].hasFinished = true;

    // Sanity: engine suggests delegation target and teammate has at least one legal move for die=1
    expect(chooseRollRecipient(game as any, p0 as any, [1] as any)).toBe(p2);
    expect(legalMoves(game as any, p2 as any, [1] as any).length).toBeGreaterThan(0);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDie: undefined,
      actingActorId: undefined,
    };

    // Step 1: roll -> stateSync (pending dice exist but are unassigned)
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, die: 1 } as any);
    expect(r1.serverMessage.type).toBe("stateSync");

    const pending = (r1.nextState as any).pendingDice;
    expect(Array.isArray(pending)).toBe(true);
    expect(pending.length).toBe(1);
    expect(pending[0].value).toBe(1);
    expect(pending[0].controllerId).toBeNull();

    // Step 2: turn owner assigns the pending die to teammate -> stateSync (assignment itself doesn't auto-emit legalMoves)
    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p2,
    } as any);

    expect(r2.serverMessage.type).toBe("stateSync");
    const pending2 = (r2.nextState as any).pendingDice;
    expect(pending2[0].controllerId).toBe(p2);

    // Step 3: assigned teammate requests legalMoves for that die -> legalMoves
    const r3 = handleClientMessage(r2.nextState as any, {
      type: "getLegalMoves",
      actorId: p2,
      dice: [1],
    } as any);

    expect(r3.serverMessage.type).toBe("legalMoves");
    const lm1: any = r3.serverMessage as any;
    expect(lm1.actorId).toBe(p2);
    expect(lm1.moves.length).toBeGreaterThan(0);
  });
});
