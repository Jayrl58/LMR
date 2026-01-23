import { describe, it, expect } from "vitest";
import { hashState } from "../src/engine";
import { makeState } from "./helpers";

describe("GameState hash", () => {
  it("produces the same hash for identical states", () => {
    const a = makeState({ playerCount: 2 });
    const b = makeState({ playerCount: 2 });

    expect(hashState(a)).toBe(hashState(b));
  });
});
