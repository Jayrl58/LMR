import { describe, expect, it } from "vitest";

import type { GameState, PlayerId } from "../../src/types";
import { legalMoves } from "../../src/engine";

import { makeState, P } from "../helpers";

function isPlainObject(x: unknown): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function assertMoveShape(m: any) {
  expect(isPlainObject(m)).toBe(true);

  // Required top-level fields (as seen in probe output + scenario usage)
  expect(typeof m.id).toBe("string");
  expect(typeof m.kind).toBe("string");
  expect(typeof m.actorPlayerId).toBe("string");
  expect(typeof m.pegIndex).toBe("number");

  expect(isPlainObject(m.from)).toBe(true);
  expect(isPlainObject(m.to)).toBe(true);

  expect(Array.isArray(m.path)).toBe(true);
  expect(m.path.length).toBeGreaterThan(0);

  expect(Array.isArray(m.captures)).toBe(true);

  // Path invariants
  expect(m.path[0]).toEqual(m.from);
  expect(m.path[m.path.length - 1]).toEqual(m.to);
}

function idsOf(ms: any[]): string[] {
  return ms.map((m) => String(m.id));
}

function assertUniqueIds(ms: any[]) {
  const ids = idsOf(ms);
  const set = new Set(ids);
  expect(set.size).toBe(ids.length);
}

describe("Contract: legalMoves()", () => {
  it("returns an array of move objects with stable required fields and invariants", () => {
    const state = makeState({ playerCount: 2 });
    const A = P("p0") as PlayerId;

    const moves = legalMoves(state as any, A as any, [1] as any) as any[];
    expect(Array.isArray(moves)).toBe(true);

    // If there are moves, enforce shape. (Do not assume particular rules beyond shape.)
    for (const m of moves) assertMoveShape(m);

    // IDs should be unique within a single response
    assertUniqueIds(moves);

    // Determinism: repeated calls with same input should produce same ids (and order)
    const moves2 = legalMoves(state as any, A as any, [1] as any) as any[];
    expect(idsOf(moves2)).toEqual(idsOf(moves));

    // Actor invariants when moves exist
    for (const m of moves) {
      expect(m.actorPlayerId).toBe(A);
      expect(m.pegIndex).toBeGreaterThanOrEqual(0);
      expect(m.pegIndex).toBeLessThanOrEqual(3);
    }
  });

  it("accepts multi-die inputs (double-dice mode) and preserves move invariants", () => {
    const state = makeState({ playerCount: 2, doubleDice: true });
    const A = P("p0") as PlayerId;

    const moves = legalMoves(state as any, A as any, [1, 1] as any) as any[];
    expect(Array.isArray(moves)).toBe(true);

    for (const m of moves) assertMoveShape(m);
    assertUniqueIds(moves);

    // Determinism on same dice vector
    const moves2 = legalMoves(state as any, A as any, [1, 1] as any) as any[];
    expect(idsOf(moves2)).toEqual(idsOf(moves));
  });

  it("returns [] (or an array) without throwing for a non-current actor (turn/dice semantics: legalMoves is pure listing)", () => {
    const state = makeState({ playerCount: 2, currentSeat: 0 });
    const notCurrent = P("p1") as PlayerId;

    const moves = legalMoves(state as any, notCurrent as any, [1] as any) as any[];
    expect(Array.isArray(moves)).toBe(true);

    // If engine chooses to still enumerate, enforce shape; if it returns none, that's also fine.
    for (const m of moves) {
      assertMoveShape(m);
      expect(m.actorPlayerId).toBe(notCurrent);
    }
    assertUniqueIds(moves);
  });

  it("does not mutate the input state (contract: pure read)", () => {
    const state = makeState({ playerCount: 2 });
    const A = P("p0") as PlayerId;

    const before = JSON.stringify(state);
    void legalMoves(state as any, A as any, [1] as any);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
  });

  it("captures field is always present (even when empty) so server/UI can rely on it", () => {
    const state = makeState({ playerCount: 2 });
    const A = P("p0") as PlayerId;

    const moves = legalMoves(state as any, A as any, [1] as any) as any[];

    for (const m of moves) {
      expect(Array.isArray(m.captures)).toBe(true);
    }
  });
});
