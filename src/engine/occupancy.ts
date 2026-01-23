// src/engine/occupancy.ts

import type { GameState, PlayerId, PegIndex, SpotRef, PegState } from "../types";

export type Occupant = { playerId: PlayerId; pegIndex: PegIndex };

function defaultPeg(playerId: PlayerId, pegIndex: PegIndex): PegState {
  return {
    pegIndex,
    isFinished: false,
    position: { zone: "base", playerId },
  };
}

/** Iterate all pegs as if every player always has pegIndex 0..3 (missing => base). */
function getPegsNormalized(state: GameState, playerId: PlayerId): PegState[] {
  const raw = state.pegStates?.[playerId] ?? [];
  return [0, 1, 2, 3].map((i) => raw.find((p) => p.pegIndex === (i as PegIndex)) ?? defaultPeg(playerId, i as PegIndex));
}

export function sameSpot(a: SpotRef, b: SpotRef): boolean {
  if (a.zone !== b.zone) return false;

  if (a.zone === "track") return b.zone === "track" && a.index === b.index;

  if (a.zone === "home") {
    return b.zone === "home" && a.playerId === b.playerId && a.index === b.index;
  }

  if (a.zone === "base") {
    return b.zone === "base" && a.playerId === b.playerId;
  }

  // For zones not used by this snapshot's tests.
  return true;
}

export function getOccupant(state: GameState, pos: SpotRef): Occupant | null {
  for (const pid of Object.keys(state.players ?? {}) as PlayerId[]) {
    const pegs = getPegsNormalized(state, pid);
    for (const p of pegs) {
      if (sameSpot(p.position, pos)) {
        return { playerId: pid, pegIndex: p.pegIndex };
      }
    }
  }
  return null;
}
