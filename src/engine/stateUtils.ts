// src/engine/stateUtils.ts

import type { GameState, PlayerId, PegIndex, SpotRef, PegState } from "../types";

export function getPeg(state: GameState, playerId: PlayerId, pegIndex: PegIndex): PegState {
  const peg = state.pegStates[playerId].find((p) => p.pegIndex === pegIndex);
  if (!peg) throw new Error("peg not found");
  return peg;
}

export function spotsEqual(a: SpotRef, b: SpotRef): boolean {
  if (a.zone !== b.zone) return false;
  switch (a.zone) {
    case "base":
      return b.zone === "base" && b.playerId === a.playerId;
    case "track":
      return b.zone === "track" && b.index === a.index;
    case "home":
      return b.zone === "home" && b.playerId === a.playerId && b.index === a.index;
    case "center":
    case "blackhole":
      return true;
    default:
      return false;
  }
}

export function findOccupant(
  state: GameState,
  spot: SpotRef
): { playerId: PlayerId; pegIndex: PegIndex } | null {
  for (const [pid, pegs] of Object.entries(state.pegStates) as [PlayerId, readonly PegState[]][]) {
    for (const peg of pegs) {
      if (spotsEqual(peg.position, spot)) return { playerId: pid, pegIndex: peg.pegIndex };
    }
  }
  return null;
}

export function countFinishedPegs(state: GameState, playerId: PlayerId): number {
  return state.pegStates[playerId].filter((p) => p.isFinished).length;
}

export function shallowCloneState(state: GameState): GameState {
  // minimal cloning for tests
  return {
    ...state,
    players: { ...state.players },
    pegStates: { ...state.pegStates },
    finishedOrder: [...state.finishedOrder],
    turn: { ...state.turn, roll: state.turn.roll },
    config: { ...state.config, options: { ...state.config.options } },
    outcome: state.outcome ? { ...state.outcome } : undefined,
  };
}
