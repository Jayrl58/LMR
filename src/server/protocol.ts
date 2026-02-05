// src/server/protocol.ts

export type PlayerId = string;
export type RoomCode = string;

/* =========================
 * Client → Server messages
 * ========================= */

export type ClientMessage =
  | HelloMessage
  | JoinRoomMessage
  | SetReadyMessage
  | SetLobbyGameConfigMessage
  | StartGameMessage
  | RollMessage
  | GetLegalMovesMessage
  | MoveMessage;

export interface HelloMessage {
  type: "hello";
  clientId?: string;
  reqId?: string;
}

export interface JoinRoomMessage {
  type: "joinRoom";
  roomCode?: RoomCode;
  claimPlayerId?: PlayerId;
  reqId?: string;
}

export interface SetReadyMessage {
  type: "setReady";
  ready: boolean;
  reqId?: string;
}

/**
 * Set lobby game configuration before startGame.
 * Server records this while phase==="lobby" and echoes it via lobbySync.
 */
export interface SetLobbyGameConfigMessage {
  type: "setLobbyGameConfig";
  gameConfig: LobbyGameConfig;
  reqId?: string;
}

/**
 * startGame now locks all game-creation options.
 * playerCount is still required for backward compatibility.
 */
export interface StartGameMessage {
  type: "startGame";
  playerCount: number;
  options?: GameStartOptions;
  reqId?: string;
}

/**
 * Option A (double-dice): client may send dice:[d1,d2] (or more if future options).
 * Backward compatibility: die may still be provided; server will normalize to dice=[die].
 *
 * Exactly one of (dice, die) must be present at runtime; this file keeps both optional
 * to avoid breaking older clients/tests at compile time.
 */
export interface RollMessage {
  type: "roll";
  actorId: PlayerId;
  dice?: number[];
  die?: number; // legacy
  reqId?: string;
}

/**
 * Same normalization rule as roll.
 */
export interface GetLegalMovesMessage {
  type: "getLegalMoves";
  actorId: PlayerId;
  dice?: number[];
  die?: number; // legacy
  reqId?: string;
}

export interface MoveMessage {
  type: "move";
  actorId: PlayerId;
  dice: number[];
  move: any;
  reqId?: string;
}

/* =========================
 * Game creation options
 * ========================= */

export interface GameStartOptions {
  /** Enable team play */
  teamPlay?: boolean;

  /** Number of teams (only if teamPlay = true) */
  teamCount?: number;

  /**
   * Override board arm count.
   * Allowed only for:
   *  - 4 players: 4 (default) or 8
   *  - 5 players: 6 (default) or 8
   */
  boardOverride?: 4 | 6 | 8;

  /** Rules options */
  doubleDice?: boolean;
  killRoll?: boolean;
}

/* =========================
 * Server → Client messages
 * ========================= */

export type ServerMessage =
  | WelcomeMessage
  | RoomJoinedMessage
  | LobbySyncMessage
  | StateSyncMessage
  | LegalMovesMessage
  | MoveResultMessage
  | ErrorMessage;

export interface WelcomeMessage {
  type: "welcome";
  serverVersion: string;
  clientId?: string;
  reqId?: string;
}

export interface RoomJoinedMessage {
  type: "roomJoined";
  roomCode: RoomCode;
  clientId: string;
  playerId: PlayerId;
  reconnected: boolean;
  reqId?: string;
}

/* =========================
 * Lobby state
 * ========================= */

export interface LobbyPlayer {
  playerId: PlayerId;
  clientId: string;
  seat: number;
  ready: boolean;
}

export interface LobbyGameConfig {
  playerCount: number;
  teamPlay?: boolean;
  teamCount?: number;
  boardArmCount?: number;
  doubleDice?: boolean;
  killRoll?: boolean;
  teams?: LobbyTeams;
}

export interface LobbyTeams {
  /**
   * Team membership is tracked in the lobby gameConfig so it can be adjusted (swap)
   * prior to startGame, then copied into the started game config at start.
   */
  teamA: PlayerId[];
  teamB: PlayerId[];

  /**
   * "Lock on first ready" contract:
   * once any player sets ready=true in team play, the server sets isLocked=true,
   * preventing any automatic reassignment. Explicit swaps may still be allowed.
   */
  isLocked: boolean;
}


export interface LobbyState {
  roomCode: RoomCode;
  players: LobbyPlayer[];
  phase: "lobby" | "active";
  expectedPlayerCount?: number;

  /**
   * Lobby game-creation config.
   * May be set before startGame via setLobbyGameConfig; becomes locked at startGame.
   */
  gameConfig?: LobbyGameConfig;
}

export interface LobbySyncMessage {
  type: "lobbySync";
  lobby: LobbyState;
  reqId?: string;
}

/* =========================
 * Game / turn sync
 * ========================= */

export interface TurnInfo {
  nextActorId: PlayerId;
  awaitingDice: boolean;
  dicePolicy?: "external";
}

export interface StateSyncMessage {
  type: "stateSync";
  roomCode: RoomCode;
  state: string;
  stateHash: string;
  turn: TurnInfo;
  reqId?: string;
}

/* =========================
 * Gameplay messages
 * ========================= */

export interface LegalMovesMessage {
  type: "legalMoves";
  roomCode: RoomCode;
  actorId: PlayerId;

  /**
   * Preferred: full dice list for this interaction (Option A).
   * Server will always send this.
   */
  dice: number[];

  /**
   * Legacy: first die only. Server will also send die=dice[0] for backward compatibility.
   */
  die: number;

  moves: unknown[];
  reqId?: string;
}

export interface MoveResultMessage {
  type: "moveResult";
  roomCode: RoomCode;
  response: any;
  reqId?: string;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
  reqId?: string;
}
