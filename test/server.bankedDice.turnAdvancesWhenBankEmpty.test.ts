import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedDice turn ownership", () => {
  it("Invariant K3: when the final banked die is consumed (and no pendingDice remain), the turn advances", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // Base game state.
    const game = makeState({ playerCount: 2, doubleDice: true });

    // Server-side options are duck-typed in tests; attach the option flags used by handleMessage.
    (game as any).config.options = { doubleDice: true, killRoll: false, teamPlay: false };

    const session: SessionState = {
      game: game as any,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 1,
    };

    // Use a die value that typically has NO legal moves from the initial state (e.g., 4),
    // so we exercise the auto-pass behavior.
    const res = handleClientMessage(session, { type: "roll", actorId: p0, dice: [4] } as any);

    // Auto-pass occurs.
    expect(res.serverMessage.type).toBe("stateSync");

    // Bank decrements by exactly 1 (1 -> 0).
    expect(res.nextState.bankedDice).toBe(0);

    // With bank empty and no pending dice, turn should advance.
    expect(res.nextState.turn.nextActorId).toBe(p1);

    // And the next player is awaiting a new roll.
    expect(res.nextState.turn.awaitingDice).toBe(true);
    expect(res.nextState.pendingDice).toBeUndefined();
  });
});
