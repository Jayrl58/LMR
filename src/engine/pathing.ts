import type { GameState, PlayerId, SpotRef } from "../types";

/**
 * Canonical arm template offsets within a player's 14-spot arm segment.
 * (per your locked geometry notes)
 *
 * home corner: +4
 * home entry : +6   (when your peg is on this track index, next step MUST go to home[0])
 * 1-spot     : +8   (base entry on roll=1)
 * point      : +13  (base entry on roll=6)
 */
const ARM_LEN = 14;
const OFF_HOME_ENTRY = 6;
const OFF_ONE_SPOT = 8;
const OFF_POINT = 13;

function makeTrack(index: number): SpotRef {
  return { zone: "track", index } as any;
}
function makeHome(owner: PlayerId, index: number): SpotRef {
  return { zone: "home", owner, index } as any;
}
function makeBase(owner: PlayerId, index: number): SpotRef {
  return { zone: "base", owner, index } as any;
}

/**
 * Determine seat index for a player (0..N-1).
 * Prefers explicit ordering from state if present; otherwise parses p0/p1/...; otherwise falls back to 0.
 */
function getSeatIndex(state: GameState, playerId: PlayerId): number {
  const anyState: any = state as any;

  const order: PlayerId[] | undefined =
    anyState.turnOrder ??
    anyState.playerOrder ??
    anyState.players?.map((p: any) => p.id) ??
    anyState.turn?.order;

  if (Array.isArray(order)) {
    const idx = order.indexOf(playerId);
    if (idx >= 0) return idx;
  }

  // common pattern: "p0", "p1", ...
  const m = String(playerId).match(/\d+$/);
  if (m) return Number(m[0]);

  return 0;
}

/**
 * Track length: prefer explicit config; otherwise derive from player count * ARM_LEN.
 */
function getTrackLength(state: GameState): number {
  const anyState: any = state as any;

  const direct =
    anyState.trackLength ??
    anyState.board?.trackLength ??
    anyState.board?.track?.length ??
    anyState.track?.length;

  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) return direct;

  const playerCount =
    anyState.playerCount ??
    anyState.players?.length ??
    anyState.turnOrder?.length ??
    anyState.playerOrder?.length ??
    0;

  if (typeof playerCount === "number" && playerCount > 0) return playerCount * ARM_LEN;

  // safe fallback: 8 players * 14
  return 8 * ARM_LEN;
}

function normTrackIndex(i: number, len: number): number {
  const x = i % len;
  return x < 0 ? x + len : x;
}

function seatBaseOffset(state: GameState, playerId: PlayerId): number {
  return getSeatIndex(state, playerId) * ARM_LEN;
}

function homeEntryTrackIndex(state: GameState, playerId: PlayerId): number {
  return normTrackIndex(seatBaseOffset(state, playerId) + OFF_HOME_ENTRY, getTrackLength(state));
}

function baseEntryTrackIndex(state: GameState, playerId: PlayerId, roll: number): number {
  const off = roll === 1 ? OFF_ONE_SPOT : OFF_POINT; // roll 6 -> Point (canonical)
  return normTrackIndex(seatBaseOffset(state, playerId) + off, getTrackLength(state));
}

/**
 * Extract peg position in a tolerant way (supports several state shapes).
 */
function getPegPosition(state: GameState, playerId: PlayerId, pegIndex: number): SpotRef | undefined {
  const anyState: any = state as any;

  // common: state.pegStates[playerId][pegIndex] = { pos: SpotRef, isFinished?: boolean }
  const pegStates = anyState.pegStates?.[playerId];
  if (Array.isArray(pegStates) && pegStates[pegIndex]) {
    const ps = pegStates[pegIndex];
    return (ps.pos ?? ps.at ?? ps.location ?? ps.spot ?? ps) as SpotRef;
  }

  // common: state.players[] contains pegs
  const players = anyState.players;
  if (Array.isArray(players)) {
    const p = players.find((x: any) => x?.id === playerId);
    const pegs = p?.pegs ?? p?.pegStates;
    if (Array.isArray(pegs) && pegs[pegIndex]) {
      const ps = pegs[pegIndex];
      return (ps.pos ?? ps.at ?? ps.location ?? ps.spot ?? ps) as SpotRef;
    }
  }

  // fallback: treat as in base
  return makeBase(playerId, pegIndex);
}

function isPegFinished(state: GameState, playerId: PlayerId, pegIndex: number): boolean {
  const anyState: any = state as any;

  const pegStates = anyState.pegStates?.[playerId];
  if (Array.isArray(pegStates) && pegStates[pegIndex]) return Boolean(pegStates[pegIndex].isFinished);

  const players = anyState.players;
  if (Array.isArray(players)) {
    const p = players.find((x: any) => x?.id === playerId);
    const pegs = p?.pegs ?? p?.pegStates;
    if (Array.isArray(pegs) && pegs[pegIndex]) return Boolean(pegs[pegIndex].isFinished);
  }

  return false;
}

/**
 * Build the routed movement path for an "advance" given a roll.
 *
 * Path convention:
 * - path[0] is the origin spot
 * - path[path.length-1] is the landing spot
 * - returns null if move is impossible/illegal at the routing level (overshoot home, invalid base exit)
 *
 * Legality checks like "blocked by own peg" should be applied by legalMoves.ts.
 */
export function buildRoutedPath(
  state: GameState,
  actorPlayerId: PlayerId,
  pegIndex: number,
  roll: number
): SpotRef[] | null {
  if (!Number.isFinite(roll) || roll <= 0) return null;
  if (isPegFinished(state, actorPlayerId, pegIndex)) return null;

  const from = getPegPosition(state, actorPlayerId, pegIndex);
  if (!from) return null;

  const trackLen = getTrackLength(state);
  const actorHomeEntry = homeEntryTrackIndex(state, actorPlayerId);

  // Base exit: ONLY roll 1 or 6
  if (from.zone === "base") {
    if (roll !== 1 && roll !== 6) return null;

    const entry = makeTrack(baseEntryTrackIndex(state, actorPlayerId, roll));
    return [from, entry];
  }

  const path: SpotRef[] = [from];
  let cur: SpotRef = from;

  for (let step = 0; step < roll; step++) {
    // Forced home turn only applies to the actor on THEIR home-entry track spot
    if (cur.zone === "track" && cur.index === actorHomeEntry) {
      cur = makeHome(actorPlayerId, 0);
      path.push(cur);
      continue;
    }

    if (cur.zone === "track") {
      cur = makeTrack(normTrackIndex(cur.index + 1, trackLen));
      path.push(cur);
      continue;
    }

    if (cur.zone === "home") {
      // Home is a 0..3 lane; overshoot is illegal
      const nextIndex = cur.index + 1;
      if (nextIndex > 3) return null;
      cur = makeHome(actorPlayerId, nextIndex);
      path.push(cur);
      continue;
    }

    // Unknown zone: treat as invalid
    return null;
  }

  return path;
}
