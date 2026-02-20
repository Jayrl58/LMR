import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P, setPeg, makeTrack } from "./helpers";

describe("doubleDice dead pending die exhaustion", () => {
  it("auto-exhausts remaining pending dice with zero legal moves and advances the turn", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // We will search for a track index where a 2-step advance enters home[0].
    // This avoids hard-coding a particular geometry index.
    let found: {
      game: any;
      moveIntoHome: any;
    } | null = null;

    for (let trackIndex = 0; trackIndex <= 200; trackIndex++) {
      let game = makeState({ playerCount: 2, doubleDice: true });

      // Keep other pegs in base; place p0 peg 3 on the track.
      game = setPeg(game, p0, 3 as any, makeTrack(trackIndex));

      const session0: SessionState = {
        game: game as any,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
        pendingDice: undefined,
        actingActorId: undefined,
        bankedDice: 0,
      };

      // Roll two dice: 2 then 5.
      const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [2, 5] } as any);
      if ((r1.serverMessage as any).type !== "legalMoves") continue;

      const lm: any = r1.serverMessage as any;
      if (!Array.isArray(lm.moves)) continue;

      const moveIntoHome = (lm.moves as any[]).find((m) =>
        m?.kind === "advance" &&
        m?.actorPlayerId === p0 &&
        m?.pegIndex === 3 &&
        m?.steps === 2 &&
        m?.to?.zone === "home" &&
        m?.to?.playerId === p0 &&
        m?.to?.index === 0
      );

      if (moveIntoHome) {
        found = { game, moveIntoHome };
        break;
      }
    }

    expect(found).toBeTruthy();
    const { game, moveIntoHome } = found!;

    // Recreate the session from the found game state and roll again to get a valid session nextState.
    const session0: SessionState = {
      game: game as any,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 0,
    };

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [2, 5] } as any);
    expect((r1.serverMessage as any).type).toBe("legalMoves");

    // Spend exactly the 2 (into home[0]).
    const r2 = handleClientMessage(r1.nextState, {
      type: "move",
      actorId: p0,
      dice: [2],
      move: moveIntoHome,
    } as any);

    expect((r2.serverMessage as any).type).toBe("moveResult");

    const mr: any = r2.serverMessage as any;
    expect(mr.response?.ok).toBe(true);

    // Contract for the bug: if the remaining pending die has zero legal moves,
    // the server must auto-exhaust it and advance the turn.
    expect(mr.response?.turn?.pendingDice ?? []).toEqual([]);
    expect(mr.response?.turn?.nextActorId).toBe(p1);

    // Session state must also reflect that dice resolution is complete.
    expect(r2.nextState.pendingDice ?? []).toEqual([]);
    expect(r2.nextState.turn.nextActorId).toBe(p1);
  });
});
