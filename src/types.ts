// src/types.ts

export type PlayerId = string & { readonly __brand: "PlayerId" };
export type GameId = string & { readonly __brand: "GameId" };

export type PegIndex = 0 | 1 | 2 | 3;

export type TeamId = string & { readonly __brand: "TeamId" };

export type SpotRef =
  | { zone: "base"; playerId: PlayerId }
  | { zone: "track"; index: number }
  | { zone: "home"; playerId: PlayerId; index: 0 | 1 | 2 | 3 }
  | { zone: "center" }
  | { zone: "blackhole" };

export interface PegState {
  pegIndex: PegIndex;
  position: SpotRef;
  isFinished: boolean;
}

export interface PlayerState {
  playerId: PlayerId;
  displayName: string;
  seat: number;
  isReady: boolean;
  hasFinished: boolean;

  // Team assignment. In non-team play this may be undefined.
  teamId?: TeamId;
}

export interface TeamConfig {
  teamId: TeamId;
  memberPlayerIds: readonly PlayerId[];
}

export interface Capture {
  victimPlayerId: PlayerId;
  victimPegIndex: PegIndex;
  sentTo: { zone: "base"; playerId: PlayerId };
}

export type Move =
  | {
      id: string;
      kind: "pass";
      actorPlayerId: PlayerId;
      reason: "no_legal_moves" | "forced_pass";
    }
  | {
      id: string;
      kind: "enter";
      actorPlayerId: PlayerId;
      pegIndex: PegIndex;
      from: { zone: "base"; playerId: PlayerId };
      to: { zone: "track"; index: number };
      path: readonly SpotRef[];
      captures: readonly Capture[];
    }
  | {
      id: string;
      kind: "advance";
      actorPlayerId: PlayerId;
      pegIndex: PegIndex;
      from: SpotRef;
      to: SpotRef;
      steps: number;
      path: readonly SpotRef[];
      captures: readonly Capture[];
    }
  | {
      // Center: enter from a Point on roll=1.
      // If center is occupied by another player's peg, that peg is killed (sent to base).
      id: string;
      kind: "enterCenter";
      actorPlayerId: PlayerId;
      pegIndex: PegIndex;
      from: { zone: "track"; index: number };
      to: { zone: "center" };
      path: readonly SpotRef[];
      captures: readonly Capture[];
    }
  | {
      // Center: exit on roll=1 to any Point.
      // If destination Point is occupied by another player's peg, that peg is killed (sent to base).
      id: string;
      kind: "exitCenter";
      actorPlayerId: PlayerId;
      pegIndex: PegIndex;
      from: { zone: "center" };
      to: { zone: "track"; index: number };
      path: readonly SpotRef[];
      captures: readonly Capture[];
    }
  | {
      // Kill-roll: remove an opponent peg (sent to base) without moving a peg.
      // Generated only when option killRoll is enabled.
      id: string;
      kind: "kill";
      actorPlayerId: PlayerId;
      captures: readonly Capture[];
    };

export type GameOutcome =
  | {
      kind: "individual";
      winnerPlayerId: PlayerId;
    }
  | {
      kind: "team";
      winnerTeamId: TeamId;

      // Requirement: list the winning team’s players in order of finish (first finisher first)
      winnerTeamPlayersInFinishOrder: readonly PlayerId[];
    };

export interface GameState {
  gameId: GameId;
  phase: "lobby" | "active" | "ended";
  config: {
    playerCount: 2 | 3 | 4 | 5 | 6 | 7 | 8;
    options: {
      doubleDice: boolean;

      // Optional: kill-roll mode. If true, rolling a 6 allows "kill" moves.
      killRoll?: boolean;

      // Fast Track: each player starts with one peg already finished in home.
      fastTrack?: boolean;

      // Team play (explicit up to 4 teams)
      teamPlay?: boolean;
      teams?: readonly TeamConfig[];
    };
  };

  players: Record<PlayerId, PlayerState>;
  pegStates: Record<PlayerId, readonly PegState[]>;
  turn: {
    currentPlayerId: PlayerId;
    roll: { status: "idle" } | { status: "rolled"; dice: readonly number[] };
    legalMovesVersion: number;
  };

  // Individual finish order (always tracked). Team ordering is derived from this.
  finishedOrder: readonly PlayerId[];

  // Set when the game ends
  outcome?: GameOutcome;
}
