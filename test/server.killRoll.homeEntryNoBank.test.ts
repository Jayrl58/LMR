import { describe, expect, it, vi } from "vitest";

import type { GameState } from "../src/types";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

// Schema-drift guard: Home entry moves cannot capture, therefore kill-roll must not bank.
// This does NOT imply an opponent can be in Home; it asserts server behavior if a home move
// is processed with canonical captures: [].

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

describe("kill-roll schema drift guard: home entry does not bank", () => {
  it("Invariant: killRoll=true + home-entry move with captures=[] banks +0", () => {
    const baseGame = makeBaseGame();

    const state: SessionState = {
      game: baseGame,
      turn: { nextActorId: "p0" } as any,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    (tryApplyMoveWithResponse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: true,
      result: {
        nextState: baseGame,
        turn: { nextActorId: "p0" },
        afterHash: "hash_after",
        replayEntry: {
          beforeHash: "hash_before",
          afterHash: "hash_after",
          move: {
            // This move is meant to represent a legal home entry.
            // Captures must be empty for home moves.
            kind: "homeEntry",
            captures: [],
          },
        },
      },
    });

    const res = handleClientMessage(state as any, {
      type: "move",
      actorId: "p0",
      dice: [1],
      move: { kind: "homeEntry" },
    } as any);

    expect((res.nextState as any).bankedDice ?? 0).toBe(0);
  });
});
