import { describe, it, expect } from "vitest";
import { legalMoves, tryApplyMoveWithResponse } from "../src/engine";
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

describe("tryApplyMoveWithResponse", () => {
  it("returns ok:true for a legal move (includes turn context)", () => {
    const pid = P("p0");
    let state = makeState({ playerCount: 2 });

    const len = getTrackLen(state);
    const homeEntry = getHomeEntryTrackIndex(state, pid);

    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);

    state = setPeg(state, pid, 0, makeTrack(start));

    const dice = [1] as const;
    const moves = legalMoves(state, pid, dice);
    const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
    expect(move).toBeTruthy();

    const res = tryApplyMoveWithResponse(state, pid, dice, move);

    expect(res.ok).toBe(true);
    if (res.ok) {
      // sync payload present
      expect(res.result.afterHash).toBeTruthy();
      expect(res.result.replayEntry.beforeHash).toBeTruthy();
      expect(res.result.replayEntry.afterHash).toBeTruthy();

      // TURN MODEL LOCK: Option C, same actor continues, dice external
      expect(res.turn.nextActorId).toBe(pid);
      expect(res.turn.dicePolicy).toBe("external");
      expect(res.turn.awaitingDice).toBe(true);

      // Under this model, nextLegalMoves is intentionally NOT returned.
      expect((res as any).nextLegalMoves).toBeUndefined();
    }
  });

  it("returns ok:false for an illegal move", () => {
    const pid = P("p0");
    const state = makeState({ playerCount: 2 });

    const dice = [2] as const;

    const illegalMove = { kind: "advance", actorPlayerId: pid, pegIndex: 0, steps: 99 };

    const res = tryApplyMoveWithResponse(state, pid, dice, illegalMove);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("ILLEGAL_MOVE");
    }
  });
});
