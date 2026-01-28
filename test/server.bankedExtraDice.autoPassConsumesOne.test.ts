import { describe, expect, it } from "vitest";

import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedExtraDice auto-pass semantics", () => {
  it("Invariant K2: auto-pass consumes exactly one banked die and keeps the turn", () => {
    const pid = P("p0");

    // Use a real engine state so getLegalMoves can run.
    // Die=4 typically has no legal moves at the start position, which triggers auto-pass.
    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      game: game as any,
      turn: {
        nextActorId: pid,
        dicePolicy: "external",
        awaitingDice: true,
        pendingDice: [],
        bankedExtraDice: 2,
      } as any,
      actingActorId: pid,
      pendingDice: undefined,
      bankedExtraDice: 2,
    };

    const res = handleClientMessage(session, { type: "roll", actorId: pid, dice: [4] } as any);

    // No-legal-moves -> auto-pass emits a stateSync.
    expect(res.serverMessage?.type).toBe("stateSync");

    // Bank decrements by exactly one (2 -> 1).
    expect(res.nextState.bankedExtraDice).toBe(1);

    // Turn must NOT pass while bank still remains.
    expect(res.nextState.turn.nextActorId).toBe(pid);

    // After auto-pass, the player should be awaiting the next (single) roll.
    expect(res.nextState.turn.awaitingDice).toBe(true);
    expect(res.nextState.pendingDice).toBeUndefined();
  });
});
