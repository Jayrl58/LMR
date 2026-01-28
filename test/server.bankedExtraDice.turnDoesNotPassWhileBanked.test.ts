import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedExtraDice turn ownership", () => {
  it("Invariant K: auto-pass while bankedExtraDice > 0 must NOT advance nextActorId", () => {
    const pid = P("p0");

    // Base game state.
    const game = makeState({ playerCount: 2, doubleDice: true });

    // Server-side options are duck-typed in tests; attach the option flags used by handleMessage.
    (game as any).config.options = { doubleDice: true, killRoll: false, teamPlay: false };

    const session: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedExtraDice: 2,
    };

    // Use a die value that typically has NO legal moves from the initial state (e.g., 4),
    // so we exercise the auto-pass behavior.
    const res = handleClientMessage(session, { type: "roll", actorId: pid, dice: [4] } as any);

    // Auto-pass occurs.
    expect(res.serverMessage.type).toBe("stateSync");

    // Die was consumed and we are awaiting the next die.
    expect(res.nextState.turn.awaitingDice).toBe(true);
    expect(res.nextState.pendingDice).toBeUndefined();

    // Bank decrements by exactly 1 (2 -> 1).
    expect(res.nextState.bankedExtraDice).toBe(1);

    // Critical: the turn must NOT pass while bank still remains.
    expect(res.nextState.turn.nextActorId).toBe(pid);
  });
});
