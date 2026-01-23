import { describe, expect, it } from "vitest";

import { tryApplyMoveWithResponse } from "../../src/engine/tryApply";
import { makeState, P } from "../helpers";

/**
 * Contract target (what we want to harden toward):
 * - ok=true: res.turn is REQUIRED and well-shaped
 * - ok=false: res.turn is IDEALLY present, but may not be implemented yet.
 *
 * This test is written to:
 * - adapt to current legal-moves export names (listLegalMoves / listLegalMovesForPlayer / legalMoves)
 * - adapt to current tryApplyMoveWithResponse signature (2-arg vs 4-arg style)
 * - pass today (turn optional on ok=false), while still validating turn if present
 */

function isPlainObject(x: any): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function summarizeMoves(moves: any[]) {
  return (moves ?? []).map((m) => ({
    id: m?.id,
    kind: m?.kind,
    pegIndex: m?.pegIndex,
    from: m?.from,
    to: m?.to,
    capturesLen: Array.isArray(m?.captures) ? m.captures.length : m?.capturesLen,
  }));
}

async function resolveLegalMovesFn(): Promise<(state: any, actorId: any, dice: number[]) => any[]> {
  const mod = await import("../../src/engine/legalMoves");
  const m: any = mod;

  // Common names we may have, by preference.
  const candidates = [
    "legalMoves",
    "listLegalMovesForPlayer",
    "listLegalMoves",
    "getLegalMoves",
  ];

  for (const k of candidates) {
    if (typeof m[k] === "function") {
      // Normalize return to array (some impls might return undefined/null)
      return (state: any, actorId: any, dice: number[]) => (m[k](state, actorId, dice) as any[]) ?? [];
    }
  }

  throw new Error(
    `Could not resolve legal-moves function from src/engine/legalMoves. Found keys: ${Object.keys(m).join(", ")}`
  );
}

async function applyWithResponse(state: any, actorId: any, dice: number[], mv: any) {
  // tryApplyMoveWithResponse has changed signatures over time; adapt:
  // - (state, mv)
  // - (state, actorId, dice, mv)
  // - (state, actorId, mv)  [rare]
  const fn: any = tryApplyMoveWithResponse as any;

  if (typeof fn !== "function") {
    throw new Error("tryApplyMoveWithResponse is not a function");
  }

  // Prefer most-specific shape first.
  if (fn.length >= 4) return await fn(state, actorId, dice, mv);
  if (fn.length === 3) return await fn(state, actorId, mv);
  return await fn(state, mv);
}

async function firstNonPassMove(state: any, actorId: any, dice: number[]) {
  const legalMovesFn = await resolveLegalMovesFn();
  const moves = (legalMovesFn(state, actorId, dice) as any[]) ?? [];
  const mv = moves.find((m) => m?.kind !== "pass");
  if (!mv) {
    throw new Error(
      `No non-pass moves found. Candidates: ${JSON.stringify(summarizeMoves(moves), null, 2)}`
    );
  }
  return mv;
}

function assertTurnShape(turn: any) {
  expect(isPlainObject(turn)).toBe(true);
  expect(typeof turn.nextActorId).toBe("string");
  expect(typeof turn.awaitingDice).toBe("boolean");
}

describe("Contract: turn + dice semantics via tryApplyMoveWithResponse()", () => {
  it("ok=true envelope: result.nextState/afterHash/replayEntry present; turn present", async () => {
    const A = P("p0");
    const state = makeState({ playerCount: 2 });
    const mv = await firstNonPassMove(state, A, [1]);

    const res: any = await applyWithResponse(state, A, [1], mv);

    // Must succeed on a legal move
    expect(isPlainObject(res)).toBe(true);
    expect(res.ok).toBe(true);

    // Envelope
    expect(isPlainObject(res.result)).toBe(true);
    expect(isPlainObject(res.result.nextState)).toBe(true);
    expect(typeof res.result.afterHash).toBe("string");
    expect(isPlainObject(res.result.replayEntry)).toBe(true);

    // Turn (required on success)
    assertTurnShape(res.turn);
  });

  it("replay invariants (minimal): replayEntry.move exists; replay before/after differ on success", async () => {
    const A = P("p0");
    const state = makeState({ playerCount: 2 });
    const mv = await firstNonPassMove(state, A, [1]);

    const res: any = await applyWithResponse(state, A, [1], mv);

    expect(res.ok).toBe(true);
    expect(isPlainObject(res.result?.replayEntry)).toBe(true);
    expect(isPlainObject(res.result?.replayEntry?.move)).toBe(true);

    // If present, we expect before/after to differ (some builds store hashes, some store state blobs)
    const before = res.result?.replayEntry?.before;
    const after = res.result?.replayEntry?.after;
    if (before !== undefined && after !== undefined) {
      expect(JSON.stringify(before)).not.toEqual(JSON.stringify(after));
    }
  });

  it("turn actor validity (on success): nextActorId is one of the configured players", async () => {
    const A = P("p0");
    const state = makeState({ playerCount: 2 });
    const mv = await firstNonPassMove(state, A, [1]);

    const res: any = await applyWithResponse(state, A, [1], mv);

    expect(res.ok).toBe(true);
    const nextActorId = res.turn?.nextActorId;
    expect(typeof nextActorId).toBe("string");

    // In 2p, we expect p0/p1 (helpers use p0/p1 ids)
    expect(["p0", "p1"]).toContain(nextActorId);
  });

  it("ok=false envelope: includes error; turn validated IF present", async () => {
    const A = P("p0");
    const state = makeState({ playerCount: 2 });

    // Deliberately bogus move
    const bogus = { kind: "advance", actorPlayerId: "p0", pegIndex: 0, spaces: 99 };

    const res: any = await applyWithResponse(state, A, [1], bogus);

    expect(isPlainObject(res)).toBe(true);
    expect(res.ok).toBe(false);
    expect(isPlainObject(res.error)).toBe(true);

    // Some builds do not include turn on ok=false yet; validate if present.
    if (res.turn !== undefined) {
      assertTurnShape(res.turn);
    }
  });
});
