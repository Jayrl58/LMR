// src/ui/uiState.ts

// UI Loop v0 — minimal client-side model.
// NOTE: Updated to support multi-dice turn interaction (double-dice).

export type ConnectionModel = {
  connected: boolean;
  clientId?: string;
  roomCode?: string;
};

export type LobbyPlayerView = {
  playerId: string;
  clientId: string;
  seat: number;
  ready: boolean;
};

export type LobbyModel = {
  phase: "lobby" | "active";
  players: readonly LobbyPlayerView[];
  expectedPlayerCount?: number;
};

export type TurnInfo = {
  nextActorId: string;
  dicePolicy: "external";
  awaitingDice: boolean;
};

export type GameModel = {
  // Parsed game state from stateSync (shape owned by server/engine).
  gameState?: unknown;
  stateHash?: string;
  turn?: TurnInfo;
};

export type TurnInteractionModel = {
  // Multi-dice capable: in single-die mode this will typically be [die].
  selectedDice?: number[];
  legalMoves?: readonly unknown[];
  lastMoveResult?: unknown;
  lastError?: { code: string; message: string };
};

export type UiModel = {
  connection: ConnectionModel;
  lobby: LobbyModel;
  game: GameModel;
  turnInteraction: TurnInteractionModel;

  // Derived mapping: local actor is determined by seat mapping.
  localSeat?: number;
  localActorId?: string;
};

// Minimal initial state (safe, conservative)
export const initialUiModel: UiModel = {
  connection: { connected: false },
  lobby: { phase: "lobby", players: [] },
  game: {},
  turnInteraction: {},
};
