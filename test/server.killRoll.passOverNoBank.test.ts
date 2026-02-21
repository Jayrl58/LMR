import { describe, expect, it, vi } from "vitest";

import type { GameState } from "../src/types";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

// Kill-roll negative invariant (Rules Authority v1.7.6 §9.4.1):
// - A move that does NOT capture a peg grants NO banked die.
// This test models a pass-over / non-capture move by emitting captures: [].
//
// Note: engine is mocked; we enforce server behavior against canonical
// result.replayEntry.move.captures (strict path).

vi.mock("../src/engine", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/engine")>();
  return {
    ...mod,
    tryApplyMoveWithResponse: vi.fn(),
  };
});

import { tryApplyMoveWithResponse } from "../src/engine";

function makeBaseGame(): GameState {
  return {
    phase: "playing",
    config: {
      options: { teamPlay: false, killRoll: true, doubleDice: false, fastTrack: false },
    } as any,
    players: {
      p0: { seat: 0 },
      p1: { seat: 1 },
    } as any,
  } as any;
}

describe("kill-roll banking semantics: non-capture does NOT bank (pass-over)", () => {
  it("Invariant: killRoll=true + captures=[] banks +0 (server-only, engine mocked)", () => {
    const state: SessionState = {
      game: makeBaseGame(),
      turn: { nextActorId: "p0" } as any,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    (tryApplyMoveWithResponse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
      result: {
        nextState: state.game,
        turn: { nextActorId: "p0" },
        afterHash: "hash_after",
        replayEntry: {
          beforeHash: "hash_before",
          afterHash: "hash_after",
          move: {
            // No capture occurred (e.g., pass-over).
            captures: [],
          },
        },
      },
    });

    const res = handleClientMessage(state as any, {
      type: "move",
      actorId: "p0",
      dice: [3],
      move: { kind: "move" },
    } as any);

    expect((res.nextState as any).bankedDice ?? 0).toBe(0);
  });
});
