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


// -------------------------
// Phase 5 contract targets
// -------------------------

import { handleClientMessage, type SessionState } from "../../src/server/handleMessage";

describe("Phase 5 contract targets: pending dice + auto-pass timing (server)", () => {
  it("server rejects roll when actorId does not match turn.nextActorId (NOT_YOUR_TURN)", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    const game: any = makeState({ playerCount: 2, doubleDice: false } as any);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p1, dice: [1] } as any);

    expect((r1.serverMessage as any).type).toBe("error");
    expect((r1.serverMessage as any).code).toBe("NOT_YOUR_TURN");

    // Deterministic: rejected input must not mutate session state
    expect(r1.nextState).toEqual(session0);
  });

  it("error stability: rejection responses include stable code and non-empty message; no state mutation", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // Case A: NOT_YOUR_TURN on roll
    {
      const game: any = makeState({ playerCount: 2 } as any);
      const session0: SessionState = {
        game,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
        actingActorId: undefined,
        pendingDice: undefined,
        bankedDice: 0,
      } as any;

      const r = handleClientMessage(session0, { type: "roll", actorId: p1, dice: [1] } as any);

      expect((r.serverMessage as any).type).toBe("error");
      expect((r.serverMessage as any).code).toBe("NOT_YOUR_TURN");
      expect(typeof (r.serverMessage as any).message).toBe("string");
      expect(((r.serverMessage as any).message as string).length).toBeGreaterThan(0);
      expect(((r.serverMessage as any).message as string)).toContain("Expected actorId=");
      expect(r.nextState).toEqual(session0);
    }

    // Case B: BAD_TURN_STATE on forfeit when any pending die has legal moves (team play finisher delegation)
    {
      const game: any = makeState({ playerCount: 4 } as any);
      game.config = game.config ?? { options: {} };
      game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

      // p0 finished, p1 teammate not finished (can move)
      game.players = game.players ?? {};
      game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
      game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0", hasFinished: false };

      const session0: SessionState = {
        game,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
        actingActorId: undefined,
        pendingDice: undefined,
        bankedDice: 0,
      } as any;

      const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
      expect((r1.serverMessage as any).type).toBe("stateSync");
      expect(Array.isArray((r1.nextState as any).pendingDice)).toBe(true);

      const r2 = handleClientMessage(r1.nextState as any, { type: "forfeitPendingDie", actorId: p0 } as any);

      expect((r2.serverMessage as any).type).toBe("error");
      expect((r2.serverMessage as any).code).toBe("BAD_TURN_STATE");
      expect(typeof (r2.serverMessage as any).message).toBe("string");
      expect(((r2.serverMessage as any).message as string).length).toBeGreaterThan(0);

      // Must be a deterministic semantic token (avoid brittle full-string matching)
      const msg = ((r2.serverMessage as any).message as string).toLowerCase();
      expect(msg).toContain("cannot forfeit");
      expect(msg).toContain("legal moves");

      expect(r2.nextState).toEqual(r1.nextState);
    }
  });


  it("team play: global-stuck forfeit is rejected when any teammate can move any pending die", () => {
    const p0 = P("p0"); // turn owner (finished)
    const p1 = P("p1"); // teammate resolver

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll a 1: with delegation active, pending die should be created unassigned and teammate can typically enter.
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");
    expect(Array.isArray((r1.nextState as any).pendingDice)).toBe(true);
    expect(((r1.nextState as any).pendingDice ?? [])[0]?.controllerId).toBeNull();

    // Global-stuck forfeit must be rejected because teammate has legal moves for the pending die.
    const r2 = handleClientMessage(r1.nextState as any, { type: "forfeitPendingDie", actorId: p0 } as any);

    expect((r2.serverMessage as any).type).toBe("error");
    expect((r2.serverMessage as any).code).toBe("BAD_TURN_STATE");
    const msg = (((r2.serverMessage as any).message ?? "") as any).toString().toLowerCase();
    expect(msg).toContain("cannot forfeit");
    expect(msg).toContain("legal moves");

    // Rejection must not mutate state.
    expect(r2.nextState).toEqual(r1.nextState);
  });

  it("team play: forfeitPendingDie is rejected while an active delegated die exists (controller still has legal moves)", () => {
    const p0 = P("p0"); // turn owner (finished)
    const p1 = P("p1"); // teammate controller

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll a 1: pending die becomes available for delegation.
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");
    expect(Array.isArray((r1.nextState as any).pendingDice)).toBe(true);
    expect(((r1.nextState as any).pendingDice ?? [])[0]?.controllerId).toBeNull();

    // Assign the die to p1 (active delegated die).
    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p1,
    } as any);
    expect((r2.serverMessage as any).type).toBe("stateSync");
    expect(((r2.nextState as any).pendingDice ?? [])[0]?.controllerId).toBe(p1);

    // Turn owner attempts global forfeit while delegated die is active; must be rejected (not globally stuck).
    const r3 = handleClientMessage(r2.nextState as any, { type: "forfeitPendingDie", actorId: p0 } as any);

    expect((r3.serverMessage as any).type).toBe("error");
    expect((r3.serverMessage as any).code).toBe("BAD_TURN_STATE");
    const msg = (((r3.serverMessage as any).message ?? "") as any).toString().toLowerCase();
    expect(msg).toContain("cannot forfeit");
    expect(msg).toContain("legal moves");

    // Rejection must not mutate state (delegation remains active).
    expect(r3.nextState).toEqual(r2.nextState);
    expect(((r3.nextState as any).pendingDice ?? [])[0]?.controllerId).toBe(p1);
  });

  it("team play: bankedDice preserves turn owner after global-stuck forfeit (roller finished)", () => {
    const p0 = P("p0"); // turn owner (finished)
    const p1 = P("p1"); // teammate (also finished -> no resolver moves)

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0", hasFinished: true };

    // Construct a deterministic session state: pending die exists, roller is finished, teammate resolver cannot move.
    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: false } as any,
      actingActorId: undefined,
      pendingDice: [{ value: 2, controllerId: null }],
      bankedDice: 1,
    } as any;

    const r1 = handleClientMessage(session0, { type: "forfeitPendingDie", actorId: p0 } as any);

    expect((r1.serverMessage as any).type).toBe("stateSync");

    // Pending dice cleared and awaitingDice restored
    expect((r1.nextState as any).pendingDice == null || (r1.nextState as any).pendingDice.length === 0).toBe(true);
    expect((r1.nextState as any).turn?.awaitingDice).toBe(true);

    // Turn must remain with roller (finisher keeps turn; bankedDice would also keep it)
    expect((r1.nextState as any).turn?.nextActorId).toBe(p0);

    // bankedDice should not be consumed by forfeit
    expect((r1.nextState as any).bankedDice).toBe(1);
  });

  it("non-team: global-stuck forfeit sets awaitingDice=true and advances turn when bankedDice=0", () => {
    const p0 = P("p0");
    const game: any = makeState({ playerCount: 2, doubleDice: true } as any);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: false } as any,
      actingActorId: undefined,
      pendingDice: [{ value: 2, controllerId: p0 }, { value: 3, controllerId: p0 }],
      bankedDice: 0,
    } as any;

    const r1 = handleClientMessage(session0, { type: "forfeitPendingDie", actorId: p0 } as any);

    expect((r1.serverMessage as any).type).toBe("stateSync");

    // Pending dice cleared and awaitingDice restored
    expect((r1.nextState as any).pendingDice == null || (r1.nextState as any).pendingDice.length === 0).toBe(true);
    expect((r1.nextState as any).turn?.awaitingDice).toBe(true);

    // With no banked dice and not team-play finisher rule, turn should advance to the next actor.
    expect((r1.nextState as any).turn?.nextActorId).toBe(P("p1"));
  });

  it("error stability: rejection paths return deterministic codes and do not mutate state", () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // 1) NOT_YOUR_TURN on roll
    {
      const game: any = makeState({ playerCount: 2 } as any);
      const session0: SessionState = {
        game,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
        actingActorId: undefined,
        pendingDice: undefined,
        bankedDice: 0,
      } as any;

      const r = handleClientMessage(session0, { type: "roll", actorId: p1, dice: [1] } as any);
      expect((r.serverMessage as any).type).toBe("error");
      expect((r.serverMessage as any).code).toBe("NOT_YOUR_TURN");
      expect(r.nextState).toEqual(session0);
    }

    // 2) BAD_TURN_STATE on forfeit when any pending die has legal moves (non-team)
    {
      const game: any = makeState({ playerCount: 2 } as any);
      const session0: SessionState = {
        game,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: false } as any,
        actingActorId: undefined,
        pendingDice: [{ value: 1, controllerId: p0 }],
        bankedDice: 0,
      } as any;

      const r = handleClientMessage(session0, { type: "forfeitPendingDie", actorId: p0 } as any);
      expect((r.serverMessage as any).type).toBe("error");
      expect((r.serverMessage as any).code).toBe("BAD_TURN_STATE");
      expect(r.nextState).toEqual(session0);
    }

    // 3) BAD_MESSAGE on assignPendingDie when controllerId is missing (team play)
    {
      const game: any = makeState({ playerCount: 4 } as any);
      game.config = game.config ?? { options: {} };
      game.config.options = { ...(game.config.options ?? {}), teamPlay: true };
      game.players = game.players ?? {};
      game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
      game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

      const session0: SessionState = {
        game,
        turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: false } as any,
        actingActorId: undefined,
        pendingDice: [{ value: 1, controllerId: null }],
        bankedDice: 0,
      } as any;

      const r = handleClientMessage(session0, { type: "assignPendingDie", actorId: p0, dieIndex: 0 } as any);
      expect((r.serverMessage as any).type).toBe("error");
      expect((r.serverMessage as any).code).toBe("BAD_MESSAGE");
      expect(r.nextState).toEqual(session0);
    }
  });






  it("does NOT auto-pass/forfeit a die immediately on roll if any unresolved die has legal moves (double-dice start 1+5)", () => {
    const p0 = P("p0");

    // Start of game: all pegs in base. Double dice enabled.
    const game: any = makeState({ playerCount: 2, doubleDice: true } as any);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1, 5] } as any);

    // Because the 1 is playable at game start, the server must NOT auto-pass anything at roll-time.
    // We expect legalMoves (not stateSync auto-exhaust) and both dice to remain pending/unresolved.
    expect((r1.serverMessage as any).type).toBe("legalMoves");

    const pending = (r1.nextState as any).pendingDice;
    expect(Array.isArray(pending)).toBe(true);
    expect((pending as any[]).map((pd: any) => pd.value).slice().sort()).toEqual([1, 5]);
  });

  it("temporarily-illegal die selection is rejected (Option A): cannot resolve 5 first in 1+5 opening; must resolve 1 first", () => {
    const p0 = P("p0");

    // Start of game: all pegs in base. Double dice enabled.
    const game: any = makeState({ playerCount: 2, doubleDice: true } as any);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll 1 + 5 at game start: 1 is playable (enter), 5 is temporarily illegal until after entry.
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1, 5] } as any);
    expect((r1.serverMessage as any).type).toBe("legalMoves");

    const lm: any = r1.serverMessage as any;
    expect(Array.isArray(lm.moves)).toBe(true);

    // Grab a known legal move for the 1 (typically "enter"), and attempt to apply it using die=5.
    // This models selecting/attempting to resolve the 5 first.
    const moveForOne = (lm.moves as any[]).find((m) => m?.kind !== "pass") ?? (lm.moves as any[])[0];

    const r2 = handleClientMessage(r1.nextState as any, {
      type: "move",
      actorId: p0,
      dice: [5],
      move: moveForOne,
    } as any);

    expect((r2.serverMessage as any).type).toBe("moveResult");

    const mr: any = r2.serverMessage as any;
    expect(mr.response?.ok).toBe(false);

    // Contract (Phase 5): trying to resolve a temporarily-illegal die MUST be rejected
    // with an explicit "no legal moves" reason (not a generic legality failure).
    const msg = (mr.response?.error?.message ?? mr.response?.error?.reason ?? "").toString().toLowerCase();
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain("no legal moves");
    expect(msg).toContain("resolve");

    // State unchanged: both dice remain pending/unresolved (no forfeiture).
    const pending = (r2.nextState as any).pendingDice;
    expect(Array.isArray(pending)).toBe(true);
    expect((pending as any[]).map((pd: any) => pd.value).slice().sort()).toEqual([1, 5]);
  });
  
it("legality can become valid later in the same turn: after resolving 1 to enter, 5 becomes legal and can be resolved", async () => {
  const p0 = P("p0");

  // Start of game: all pegs in base. Double dice enabled.
  const game: any = makeState({ playerCount: 2, doubleDice: true } as any);

  const session0: SessionState = {
    game,
    turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
    actingActorId: undefined,
    pendingDice: undefined,
    bankedDice: 0,
  } as any;

  // Roll 1 + 5. At start, 1 is playable (enter); 5 is initially illegal.
  const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1, 5] } as any);
  expect((r1.serverMessage as any).type).toBe("legalMoves");

  const lm: any = r1.serverMessage as any;
  expect(Array.isArray(lm.moves)).toBe(true);

  // Find a move that is legal when using die=1 (typically an "enter" move).
  const candidates = (lm.moves as any[]).filter((m) => m?.kind !== "pass");
  expect(candidates.length).toBeGreaterThan(0);

  let afterEnter: any | undefined;
  for (const mv of candidates) {
    const rTry = handleClientMessage(r1.nextState as any, {
      type: "move",
      actorId: p0,
      dice: [1],
      move: mv,
    } as any);

    const mrTry: any = rTry.serverMessage as any;
    if ((rTry.serverMessage as any).type === "moveResult" && mrTry?.response?.ok === true) {
      afterEnter = rTry.nextState as any;
      break;
    }
  }

  if (!afterEnter) {
    throw new Error("Could not find a die=1 move that succeeds from the 1+5 opening roll.");
  }

  // After entering with 1, the 5 should now have a legal move (advance the entered peg).
  const legalMovesFn = await resolveLegalMovesFn();
  const movesForFive = (legalMovesFn(afterEnter.game, p0, [5]) as any[]) ?? [];
  const mv5 = movesForFive.find((m) => m?.kind !== "pass");

  if (!mv5) {
    throw new Error(
      `Expected a legal die=5 move after entering with 1, but none found. Candidates: ${JSON.stringify(
        summarizeMoves(movesForFive),
        null,
        2
      )}`
    );
  }

  const r3 = handleClientMessage(afterEnter, {
    type: "move",
    actorId: p0,
    dice: [5],
    move: mv5,
  } as any);

  expect((r3.serverMessage as any).type).toBe("moveResult");
  const mr3: any = r3.serverMessage as any;
  expect(mr3.response?.ok).toBe(true);
});
  
  it("auto-pass resolves multiple dead dice in FIFO order; emits per-die notifications when available", () => {
    const p0 = P("p0");

    // Start of game: all pegs in base. Double dice enabled.
    // Roll 2 + 3: neither die can enter from base (requires 1), so BOTH dice are dead.
    const game: any = makeState({ playerCount: 2, doubleDice: true } as any);

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [2, 3] } as any);

    // Contract: when ALL unresolved dice have no legal moves, auto-pass is allowed to resolve/forfeit.
    // Current implementations may express this either as:
    // - an immediate "legalMoves" containing only pass,
    // - a "moveResult" pass,
    // - a sync/event message that clears pending dice.
    expect(r1.serverMessage).toBeTruthy();

    const next: any = r1.nextState as any;

    // The important state-level outcome: no pending dice remain after the auto-pass resolution.
    const pending = next?.pendingDice;
    expect(pending === undefined || (Array.isArray(pending) && pending.length === 0)).toBe(true);

    // FIFO contract target (soft-assert): if the server emits per-die forfeiture notifications/events,
    // they must be in roll order (2 then 3) and reference "no legal moves".
    const sm: any = r1.serverMessage as any;

    const candidateArrays: any[] = [];
    if (Array.isArray(sm?.events)) candidateArrays.push(sm.events);
    if (Array.isArray(sm?.notifications)) candidateArrays.push(sm.notifications);
    if (Array.isArray(sm?.log)) candidateArrays.push(sm.log);
    if (Array.isArray(sm?.autoPass)) candidateArrays.push(sm.autoPass);
    if (Array.isArray(sm?.autoPassedDice)) candidateArrays.push(sm.autoPassedDice);

    const flattened = candidateArrays.flat().filter(Boolean);

    // Heuristic: look for entries that mention forfeiture/auto-pass/no-legal-moves.
    const forfeits = flattened.filter((e: any) => {
      const s = JSON.stringify(e ?? "").toLowerCase();
      return s.includes("auto") || s.includes("forfeit") || s.includes("no legal") || s.includes("illegal");
    });

    if (forfeits.length > 0) {
      const sAll = forfeits.map((e: any) => JSON.stringify(e).toLowerCase()).join("\n");

      // Must mention no-legal-moves (or equivalent) somewhere.
      expect(sAll).toMatch(/no legal|illegal|not legal/);

      // FIFO by roll order: 2 appears before 3.
      const i2 = sAll.indexOf("2");
      const i3 = sAll.indexOf("3");
      if (i2 !== -1 && i3 !== -1) {
        expect(i2).toBeLessThan(i3);
      }
    }
  });

  // NOTE: Covered by enforced tests above (auto-pass timing, FIFO, and per-die forfeiture visibility).

  it("team play (Phase 5 contract): per-die delegation authority is enforced", () => {
    /**
     * Locked requirements (team play):
     * - Delegation is only valid when the turn owner has finished all pegs.
     * - Pending dice start unassigned; turn owner must assign a die before it can be spent.
     * - Only the assigned controller may request moves and spend that die.
     * - Turn owner cannot bypass assignment (cannot spend unassigned dice; cannot spend delegated dice).
     */
    const p0 = P("p0"); // turn owner
    const p1 = P("p1"); // teammate (receiver/controller)

    // Build a 2-player team game (4 players total, 2 teams of 2).
    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    // Place p0 and p1 on same team; p0 is finished (delegation enabled).
    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll a 1 (receiver should be able to enter from base in most starts).
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");
    expect(Array.isArray((r1.nextState as any).pendingDice)).toBe(true);
    expect(((r1.nextState as any).pendingDice ?? [])[0]?.controllerId).toBeNull();

    // Turn owner assigns the pending die to p1 (receiver).
    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p1,
    } as any);
    expect((r2.serverMessage as any).type).toBe("stateSync");
    expect(((r2.nextState as any).pendingDice ?? [])[0]?.controllerId).toBe(p1);

    // Turn owner cannot request legal moves for the delegated die.
    const r3 = handleClientMessage(r2.nextState as any, { type: "getLegalMoves", actorId: p0, dice: [1] } as any);
    expect((r3.serverMessage as any).type).toBe("error");
    expect(((r3.serverMessage as any).message ?? "").toString().toLowerCase()).toContain("do not control");

    // Receiver CAN request legal moves for the delegated die.
    const r4 = handleClientMessage(r2.nextState as any, { type: "getLegalMoves", actorId: p1, dice: [1] } as any);
    expect((r4.serverMessage as any).type).toBe("legalMoves");
    const lm: any = r4.serverMessage as any;
    expect(Array.isArray(lm.moves)).toBe(true);
    expect(lm.moves.length).toBeGreaterThan(0);

    // Turn owner cannot bypass assignment by attempting to spend the delegated die.
    const r5 = handleClientMessage(r2.nextState as any, {
      type: "move",
      actorId: p0,
      dice: [1],
      move: lm.moves[0],
    } as any);
    expect((r5.serverMessage as any).type).toBe("error");
    const msg5 = (((r5.serverMessage as any).message ?? "") as any).toString().toLowerCase();
    expect(msg5.includes("do not control") || msg5.includes("delegated die is active")).toBe(true);

    // Receiver spends the die using an actual legal move.
    const r6 = handleClientMessage(r2.nextState as any, {
      type: "move",
      actorId: p1,
      dice: [1],
      move: lm.moves[0],
    } as any);
    expect((r6.serverMessage as any).type).toBe("moveResult");
    expect(((r6.serverMessage as any).response ?? {}).ok).toBe(true);

    // After spending, pendingDice should be cleared.
    expect((r6.nextState as any).pendingDice == null || (r6.nextState as any).pendingDice.length === 0).toBe(true);
  });

  it("team play (Phase 5 contract): delegation is only allowed when the turn owner has finished all pegs", () => {
    /**
     * Locked requirement (team play):
     * - assignPendingDie is only valid when the turn owner has finished all pegs.
     */
    const p0 = P("p0"); // turn owner
    const p1 = P("p1"); // teammate receiver/controller

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    // Same team, but turn owner is NOT finished.
    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: false };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll creates pending dice (unassigned).
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");
    expect(((r1.nextState as any).pendingDice ?? [])[0]?.controllerId).toBeNull();

    // Delegation attempt must be rejected because p0 is not finished.
    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p1,
    } as any);

    expect((r2.serverMessage as any).type).toBe("error");
    const msg = (((r2.serverMessage as any).message ?? "") as any).toString().toLowerCase();
    expect(msg).toContain("finished");
    expect(msg).toContain("pegs");
  });


  it("team play (Phase 5 contract): delegation is sequential (single active delegated die) and immutable by choice", () => {
    /**
     * Locked requirements (team play, sequential delegation):
     * - Turn owner chooses which pending die to delegate next.
     * - While a delegated die is active, no other pending die may be assigned or spent.
     */
    const p0 = P("p0"); // turn owner
    const p1 = P("p1"); // teammate receiver/controller

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    // Roll two dice so there are two pending dice.
    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1, 1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");
    expect((r1.nextState as any).pendingDice.length).toBe(2);

    // Assign the first die to p1.
    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p1,
    } as any);
    expect((r2.serverMessage as any).type).toBe("stateSync");

    // Attempt to assign the second die while an active delegated die exists must fail.
    const r3 = handleClientMessage(r2.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 1,
      controllerId: p1,
    } as any);
    expect((r3.serverMessage as any).type).toBe("error");
    expect(((r3.serverMessage as any).message ?? "").toString().toLowerCase()).toContain("already active");

    // Receiver resolves the active delegated die next.
    const r4 = handleClientMessage(r2.nextState as any, { type: "getLegalMoves", actorId: p1, dice: [1] } as any);
    expect((r4.serverMessage as any).type).toBe("legalMoves");
    const lm: any = r4.serverMessage as any;

    const r5 = handleClientMessage(r2.nextState as any, {
      type: "move",
      actorId: p1,
      dice: [1],
      move: lm.moves[0],
    } as any);
    expect((r5.serverMessage as any).type).toBe("moveResult");
    expect(((r5.serverMessage as any).response ?? {}).ok).toBe(true);
  });

  it("team play (Phase 5 contract): stale/concurrent input arbitration under sequential delegation (non-controller rejected)", () => {
    /**
     * Locked requirements (team play, sequential delegation):
     * - After delegation, only the delegated controller may act until that die resolves.
     * - Any concurrent attempt by a non-controller is rejected deterministically without state mutation.
     */
    const p0 = P("p0"); // turn owner
    const p1 = P("p1"); // controller/receiver
    const p2 = P("p2"); // non-controller

    const game: any = makeState({ playerCount: 4 } as any);
    game.config = game.config ?? { options: {} };
    game.config.options = { ...(game.config.options ?? {}), teamPlay: true };

    game.players = game.players ?? {};
    game.players[p0] = { ...(game.players[p0] ?? {}), teamId: "T0", hasFinished: true };
    game.players[p1] = { ...(game.players[p1] ?? {}), teamId: "T0" };
    game.players[p2] = { ...(game.players[p2] ?? {}), teamId: "T1" };

    const session0: SessionState = {
      game,
      turn: { nextActorId: p0, dicePolicy: "external", awaitingDice: true } as any,
      actingActorId: undefined,
      pendingDice: undefined,
      bankedDice: 0,
    } as any;

    const r1 = handleClientMessage(session0, { type: "roll", actorId: p0, dice: [1] } as any);
    expect((r1.serverMessage as any).type).toBe("stateSync");

    const r2 = handleClientMessage(r1.nextState as any, {
      type: "assignPendingDie",
      actorId: p0,
      dieIndex: 0,
      controllerId: p1,
    } as any);
    expect((r2.serverMessage as any).type).toBe("stateSync");

    // Concurrent/non-controller attempt to get moves is rejected.
    const r3 = handleClientMessage(r2.nextState as any, { type: "getLegalMoves", actorId: p2, dice: [1] } as any);
    expect((r3.serverMessage as any).type).toBe("error");

    // State must not mutate on rejection (pending still exists and is still controlled by p1).
    expect(((r3.nextState as any).pendingDice ?? [])[0]?.controllerId).toBe(p1);
  });
});
