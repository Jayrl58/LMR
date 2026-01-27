import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedExtraDice rolling semantics", () => {
  it("when bankedExtraDice > 0, next roll must be a single die and consumes exactly one banked die", () => {
    const pid = P("p0");
    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedExtraDice: 2,
    };

    // Reject attempting to roll multiple dice while banked dice exist (even if doubleDice is on).
    const bad = handleClientMessage(session, { type: "roll", actorId: pid, dice: [3, 4] } as any);
    expect(bad.serverMessage.type).toBe("error");

    // Accept a single-die roll, consuming exactly one banked die.
    // Use a value that typically has NO legal moves from the initial state (e.g., 4),
    // so this path exercises the auto-pass behavior while still consuming the banked die.
    const ok = handleClientMessage(session, { type: "roll", actorId: pid, dice: [4] } as any);

    // In the no-legal-moves case, the server will stateSync (auto-pass).
    expect(ok.serverMessage.type).toBe("stateSync");

    // Session state should have advanced the turn and be awaiting dice again.
    expect(ok.nextState.turn.awaitingDice).toBe(true);
    expect(ok.nextState.pendingDice).toBeUndefined();

    // Bank should decrement by 1 (2 -> 1); 4 earns none.
    expect(ok.nextState.bankedExtraDice).toBe(1);
  });

  it("a banked extra die roll of 1 or 6 earns an additional banked die (net 0 after consume)", () => {
    const pid = P("p0");
    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedExtraDice: 1,
    };

    // Roll a 1 from the bank: consume 1 (1 -> 0) then earn 1 (0 -> 1).
    const ok = handleClientMessage(session, { type: "roll", actorId: pid, dice: [1] } as any);

    // 1 should produce legal moves from the initial state.
    expect(ok.serverMessage.type).toBe("legalMoves");

    // Now resolving dice.
    expect(ok.nextState.turn.awaitingDice).toBe(false);
    expect(ok.nextState.pendingDice).toEqual([1]);

    // Net bank remains 1.
    expect(ok.nextState.bankedExtraDice).toBe(1);

    // Turn payload should include banked extra dice count when present.
    const msg: any = ok.serverMessage as any;
    expect(msg.turn?.bankedExtraDice).toBe(1);
  });
});
