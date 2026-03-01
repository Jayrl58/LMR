// src/ui/uiTypes.ts

import type { PlayerId, TeamId, SpotRef, PegIndex } from "../types";

export interface UIPeg {
  playerId: PlayerId;
  pegIndex: PegIndex;
  position: SpotRef;
  isFinished: boolean;
}

export interface UIPlayer {
  playerId: PlayerId;
  displayName: string;
  seat: number;
  teamId?: TeamId;
  hasFinished: boolean;
}

export interface UITurnState {
  currentPlayerId: PlayerId;
  dice: readonly number[] | null;
}

export interface UIGameState {
  phase: "lobby" | "active" | "ended";
  players: readonly UIPlayer[];
  pegs: readonly UIPeg[];
  turn: UITurnState;
  finishedOrder: readonly PlayerId[];
  outcome?: {
    kind: "individual" | "team";
    winnerPlayerId?: PlayerId;
    winnerTeamId?: TeamId;
    winnerTeamPlayersInFinishOrder?: readonly PlayerId[];
  };
}