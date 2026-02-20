import { describe, expect, it } from "vitest";

import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedDice turn ownership", () => {
  it("Invariant K: auto-pass while resolving banked dice must NOT advance nextActorId when banked dice remain", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      game: game as any,
      turn: {
        nextActorId: p0,
        dicePolicy: "external",
        awaitingDice: true,
        pendingDice: [],
      } as any,
      actingActorId: p0,

      // Canonical storage is bankedDice (legacy bankedExtraRolls is inbound-only).
      bankedDice: 2,
      pendingDice: undefined,
    };

    // When bankedDice > 0, the next roll must roll exactly that many dice.
    // These dice should have no legal moves, so the server will auto-pass/forfeit them.
    // Rolling a 1 earns an extra die, so the bank should end at 1 and the turn must stay with p0.
    const res = handleClientMessage(session, { type: "roll", actorId: p0, dice: [4, 1] } as any);

    expect(res.serverMessage?.type).toBe("stateSync");

    // Bank was consumed by the roll (2 -> 0), then +1 was earned from rolling a 1 (0 -> 1).
    expect(res.nextState.bankedDice ?? 0).toBe(1);

    // Critical invariant: because the bank is still non-zero, the turn must NOT pass away from p0.
    expect(res.nextState.turn.nextActorId).toBe(p0);
    expect(res.nextState.turn.awaitingDice).toBe(true);

    // Auto-pass resolves the rolled dice immediately; no pending dice remain.
    expect(res.nextState.pendingDice).toBeUndefined();
  });
});
