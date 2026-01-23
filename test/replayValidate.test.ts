import { describe, it, expect } from "vitest";
import { deserializeReplay } from "../src/engine";
import { REPLAY_FORMAT_VERSION } from "../src/engine/replayFormat";
import { makeState } from "./helpers";

describe("Replay validation", () => {
  it("throws if formatVersion is wrong", () => {
    const initialState = makeState({ playerCount: 2 });

    const bad = {
      formatVersion: 999,
      createdAt: new Date("2026-01-11T00:00:00.000Z").toISOString(),
      initialState,
      log: [],
    };

    expect(() => deserializeReplay(JSON.stringify(bad))).toThrow(/formatVersion/i);
  });

  it("throws if createdAt is not ISO", () => {
    const initialState = makeState({ playerCount: 2 });

    const bad = {
      formatVersion: REPLAY_FORMAT_VERSION,
      createdAt: "2026-01-11", // not ISO with time + Z
      initialState,
      log: [],
    };

    expect(() => deserializeReplay(JSON.stringify(bad))).toThrow(/createdAt/i);
  });

  it("throws if log entry is missing hashes", () => {
    const initialState = makeState({ playerCount: 2 });

    const bad = {
      formatVersion: REPLAY_FORMAT_VERSION,
      createdAt: new Date("2026-01-11T00:00:00.000Z").toISOString(),
      initialState,
      log: [{ move: { any: "thing" } }],
    };

    expect(() => deserializeReplay(JSON.stringify(bad))).toThrow(/beforeHash|afterHash/i);
  });
});
