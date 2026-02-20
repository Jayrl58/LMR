import { describe, it, expect, vi, beforeEach } from "vitest";

// Server-only invariant tests.
//
// Goal:
// - L1: killRoll=false => capture does NOT bank an extra die
// - L2: killRoll=true  => capture banks exactly +1 extra die
//
// We keep this server-only by mocking the engine surface that handleMessage imports.

const tryApplyMoveWithResponseMock = vi.fn();

vi.mock("../src/engine", () => {
  return {
    // Not used by these tests, but handleMessage imports them.
    legalMoves: vi.fn(() => []),
    chooseRollRecipient: vi.fn((game: any, rollerId: string) => rollerId),
    tryApplyMoveWithResponse: (...args: any[]) => tryApplyMoveWithResponseMock(...args),
  };
});

import { handleClientMessage } from "../src/server/handleMessage";

function makeState(opts: { killRoll: boolean; banked: number }) {
  return {
    game: {
      // handleMessage reads nextGame?.config?.options?.killRoll
      config: { options: { killRoll: opts.killRoll, doubleDice: true, teamPlay: false } },
    },
    turn: {
      nextActorId: "p0",
      awaitingDice: false,
      // Keep pendingDice undefined; we don't want the pending-dice enforcement path here.
      pendingDice: undefined,
    },
    // Top-level bank store that handleMessage reads/writes.
    bankedDice: opts.banked,
    bankedExtraRolls: opts.banked,
    pendingDice: undefined,
  } as any;
}

function makeMoveMsg() {
  return {
    type: "move",
    actorId: "p0",
    move: { kind: "advance", pegId: 0, distance: 3 },
    dice: [3],
  } as any;
}

beforeEach(() => {
  tryApplyMoveWithResponseMock.mockReset();
});

describe("kill-roll banking semantics (server-only, engine mocked)", () => {
  it("Invariant L1: killRoll=false capture does NOT bank extra die", () => {
    const state = makeState({ killRoll: false, banked: 0 });

    // Engine says: ok move, and it captured exactly one opponent peg.
    tryApplyMoveWithResponseMock.mockReturnValueOnce({
      ok: true,
      result: {
        ok: true,
        move: { captures: [{ victim: "p1", pegId: 0 }] },
        turn: { nextActorId: "p1", awaitingDice: true },
        nextState: state.game,
      },
    });

    const res = handleClientMessage(state, makeMoveMsg());

    expect(res.serverMessage?.type).toBe("moveResult");
    // moveResult wraps the engine response under `.response`.
    expect((res.serverMessage as any)?.response?.ok).toBe(true);

    // No banking when killRoll is off.
    expect(res.nextState.bankedDice ?? res.nextState.bankedExtraRolls).toBe(0);
  });

  it("Invariant L2: killRoll=true capture banks exactly +1 extra die", () => {
    const state = makeState({ killRoll: true, banked: 0 });

    tryApplyMoveWithResponseMock.mockReturnValueOnce({
      ok: true,
      result: {
        ok: true,
        move: { captures: [{ victim: "p1", pegId: 0 }] },
        turn: { nextActorId: "p1", awaitingDice: true },
        nextState: state.game,
      },
    });

    const res = handleClientMessage(state, makeMoveMsg());

    expect(res.serverMessage?.type).toBe("moveResult");
    expect((res.serverMessage as any)?.response?.ok).toBe(true);

    // Exactly +1 for the capturing move.
    expect(res.nextState.bankedDice ?? res.nextState.bankedExtraRolls).toBe(1);
  });
});
