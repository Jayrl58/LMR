import { describe, expect, it } from "vitest";

import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("bankedExtraDice rolling semantics", () => {
  it("when bankedExtraRolls > 0, the next roll must roll exactly that many dice (all at once)", () => {
    const pid = P("p0");

    const game = makeState({
      playerCount: 2,
      options: { doubleDice: true, killRoll: false, teamPlay: false },
    });

    const session: SessionState = {
      roomCode: "R",
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: pid,
      pendingDice: undefined,
      bankedExtraRolls: 2,
    };

    // Reject attempting to roll the wrong number of dice while banked dice exist.
    const bad = handleClientMessage(session, { type: "roll", actorId: pid, dice: [6] } as any);
    expect(bad.serverMessage.type).toBe("error");

    // Accept rolling exactly the bank size. (Use a 6 first so legal moves exist.)
    const ok = handleClientMessage(session, { type: "roll", actorId: pid, dice: [6, 4] } as any);
    expect(ok.serverMessage.type).not.toBe("error");

    // Rolling consumes the entire bank (2 -> 0), then re-banks any newly earned extras from the rolled dice.
    // Here we rolled a 6 (earns +1) and a 4 (earns +0) => bank becomes 1.
    expect(ok.nextState.bankedExtraRolls).toBe(1);

    // After a successful roll, we should be in the "resolve" phase (awaitingDice=false) with pendingDice present.
    expect(ok.nextState.turn.awaitingDice).toBe(false);
    expect(Array.isArray(ok.nextState.pendingDice)).toBe(true);
    expect((ok.nextState.pendingDice ?? []).length).toBe(2);
  });
});
