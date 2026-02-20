import { describe, expect, it } from "vitest";

import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedDice auto-pass semantics", () => {
  it("auto-pass forfeits dice with no legal moves; if no pending dice remain, the turn advances", () => {
    const p0 = P("p0");
    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      game: game as any,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 2,
    };

    // Roll exactly the bank size (2 dice). Choose dice that yield no legal moves so it auto-passes.
    const res = handleClientMessage(session, { type: "roll", actorId: p0, dice: [4, 4] } as any);

    expect(res.serverMessage.type).toBe("stateSync");

    // Bank should be fully consumed by the roll, and no new extras were earned.
    expect(res.nextState.bankedDice ?? 0).toBe(0);

    // With no pending dice and no bank remaining, the turn advances to the next player.
    expect(res.nextState.turn.nextActorId).not.toBe(p0);
    expect(res.nextState.turn.awaitingDice).toBe(true);
    expect(res.nextState.pendingDice).toBeUndefined();
  });
});
