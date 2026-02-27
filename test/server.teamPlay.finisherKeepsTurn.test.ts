import { describe, it, expect } from "vitest";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

import { makeState } from "../src/engine/makeState";
import { chooseRollRecipient, legalMoves } from "../src/engine";

describe("server: teamPlay finisher keeps turn + can delegate subsequent rolls", () => {
  it("finished turn owner keeps nextActorId; roll -> stateSync; assign -> stateSync; teammate gets legalMoves and can move; subsequent roll can be delegated again", () => {
    const p0 = "p0";
    const p2 = "p2";

    const game: any = makeState({ playerCount: 4, teamPlay: true } as any);

    // Force p0 to be finished at start to activate delegation on roll.
    game.players[p0].hasFinished = true;

    // Sanity: engine chooses teammate on a die=1 and teammate has legal moves.
    expect(chooseRollRecipient(game as any, p0 as any, [1] as any)).toBe(p2);
    expect(legalMoves(game as any, p2 as any, [1] as any).length).toBeGreaterThan(0);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 0,
    };

    // Roll 1: returns stateSync with unassigned pending dice
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect(r1.serverMessage.type).toBe("stateSync");

    const pending1 = (r1.nextState as any).pendingDice;
    expect(Array.isArray(pending1)).toBe(true);
    expect(pending1.length).toBe(1);
    expect(pending1[0].value).toBe(1);
    expect(pending1[0].controllerId).toBeNull();

    // Turn owner assigns die to p2; assignment returns stateSync
    const r1a = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p2,
    } as any);

    expect(r1a.serverMessage.type).toBe("stateSync");

    // Teammate requests legalMoves
    const r1b = handleClientMessage(r1a.nextState as any, {
      type: "getLegalMoves",
      actorId: p2,
      dice: [1],
    } as any);

    expect(r1b.serverMessage.type).toBe("legalMoves");
    expect((r1b.serverMessage as any).actorId).toBe(p2);

    const delegatedMove = (r1b.serverMessage as any).moves[0];

    // Teammate makes the move
    const r2 = handleClientMessage(r1b.nextState as any, {
      type: "move",
      actorId: p2,
      dice: [1],
      move: delegatedMove,
    } as any);

    expect(r2.serverMessage.type).toBe("moveResult");
    expect((r2.serverMessage as any).response.ok).toBe(true);

    // Subsequent roll can be delegated again (reset to p0 awaitingDice for this test)
    const session3: SessionState = {
      ...r2.nextState,
      bankedDice: 0,
      bankedExtraRolls: undefined as any,
      turn: { ...r2.nextState.turn, nextActorId: p0, awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
    };

    const r3 = handleClientMessage(session3, { type: "roll", actorId: p0, dice: [1] } as any);
    expect(r3.serverMessage.type).toBe("stateSync");

    const pending3 = (r3.nextState as any).pendingDice;
    expect(Array.isArray(pending3)).toBe(true);
    expect(pending3.length).toBe(1);
    expect(pending3[0].controllerId).toBeNull();

    const r3a = handleClientMessage(r3.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p2,
    } as any);
    expect(r3a.serverMessage.type).toBe("stateSync");
  });

  it("terminal game state rejects roll (teamPlay 6P)", () => {
    const p0 = "p0";
    const game: any = makeState({ playerCount: 6, teamPlay: true } as any);

    // Force terminal state
    game.phase = "ended";
    game.outcome = { kind: "team", winnerTeamId: game.players[p0].teamId, winnerTeamPlayersInFinishOrder: [p0, "p3"] };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 0,
    };

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);

    // Expected: an error (or at least NOT a normal progression message).
    // This test will fail until the server gates on game.phase === "ended".
    expect(r1.serverMessage.type).toBe("error");
  });

  it("terminal game state rejects roll (teamPlay 8P)", () => {
    const p0 = "p0";
    const game: any = makeState({ playerCount: 8, teamPlay: true } as any);

    // Force terminal state
    game.phase = "ended";
    game.outcome = {
      kind: "team",
      winnerTeamId: game.players[p0].teamId,
      winnerTeamPlayersInFinishOrder: [p0, "p4"],
    };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 0,
    };

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);

    expect(r1.serverMessage.type).toBe("error");
  });

});