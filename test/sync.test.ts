import { describe, it, expect } from "vitest";
import { applyMoveWithSync, hashState, legalMoves } from "../src/engine";
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

describe("Sync primitive", () => {
  it("returns afterHash and replayEntry consistent with nextState", () => {
    const pid = P("p0");
    let state = makeState({ playerCount: 2 });

    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, pid);

    // Place peg away from forced home-entry
    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);

    state = setPeg(state, pid, 0, makeTrack(start));

    const moves = legalMoves(state, pid, [1]);
    const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
    expect(move).toBeTruthy();

    const beforeHash = hashState(state);
    const res = applyMoveWithSync(state, move as any);

    expect(res.afterHash).toBe(hashState(res.nextState));
    expect(res.replayEntry.beforeHash).toBe(beforeHash);
    expect(res.replayEntry.afterHash).toBe(res.afterHash);
  });
});
