// src/engine/legalMoves.ts

import type { Capture, GameState, Move, PegIndex, PlayerId, SpotRef } from "../types";
import { ARM_LENGTH, BASE_ENTRY_ROLLS, normalizeTrackIndex, trackLengthForPlayerCount } from "./constants";
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

function trackLengthForState(state: GameState): number {
  return trackLengthForPlayerCount(state.config.playerCount);
}

function pointIndicesForBoard(state: GameState): number[] {
  const arms = boardArmCountFor(state);
  const trackLength = trackLengthForState(state);
  const points: number[] = [];
  for (let seat = 0; seat < arms; seat++) {
    const entryIdx = seat * ARM_LENGTH;
    points.push(normalizeTrackIndex(entryIdx + 13, trackLength));
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
  actor: PlayerId,
  trackLength: number
): SpotRef[] {
  const path: SpotRef[] = [{ zone: "track", index: normalizeTrackIndex(startIdx, trackLength) }];
  let idx = normalizeTrackIndex(startIdx, trackLength);
  let inHome = false;
  let homePos: 0 | 1 | 2 | 3 = 0;

  for (let s = 1; s <= steps; s++) {
    if (!inHome) {
      if (idx === homeEntryIdx) {
        inHome = true;
        homePos = 0;
        path.push({ zone: "home", playerId: actor, index: homePos });
      } else {
        idx = normalizeTrackIndex(idx + 1, trackLength);
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

/* ---------- CENTER MOVES ---------- */

function listEnterCenterMoves(state: GameState, actor: PlayerId, steps: number): Move[] {
  if (steps !== 1) return [];

  const pointIdxs = pointIndicesForBoard(state);
  const moves: Move[] = [];

  for (const peg of state.pegStates[actor]) {
    if (peg.position.zone !== "track") continue;
    if (!pointIdxs.includes(peg.position.index)) continue;

    const to: SpotRef = { zone: "center" };

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
      die: 1, // ✅ added
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
        die: 1, // ✅ added
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

export function listLegalMovesForPlayer(
  state: GameState,
  actorPlayerId: PlayerId,
  dice: readonly number[]
): Move[] {
  const steps = typeof dice?.[0] === "number" ? dice[0] : NaN;
  if (!Number.isFinite(steps)) return [];

  const moves: Move[] = [];
  const pegs = state.pegStates[actorPlayerId];
  const trackLength = trackLengthForState(state);

  const entryIdx = getTrackEntryIndex(state, actorPlayerId);
  const homeEntryIdx = getHomeEntryTrackIndex(state, actorPlayerId);

  moves.push(...listEnterCenterMoves(state, actorPlayerId, steps));
  moves.push(...listExitCenterMoves(state, actorPlayerId, steps));

  if (steps === 6 || BASE_ENTRY_ROLLS.includes(steps)) {
    const destIdx =
      steps === 6
        ? normalizeTrackIndex(entryIdx + 13, trackLength)
        : normalizeTrackIndex(entryIdx + 8, trackLength);

    for (const peg of pegs) {
      if (peg.position.zone !== "base") continue;

      const to: SpotRef = { zone: "track", index: destIdx };

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
        die: steps, // ✅ added
        from: { zone: "base", playerId: actorPlayerId },
        to,
        path: [{ zone: "base", playerId: actorPlayerId }, to],
        captures,
      });
    }
  }

  for (const peg of pegs) {
    if (peg.position.zone === "base") continue;
    if (peg.position.zone === "center") continue;

    let path: SpotRef[];

    if (peg.position.zone === "track") {
      path = buildTrackPathFrom(peg.position.index, steps, homeEntryIdx, actorPlayerId, trackLength);
    } else {
      const start = peg.position.index;
      path = [{ ...peg.position }];
      let cur = start;
      for (let s = 1; s <= steps; s++) {
        cur = (cur + 1) as 0 | 1 | 2 | 3;
        path.push({ zone: "home", playerId: actorPlayerId, index: cur });
      }
    }

    const from = peg.position;
    const to = path[path.length - 1];

    if (from.zone === "home" && to.zone === "home") {
      if (from.index + steps > 3) continue;
    }

    if (isOwnPegBlocking(state, actorPlayerId, path)) continue;

    const landingOcc = findOccupant(state, to);
    if (landingOcc && landingOcc.playerId === actorPlayerId) continue;
    if (to.zone === "home" && landingOcc) continue;

    const captures: Capture[] = [];
    if (to.zone === "track" && landingOcc && landingOcc.playerId !== actorPlayerId) {
      captures.push(makeCapture(landingOcc.playerId, landingOcc.pegIndex));
    }

    moves.push({
      id: `adv:${actorPlayerId}:${peg.pegIndex}:${steps}`,
      kind: "advance",
      actorPlayerId,
      pegIndex: peg.pegIndex,
      die: steps, // ✅ added
      from,
      to,
      steps,
      path,
      captures,
    });
  }

  return moves;
}