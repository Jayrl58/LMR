import { describe, it, expect } from "vitest";
import { handleClientMessage, type SessionState } from "../src/server/handleMessage";
import { makeState, P } from "./helpers";

describe("moveResult turn consistency", () => {
  it("spending one die from a multi-die roll preserves pendingDice and awaitingDice in moveResult.response.turn", () => {
    const pid = P("p0");
    const game = makeState({ playerCount: 2 });

    const session0: SessionState = {
      game: game as any,
      turn: { nextActorId: pid, dicePolicy: "external", awaitingDice: true } as any,
      pendingDice: undefined,
      actingActorId: undefined,
      bankedDice: 0,
    };

    // Roll two dice explicitly (double-dice context)
    const r1 = handleClientMessage(session0, { type: "roll", actorId: pid, dice: [1, 2] } as any);
    expect(r1.serverMessage.type).toBe("legalMoves");

    const lm: any = r1.serverMessage as any;
    expect(lm.dice).toEqual([1, 2]);
    expect(lm.die).toBe(1);
    expect(Array.isArray(lm.moves)).toBe(true);
    expect(lm.moves.length).toBeGreaterThan(0);

    const move = lm.moves[0];

    // Spend exactly one die (the selected die)
    const r2 = handleClientMessage(r1.nextState, {
      type: "move",
      actorId: pid,
      dice: [1],
      move,
    } as any);

    expect(r2.serverMessage.type).toBe("moveResult");

    const mr: any = r2.serverMessage as any;
    expect(mr.response?.ok).toBe(true);

    // Contract: response.turn must reflect the server session's remaining pending dice,
    // not the engine's internal "dice slice(1)" behavior on the one-die move message.
    expect(mr.response?.turn?.awaitingDice).toBe(false);
    expect(mr.response?.turn?.pendingDice).toEqual([{ value: 2, controllerId: pid }]);

    // Also require internal consistency with the engine-derived turn in result.turn
    expect(mr.response?.result?.turn?.awaitingDice).toBe(mr.response?.turn?.awaitingDice);
    expect(mr.response?.result?.turn?.nextActorId).toBe(mr.response?.turn?.nextActorId);
    expect(mr.response?.result?.turn?.dicePolicy).toBe(mr.response?.turn?.dicePolicy);

    // And the next session state must keep resolving dice
    expect(r2.nextState.turn.awaitingDice).toBe(false);
    expect(r2.nextState.pendingDice).toEqual([{ value: 2, controllerId: pid }]);
  });
});
