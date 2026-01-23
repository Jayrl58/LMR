import { describe, it, expect } from "vitest";
import { serializeState, deserializeState } from "../src/engine";
import type { GameState } from "../src/types";

describe("GameState serialization contract", () => {
  it("round-trips without structural change", () => {
    // Use the simplest valid shape for your current engine.
    // If you already have a test fixture helper, replace this with it.
    const state: GameState = {
      phase: "playing",
      players: [],
      finishedOrder: [],
      // include any other required top-level fields your GameState type defines
    } as unknown as GameState;

    const json = serializeState(state);
    const restored = deserializeState(json);

    expect(restored).toEqual(state);
  });
});
