import { describe, it, expect } from "vitest";
import { applyMove, applyAndRecord, hashState, legalMoves } from "../src/engine";
import { makeState, P, setPeg, makeTrack } from "./helpers";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";

function getTrackLen(state: unknown): number {
  const s: any = state as any;
  return (
    s?.board?.trackLength ??
    s?.board?.trackLen ??
    s?.trackLength ??
    s?.trackLen ??
    56
  );
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

describe("Replay reapply", () => {
  it("reapplying recorded moves reaches the same final state hash", () => {
    const pid = P("p0");
    const lenFallback = 56;

    // Build a safe starting state
    let state0 = makeState({ playerCount: 2 });

    const len = getTrackLen(state0) || lenFallback;
    const homeEntry = getHomeEntryTrackIndex(state0, pid);

    // Put peg 0 away from home-entry
    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);

    state0 = setPeg(state0, pid, 0, makeTrack(start));

    // Record 2 moves (both advance peg 0 by 1, where legal)
    let state = state0;
    let log: any[] = [];

    for (let i = 0; i < 2; i++) {
      const moves = legalMoves(state, pid, [1]);
      const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
      expect(move).toBeTruthy();

      const r = applyAndRecord(state, move as any, log);
      state = r.nextState;
      log = r.nextLog;
    }

    const finalHash = hashState(state);

    // Replay from state0
    let replayState = state0;
    for (const entry of log) {
      expect(hashState(replayState)).toBe(entry.beforeHash);
      const res = applyMove(replayState, entry.move as any);
      replayState = res.state;
      expect(hashState(replayState)).toBe(entry.afterHash);
    }

    expect(hashState(replayState)).toBe(finalHash);
  });
});
