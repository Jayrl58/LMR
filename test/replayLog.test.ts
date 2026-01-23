import { describe, it, expect } from "vitest";
import { applyAndRecord, hashState, legalMoves } from "../src/engine";
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

describe("Replay log", () => {
  it("records before/after hashes for an applied move", () => {
    const pid = P("p0");
    let state = makeState({ playerCount: 2 });

    // Put a peg somewhere safe (avoid forced home entry effects)
    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, pid);
    let start = mod(homeEntry + 5, len);
    if (start === homeEntry) start = mod(homeEntry + 9, len);

    state = setPeg(state, pid, 0, makeTrack(start));

    const moves = legalMoves(state, pid, [1]);
    const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
    expect(move).toBeTruthy();

    const beforeHash = hashState(state);

    const { nextState, nextLog } = applyAndRecord(state, move as any, []);

    expect(nextLog.length).toBe(1);
    expect(nextLog[0].beforeHash).toBe(beforeHash);
    expect(nextLog[0].afterHash).toBe(hashState(nextState));
  });
});
