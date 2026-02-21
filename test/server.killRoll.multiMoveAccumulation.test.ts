import { describe, expect, it, vi } from "vitest";

import type { GameState } from "../src/types";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

// Kill-roll accumulation invariant (Rules Authority v1.7.6 §9.4.1):
// - Each qualifying opponent capture move grants exactly +1 Banked Die.
// - Multiple qualifying moves in the same turn accumulate independently.
// - No collapse, no bleed, no double-count beyond 1 per move.

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

describe("kill-roll banking semantics: multi-move accumulation", () => {
  it("Invariant: two separate opponent capture moves bank exactly +2 total", () => {
    const baseGame = makeBaseGame();

    let state: SessionState = {
      game: baseGame,
      turn: { nextActorId: "p0" } as any,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // First move: opponent capture
    (tryApplyMoveWithResponse as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ok: true,
      result: {
        nextState: baseGame,
        turn: { nextActorId: "p0" },
        afterHash: "hash_after_1",
        replayEntry: {
          beforeHash: "hash_before_1",
          afterHash: "hash_after_1",
          move: {
            captures: [{ victimPlayerId: "p1", victimPegIndex: 0 }],
          },
        },
      },
    });

    const r1 = handleClientMessage(state as any, {
      type: "move",
      actorId: "p0",
      dice: [2],
      move: { kind: "move" },
    } as any);

    expect((r1.nextState as any).bankedDice ?? 0).toBe(1);

    // Second move: another opponent capture
    (tryApplyMoveWithResponse as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ok: true,
      result: {
        nextState: baseGame,
        turn: { nextActorId: "p0" },
        afterHash: "hash_after_2",
        replayEntry: {
          beforeHash: "hash_before_2",
          afterHash: "hash_after_2",
          move: {
            captures: [{ victimPlayerId: "p1", victimPegIndex: 1 }],
          },
        },
      },
    });

    const r2 = handleClientMessage(r1.nextState as any, {
      type: "move",
      actorId: "p0",
      dice: [3],
      move: { kind: "move" },
    } as any);

    expect((r2.nextState as any).bankedDice ?? 0).toBe(2);
  });
});
