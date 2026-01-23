// src/engine/legalMoves.ts

import type { Capture, GameState, Move, PegIndex, PlayerId, SpotRef } from "../types";
import { BASE_ENTRY_ROLLS, normalizeTrackIndex } from "./constants";
import { getTrackEntryIndex } from "./boardMapping";
import { getHomeEntryTrackIndex } from "./homeMapping";
import { countFinishedPegs, findOccupant, spotsEqual } from "./stateUtils";

function makeCapture(victimPlayerId: PlayerId, victimPegIndex: PegIndex): Capture {
  return {
    victimPlayerId,
    victimPegIndex,
    sentTo: { zone: "base", playerId: victimPlayerId },
  };
}

function finishTargetIndex(finishedCount: number): 0 | 1 | 2 | 3 {
  return (3 - finishedCount) as 0 | 1 | 2 | 3;
}

function boardArmCountFor(state: GameState): 4 | 6 | 8 {
  const pc = state.config.playerCount;
  if (pc <= 4) return 4;
  if (pc <= 6) return 6;
  return 8;
}

// In this snapshot, seat->entry mapping is seat*14. (Matches current boardMapping placeholder.)
function pointIndicesForBoard(state: GameState): number[] {
  const arms = boardArmCountFor(state);
  const points: number[] = [];
  for (let seat = 0; seat < arms; seat++) {
    const entryIdx = seat * 14;
    points.push(normalizeTrackIndex(entryIdx + 13));
  }
  return points;
}

function isOwnPegBlocking(state: GameState, actor: PlayerId, path: readonly SpotRef[]): boolean {
  const ownPegs = state.pegStates[actor];
  for (let i = 1; i < path.length; i++) {
    const spot = path[i];
    for (const p of ownPegs) {
      if (spotsEqual(p.position, spot)) return true;
    }
  }
  return false;
}

function buildTrackPathFrom(
  startIdx: number,
  steps: number,
  homeEntryIdx: number,
  actor: PlayerId
): SpotRef[] {
  const path: SpotRef[] = [{ zone: "track", index: normalizeTrackIndex(startIdx) }];
  let idx = normalizeTrackIndex(startIdx);
  let inHome = false;
  let homePos: 0 | 1 | 2 | 3 = 0;

  for (let s = 1; s <= steps; s++) {
    if (!inHome) {
      if (idx === homeEntryIdx) {
        inHome = true;
        homePos = 0;
        path.push({ zone: "home", playerId: actor, index: homePos });
      } else {
        idx = normalizeTrackIndex(idx + 1);
        path.push({ zone: "track", index: idx });
      }
    } else {
      const next = (homePos + 1) as 0 | 1 | 2 | 3;
      homePos = next;
      path.push({ zone: "home", playerId: actor, index: homePos });
    }
  }

  return path;
}

/* ---------- CENTER MOVES (LMR) ---------- */
/*
- Enter center: roll=1 from ANY Point to center (captures occupant if another player).
- Exit center: roll=1 from center to ANY Point (captures occupant if another player).
- No "passing through" center on normal movement.
*/

function listEnterCenterMoves(state: GameState, actor: PlayerId, steps: number): Move[] {
  if (steps !== 1) return [];

  const pointIdxs = pointIndicesForBoard(state);
  const moves: Move[] = [];

  for (const peg of state.pegStates[actor]) {
    if (peg.position.zone !== "track") continue;
    if (!pointIdxs.includes(peg.position.index)) continue;

    const to: SpotRef = { zone: "center" };

    // Own peg already in center blocks entry.
    const ownBlocks = state.pegStates[actor].some((p) => spotsEqual(p.position, to));
    if (ownBlocks) continue;

    const captures: Capture[] = [];
    const occ = findOccupant(state, to);
    if (occ && occ.playerId !== actor) captures.push(makeCapture(occ.playerId, occ.pegIndex));

    moves.push({
      id: `enterCenter:${actor}:${peg.pegIndex}:1`,
      kind: "enterCenter",
      actorPlayerId: actor,
      pegIndex: peg.pegIndex,
      from: { zone: "track", index: peg.position.index },
      to: { zone: "center" },
      path: [{ zone: "track", index: peg.position.index }, { zone: "center" }],
      captures,
    });
  }

  return moves;
}

function listExitCenterMoves(state: GameState, actor: PlayerId, steps: number): Move[] {
  if (steps !== 1) return [];

  const pointIdxs = pointIndicesForBoard(state);
  const moves: Move[] = [];

  for (const peg of state.pegStates[actor]) {
    if (peg.position.zone !== "center") continue;

    for (const destIdx of pointIdxs) {
      const to: SpotRef = { zone: "track", index: destIdx };

      // Own peg on destination blocks exit.
      const ownBlocks = state.pegStates[actor].some((p) => spotsEqual(p.position, to));
      if (ownBlocks) continue;

      const captures: Capture[] = [];
      const occ = findOccupant(state, to);
      if (occ && occ.playerId !== actor) captures.push(makeCapture(occ.playerId, occ.pegIndex));

      moves.push({
        id: `exitCenter:${actor}:${peg.pegIndex}:${destIdx}:1`,
        kind: "exitCenter",
        actorPlayerId: actor,
        pegIndex: peg.pegIndex,
        from: { zone: "center" },
        to,
        path: [{ zone: "center" }, { zone: "track", index: destIdx }],
        captures,
      });
    }
  }

  return moves;
}

/* ---------- MAIN ---------- */

export function listLegalMoves(state: GameState, dice: readonly number[]): Move[] {
  return listLegalMovesForPlayer(state, state.turn.currentPlayerId, dice);
}

export function listLegalMovesForPlayer(
  state: GameState,
  actorPlayerId: PlayerId,
  dice: readonly number[]
): Move[] {
  const steps = typeof dice?.[0] === "number" ? dice[0] : NaN;
  if (!Number.isFinite(steps)) return [];

  const moves: Move[] = [];
  const pegs = state.pegStates[actorPlayerId];

  const entryIdx = getTrackEntryIndex(state, actorPlayerId);
  const homeEntryIdx = getHomeEntryTrackIndex(state, actorPlayerId);

  // Center moves
  moves.push(...listEnterCenterMoves(state, actorPlayerId, steps));
  moves.push(...listExitCenterMoves(state, actorPlayerId, steps));

  // ENTER moves (base -> track)
  if (steps === 6 || BASE_ENTRY_ROLLS.includes(steps)) {
    // LMR entry mapping (law):
    // - roll 1 enters on the player's 1 Spot (entryIdx + 8)
    // - roll 6 enters on the player's Point (entryIdx + 13)
    const destIdx =
      steps === 6
        ? normalizeTrackIndex(entryIdx + 13)
        : steps === 1
          ? normalizeTrackIndex(entryIdx + 8)
          : entryIdx; // fallback for any other entry roll (if ever enabled)

    for (const peg of pegs) {
      if (peg.position.zone !== "base") continue;

      const to: SpotRef = { zone: "track", index: destIdx };

      // Entry is blocked only by the player's own peg on the destination entry space.
      const ownBlocks = pegs.some((p) => spotsEqual(p.position, to));
      if (ownBlocks) continue;

      const captures: Capture[] = [];
      const occ = findOccupant(state, to);
      if (occ && occ.playerId !== actorPlayerId) captures.push(makeCapture(occ.playerId, occ.pegIndex));

      moves.push({
        id: `enter:${actorPlayerId}:${peg.pegIndex}:${steps}`,
        kind: "enter",
        actorPlayerId,
        pegIndex: peg.pegIndex,
        from: { zone: "base", playerId: actorPlayerId },
        to,
        path: [{ zone: "base", playerId: actorPlayerId }, to],
        captures,
      });
    }
  }

  // ADVANCE moves
  for (const peg of pegs) {
    if (peg.position.zone === "base") continue;

    // Center is not part of normal step-count movement in LMR.
    if (peg.position.zone === "center") continue;

    let path: SpotRef[];

    if (peg.position.zone === "track") {
      path = buildTrackPathFrom(peg.position.index, steps, homeEntryIdx, actorPlayerId);
    } else if (peg.position.zone === "home") {
      const start = peg.position.index;
      path = [{ ...peg.position }];
      let cur = start;

      for (let s = 1; s <= steps; s++) {
        const next = (cur + 1) as 0 | 1 | 2 | 3;
        cur = next;
        path.push({ zone: "home", playerId: actorPlayerId, index: cur });
      }
    } else {
      continue;
    }

    const from = peg.position;
    const to = path[path.length - 1];

    // Home bounds (cannot move beyond home[3])
    if (from.zone === "home" && to.zone === "home") {
      if (from.index + steps > 3) continue;
    }

    // Forced-home-entry blocking check (home[0] cannot be occupied when entering)
    let forcedHomeBlocked = false;
    for (let i = 1; i < path.length; i++) {
      const spot = path[i];
      if (spot.zone === "home" && spot.index === 0) {
        const occ = findOccupant(state, spot);
        if (occ) {
          forcedHomeBlocked = true;
          break;
        }
      }
    }
    if (forcedHomeBlocked) continue;

    // Own peg blocks anywhere in path (including landing)
    if (isOwnPegBlocking(state, actorPlayerId, path)) continue;

    const landingOcc = findOccupant(state, to);

    // Can't land on own peg (already covered by own-blocking; keep as guard)
    if (landingOcc && landingOcc.playerId === actorPlayerId) continue;

    // Home spaces cannot capture; must be empty to land.
    if (to.zone === "home" && landingOcc) continue;

    const captures: Capture[] = [];
    if (to.zone === "track") {
      if (landingOcc && landingOcc.playerId !== actorPlayerId) {
        captures.push(makeCapture(landingOcc.playerId, landingOcc.pegIndex));
      }
    }

    // Home finish gating (cannot overshoot the next finish slot)
    if (to.zone === "home") {
      const finishedCount = countFinishedPegs(state, actorPlayerId);
      const target = finishTargetIndex(finishedCount);
      if (to.index > target) continue;
    }

    moves.push({
      id: `adv:${actorPlayerId}:${peg.pegIndex}:${steps}`,
      kind: "advance",
      actorPlayerId,
      pegIndex: peg.pegIndex,
      from,
      to,
      steps,
      path,
      captures,
    });
  }

  return moves;
}
