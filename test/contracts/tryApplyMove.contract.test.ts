import { describe, it, expect } from "vitest";

import { makeState, setPeg, findPeg, P } from "../helpers";
import { legalMoves } from "../../src/engine";

type TryApplyFn = (...args: any[]) => any | Promise<any>;

async function resolveTryApplyMoveWithResponse(): Promise<TryApplyFn> {
  const mod: any = await import("../../src/engine/tryApply");
  const fn = mod?.tryApplyMoveWithResponse;
  if (typeof fn !== "function") {
    throw new Error(
      `Could not resolve tryApplyMoveWithResponse from src/engine/tryApply. Found keys: ${Object.keys(
        mod ?? {}
      ).join(", ")}`
    );
  }
  return fn as TryApplyFn;
}

function isPlainObject(x: any): boolean {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function summarizeMoves(moves: any[]) {
  return moves.map((m) => ({
    id: m?.id,
    kind: m?.kind,
    actorPlayerId: m?.actorPlayerId,
    pegIndex: m?.pegIndex,
    from: m?.from,
    to: m?.to,
    capturesLen: Array.isArray(m?.captures) ? m.captures.length : undefined,
  }));
}

async function callTryApplyAuto(
  fn: TryApplyFn,
  state: any,
  actorPlayerId: any,
  dice: number[],
  move: any
): Promise<any> {
  // Try a small set of plausible signatures. Keep this list short and deterministic.
  const attempts: { name: string; args: any[] }[] = [
    { name: "fn(state, move)", args: [state, move] },
    { name: "fn(state, actor, dice, move)", args: [state, actorPlayerId, dice, move] },
    {
      name: "fn(state, { actorPlayerId, dice, move })",
      args: [state, { actorPlayerId, dice, move }],
    },
    {
      name: "fn({ game: state }, move)",
      args: [{ game: state }, move],
    },
    {
      name: "fn({ game: state }, { actorPlayerId, dice, move })",
      args: [{ game: state }, { actorPlayerId, dice, move }],
    },
  ];

  let lastRes: any = undefined;
  for (const a of attempts) {
    const res = await fn(...a.args);
    lastRes = res;
    if (res?.ok === true) return res;
  }

  // If nothing succeeded, return the last result so callers can throw with context.
  return lastRes;
}

async function applyFirstOkAuto(
  fn: TryApplyFn,
  state: any,
  actorPlayerId: any,
  dice: number[],
  moves: any[]
) {
  const candidates = moves.filter((m) => m && m.kind !== "pass");
  let last: any = undefined;

  for (const mv of candidates) {
    const res = await callTryApplyAuto(fn, state, actorPlayerId, dice, mv);
    last = res;
    if (res?.ok === true) return { mv, res };
  }

  throw new Error(
    `No non-pass move applied successfully.\n` +
      `Candidate moves: ${JSON.stringify(summarizeMoves(candidates), null, 2)}\n` +
      `Last response keys: ${JSON.stringify(Object.keys(last ?? {}))}\n` +
      `Last response: ${JSON.stringify(last ?? null, null, 2)}`
  );
}

function basePos(playerId: any) {
  return { zone: "base", playerId } as any;
}

describe("Contract: tryApplyMoveWithResponse()", () => {
  it("ok=true envelope: has result.nextState/afterHash/replayEntry; afterHash matches JSON.stringify(nextState); turn is present on success", async () => {
    const tryApplyMoveWithResponse = await resolveTryApplyMoveWithResponse();

    const state = makeState({ playerCount: 2 });
    const actor = P("p0");
    const dice = [1];

    const moves = legalMoves(state as any, actor as any, dice as any) as any[];
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);

    const { mv, res } = await applyFirstOkAuto(
      tryApplyMoveWithResponse,
      state as any,
      actor as any,
      dice,
      moves
    );

    // Envelope (success)
    expect(isPlainObject(res)).toBe(true);
    expect(res.ok).toBe(true);

    // Turn present on success (observed contract)
    expect(res.turn).toBeTruthy();
    expect(isPlainObject(res.turn)).toBe(true);
    expect(typeof res.turn.nextActorId).toBe("string");
    expect(typeof res.turn.dicePolicy).toBe("string");
    expect(typeof res.turn.awaitingDice).toBe("boolean");

    // Result shape
    expect(res.result).toBeTruthy();
    expect(isPlainObject(res.result)).toBe(true);
    for (const k of ["nextState", "afterHash", "replayEntry"]) {
      expect(res.result).toHaveProperty(k);
    }

    const nextState = res.result.nextState;
    const afterHash = res.result.afterHash;
    const replayEntry = res.result.replayEntry;

    expect(isPlainObject(nextState)).toBe(true);
    expect(typeof afterHash).toBe("string");
    expect(afterHash.length).toBeGreaterThan(0);

    // Current observed engine contract (probe): afterHash === JSON.stringify(nextState)
    expect(afterHash).toBe(JSON.stringify(nextState));

    // ReplayEntry minimal contract
    expect(isPlainObject(replayEntry)).toBe(true);
    expect(typeof replayEntry.beforeHash).toBe("string");
    expect(typeof replayEntry.afterHash).toBe("string");
    expect(replayEntry.afterHash).toBe(afterHash);
    expect(replayEntry.beforeHash).not.toBe(replayEntry.afterHash);

    // If replayEntry.move is present, it should correlate to the move applied
    if (replayEntry.move && typeof replayEntry.move.id === "string") {
      expect(replayEntry.move.id).toBe(mv.id);
    }
  });

  it("ok=false envelope: invalid move returns ok=false and includes an error object (turn may be absent on failure)", async () => {
    const tryApplyMoveWithResponse = await resolveTryApplyMoveWithResponse();

    const state = makeState({ playerCount: 2 });
    const actor = P("p0");
    const dice = [1];

    const moves = legalMoves(state as any, actor as any, dice as any) as any[];
    expect(moves.length).toBeGreaterThan(0);

    // Make an obviously invalid move by switching actorPlayerId
    const bad = { ...moves[0], actorPlayerId: P("p1") };

    // Use the same autodiscovery mechanism but we EXPECT failure.
    const res = await callTryApplyAuto(tryApplyMoveWithResponse, state, actor, dice, bad);

    expect(isPlainObject(res)).toBe(true);
    expect(typeof res.ok).toBe("boolean");
    expect(res.ok).toBe(false);

    const err = res.error ?? res.result?.error;
    expect(err).toBeTruthy();
    expect(isPlainObject(err)).toBe(true);
  });

  it("replay invariants: replayEntry.move exists and replay before/after differ on success", async () => {
    const tryApplyMoveWithResponse = await resolveTryApplyMoveWithResponse();

    const state = makeState({ playerCount: 2 });
    const actor = P("p0");
    const dice = [1];

    const moves = legalMoves(state as any, actor as any, dice as any) as any[];
    const { mv, res } = await applyFirstOkAuto(
      tryApplyMoveWithResponse,
      state as any,
      actor as any,
      dice,
      moves
    );

    expect(res.ok).toBe(true);
    expect(res.result?.replayEntry).toBeTruthy();

    const re = res.result.replayEntry;
    expect(typeof re.beforeHash).toBe("string");
    expect(typeof re.afterHash).toBe("string");
    expect(re.beforeHash).not.toBe(re.afterHash);

    expect(re.move).toBeTruthy();
    expect(isPlainObject(re.move)).toBe(true);

    if (typeof re.move.id === "string") {
      expect(re.move.id).toBe(mv.id);
    }
  });

  it("capture contract (minimal): when a legal move advertises captures, applying it returns ok=true and the captured peg is returned to base", async () => {
    const tryApplyMoveWithResponse = await resolveTryApplyMoveWithResponse();

    const A = P("p0");
    const B = P("p1");
    const dice = [1];

    // Discover A's entry destination index for roll=1 (no hardcoded topology).
    const s0 = makeState({ playerCount: 2 });
    const baseMoves = legalMoves(s0 as any, A as any, dice as any) as any[];
    const enter0 = baseMoves.find((m: any) => m.kind === "enter" && m.to?.zone === "track");
    expect(enter0).toBeTruthy();

    const destIdx = enter0.to.index as number;
    expect(typeof destIdx).toBe("number");

    // Place B peg on destination and ensure A peg is in base.
    let s1: any = s0;
    s1 = setPeg(s1, B, 0, ({ zone: "track", index: destIdx } as any));
    s1 = setPeg(s1, A, enter0.pegIndex, basePos(A));

    // Find an entry move that advertises captures.
    const moves = legalMoves(s1 as any, A as any, dice as any) as any[];
    const capMove = moves.find(
      (m: any) =>
        m.kind === "enter" &&
        m.pegIndex === enter0.pegIndex &&
        m.to?.zone === "track" &&
        m.to?.index === destIdx &&
        Array.isArray(m.captures) &&
        m.captures.length > 0
    );
    expect(capMove).toBeTruthy();

    const res = await callTryApplyAuto(tryApplyMoveWithResponse, s1, A, dice, capMove);

    expect(res?.ok).toBe(true);

    const next = res.result.nextState;

    const b0 = findPeg(next, B, 0);
    expect(b0.position?.zone).toBe("base");
    expect(b0.position?.playerId).toBe(B);
  });
});
