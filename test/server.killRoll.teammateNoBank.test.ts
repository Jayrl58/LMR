import { describe, expect, it, vi } from "vitest";

import type { GameState } from "../src/types";
import type { SessionState } from "../src/server/handleMessage";
import { handleClientMessage } from "../src/server/handleMessage";

// We are hardening the server-layer kill-roll banking invariant:
// - Kill Rolls banks exactly +1 only when a move captures an OPPONENT peg.
// - Capturing a TEAMMATE peg must bank +0 (Rules Authority v1.7.6 §9.2.2, §9.4.1).

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
    // Minimal shape: server kill-roll logic inspects config + players only.
    config: {
      options: { teamPlay: true, killRoll: true, doubleDice: false, fastTrack: false },
      teamCount: 2,
    } as any,
    players: {
      p0: { seat: 0, teamId: "t0" },
      p1: { seat: 1, teamId: "t0" }, // teammate of p0
    } as any,
  } as any;
}

describe("kill-roll banking semantics: teammate capture does NOT bank", () => {
  it("Invariant: killRoll=true + teammate capture banks +0 (server-only, engine mocked)", () => {
    const state: SessionState = {
      game: makeBaseGame(),
      turn: { nextActorId: "p0" } as any,
      // No pendingDice => only turn owner may move.
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Engine returns canonical ok=true envelope with replayEntry.move.captures
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
            // Teammate capture: victimPlayerId is on same team as actorId.
            captures: [{ victimPlayerId: "p1", victimPegIndex: 0 }],
          },
        },
      },
    });

    const res = handleClientMessage(state as any, {
      type: "move",
      actorId: "p0",
      dice: [2],
      move: { kind: "move" },
    } as any);

    // Must NOT bank for teammate capture.
    expect((res.nextState as any).bankedDice ?? 0).toBe(0);
  });
});
