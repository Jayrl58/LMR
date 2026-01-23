import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P, setPeg, makeTrack } from "./helpers";
import { legalMoves } from "../src/engine";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";

function getTrackLen(state: unknown): number {
  const s: any = state as any;
  return (
    s?.board?.trackLength ??
    s?.board?.trackLen ??
    s?.trackLength ??
    s?.trackLen ??
    56
  );
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

describe("server handleClientMessage (pure)", () => {
  it("roll then legal move advances state and returns moveResult ok:true", () => {
    const pid = P("p0");
    let game = makeState({ playerCount: 2 });

    // Ensure p0 has at least one legal move for die=1
    const len = getTrackLen(game);
    const homeEntry = getHomeEntryTrackIndex(game, pid);

    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);

    game = setPeg(game, pid, 0, makeTrack(start));

    const session0: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true },
      pendingDie: undefined,
    };

    // 1) roll
    const r1 = handleClientMessage(session0, { type: "roll", actorId: pid, die: 1 });
    expect(r1.serverMessage.type).toBe("legalMoves");
    expect((r1.serverMessage as any).moves.length).toBeGreaterThan(0);

    const move = (r1.serverMessage as any).moves[0];

    // 2) move
    const r2 = handleClientMessage(r1.nextState, {
      type: "move",
      actorId: pid,
      dice: [1],
      move,
    });

    expect(r2.serverMessage.type).toBe("moveResult");
    expect((r2.serverMessage as any).response.ok).toBe(true);
    expect(r2.nextState.game).not.toBe(session0.game);
  });

  it("roll then illegal move leaves state unchanged and returns moveResult ok:false", () => {
    const pid = P("p0");
    let game = makeState({ playerCount: 2 });

    // Ensure p0 has at least one legal move for die=1
    const len = getTrackLen(game);
    const homeEntry = getHomeEntryTrackIndex(game, pid);

    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);

    game = setPeg(game, pid, 0, makeTrack(start));

    const session0: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true },
      pendingDie: undefined,
    };

    // 1) roll
    const r1 = handleClientMessage(session0, { type: "roll", actorId: pid, die: 1 });
    expect(r1.serverMessage.type).toBe("legalMoves");

    // 2) send an illegal move shape
    const illegalMove = { kind: "definitelyNotARealMove" };

    const r2 = handleClientMessage(r1.nextState, {
      type: "move",
      actorId: pid,
      dice: [1],
      move: illegalMove,
    });

    expect(r2.serverMessage.type).toBe("moveResult");
    expect((r2.serverMessage as any).response.ok).toBe(false);

    // state unchanged on illegal move
    expect(r2.nextState.game).toBe(r1.nextState.game);
  });
});
