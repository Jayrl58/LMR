import { describe, expect, it } from "vitest";

import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedExtraDice auto-pass semantics", () => {
  it("auto-pass forfeits dice with no legal moves; if no pending dice remain, the turn advances", () => {
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

      // Canonical server-side storage is bankedExtraRolls.
      bankedExtraRolls: 2,
      pendingDice: undefined,
    };

    // When bankedExtraRolls > 0, the next roll must roll exactly that many dice.
    // Both dice have no legal moves, so the server should auto-pass/forfeit them.
    const res = handleClientMessage(session, { type: "roll", actorId: p0, dice: [4, 4] } as any);

    // Auto-pass resolves the no-move dice immediately and emits a stateSync.
    expect(res.serverMessage?.type).toBe("stateSync");

    // Bank should be fully consumed by the roll.
    expect(res.nextState.bankedExtraRolls ?? 0).toBe(0);

    // With no pending dice and no bank remaining, the turn advances to the next player.
    expect(res.nextState.turn.nextActorId).toBe(p1);
    expect(res.nextState.turn.awaitingDice).toBe(true);

    // Server-side pending dice should be cleared.
    expect(res.nextState.pendingDice).toBeUndefined();
  });
});
