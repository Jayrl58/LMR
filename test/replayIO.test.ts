import { describe, it, expect } from "vitest";
import { deserializeReplay, serializeReplay } from "../src/engine";
import { REPLAY_FORMAT_VERSION } from "../src/engine/replayFormat";
import { makeState } from "./helpers";

describe("Replay IO", () => {
  it("serializes and deserializes a replay file without change", () => {
    const initialState = makeState({ playerCount: 2 });

    const replay = {
      formatVersion: REPLAY_FORMAT_VERSION,
      createdAt: new Date("2026-01-11T00:00:00.000Z").toISOString(),
      initialState,
      log: [],
    } as const;

    const json = serializeReplay(replay);
    const restored = deserializeReplay(json);

    expect(restored).toEqual(replay);
  });
});
