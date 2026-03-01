import { describe, it, expect } from "vitest";
import type { GameState } from "../src/types";
import { mapGameStateToUI } from "../src/ui/mapGameStateToUI";

describe("mapGameStateToUI", () => {
  it("produces a stable UI shape without mutating input", () => {
    const mockGame = {
      gameId: "g1",
      phase: "active",
      config: {
        playerCount: 2,
        options: { doubleDice: false },
      },
      players: {
        p1: {
          playerId: "p1",
          displayName: "P1",
          seat: 0,
          isReady: true,
          hasFinished: false,
        },
        p2: {
          playerId: "p2",
          displayName: "P2",
          seat: 1,
          isReady: true,
          hasFinished: false,
        },
      },
      pegStates: {
        p1: [
          { pegIndex: 0, position: { zone: "base", playerId: "p1" }, isFinished: false },
        ],
        p2: [
          { pegIndex: 0, position: { zone: "base", playerId: "p2" }, isFinished: false },
        ],
      },
      turn: {
        currentPlayerId: "p1",
        roll: { status: "idle" },
        legalMovesVersion: 0,
      },
      finishedOrder: [],
    } as unknown as GameState;

    const before = JSON.stringify(mockGame);

    const ui = mapGameStateToUI(mockGame);

    expect(ui.phase).toBe("active");
    expect(ui.players.length).toBe(2);
    expect(ui.pegs.length).toBe(2);
    expect(ui.turn.currentPlayerId).toBe("p1");
    expect(ui.turn.dice).toBeNull();

    // Ensure no mutation
    expect(JSON.stringify(mockGame)).toBe(before);
  });
});