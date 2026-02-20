import type {
  GameState,
  PlayerId,
  GameId,
  PegIndex,
  SpotRef,
  PegState,
  PlayerState,
  TeamConfig,
  TeamId,
} from "../types";

function asPlayerId(s: string): PlayerId {
  return s as PlayerId;
}

function asGameId(s: string): GameId {
  return s as GameId;
}

function asTeamId(s: string): TeamId {
  return s as TeamId;
}

function baseSpot(playerId: PlayerId): SpotRef {
  return { zone: "base", playerId };
}

function makePegStates(playerId: PlayerId): readonly PegState[] {
  const idxs: readonly PegIndex[] = [0, 1, 2, 3];
  return idxs.map((pegIndex) => ({
    pegIndex,
    position: baseSpot(playerId),
    isFinished: false,
  }));
}

function makePlayerState(playerId: PlayerId, seat: number): PlayerState {
  return {
    playerId,
    seat,
    hasFinished: false,
  };
}

/**
 * Team modes supported when teamPlay is enabled:
 * - 4 players: "2x2"
 * - 6 players: "2x3" or "3x2"
 * - 8 players: "2x4" or "4x2"
 */
export type TeamMode = "2x2" | "2x3" | "3x2" | "2x4" | "4x2";

export type MakeStateOptions = {
  playerCount: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  doubleDice?: boolean;

  /**
   * Team play (optional).
   * When enabled, teamMode determines grouping.
   *
   * Defaults (deterministic):
   * - 4P: 2x2
   * - 6P: 3x2 (opposite-seat pairs)
   * - 8P: 4x2 (opposite-seat pairs)
   */
  teamPlay?: boolean;
  teamMode?: TeamMode;
};

function makeDefaultTeams(playerIds: readonly PlayerId[], mode: TeamMode): readonly TeamConfig[] {
  const n = playerIds.length;

  const team = (i: number) => asTeamId(`team${i}`);

  const oppositePairs = (): readonly TeamConfig[] => {
    if (n % 2 !== 0) throw new Error("Opposite-seat pairing requires an even player count.");
    const half = n / 2;
    const teams: TeamConfig[] = [];
    for (let i = 0; i < half; i++) {
      teams.push({ teamId: team(i), memberPlayerIds: [playerIds[i], playerIds[i + half]] });
    }
    return teams;
  };

  switch (mode) {
    case "2x2": {
      if (n !== 4) throw new Error("teamMode 2x2 requires 4 players.");
      return [
        { teamId: team(0), memberPlayerIds: [playerIds[0], playerIds[2]] },
        { teamId: team(1), memberPlayerIds: [playerIds[1], playerIds[3]] },
      ];
    }
    case "2x3": {
      if (n !== 6) throw new Error("teamMode 2x3 requires 6 players.");
      // Even seats vs odd seats.
      return [
        { teamId: team(0), memberPlayerIds: [playerIds[0], playerIds[2], playerIds[4]] },
        { teamId: team(1), memberPlayerIds: [playerIds[1], playerIds[3], playerIds[5]] },
      ];
    }
    case "3x2": {
      if (n !== 6) throw new Error("teamMode 3x2 requires 6 players.");
      // Opposite-seat pairing: (p0,p3), (p1,p4), (p2,p5)
      return oppositePairs();
    }
    case "2x4": {
      if (n !== 8) throw new Error("teamMode 2x4 requires 8 players.");
      // Even seats vs odd seats.
      return [
        { teamId: team(0), memberPlayerIds: [playerIds[0], playerIds[2], playerIds[4], playerIds[6]] },
        { teamId: team(1), memberPlayerIds: [playerIds[1], playerIds[3], playerIds[5], playerIds[7]] },
      ];
    }
    case "4x2": {
      if (n !== 8) throw new Error("teamMode 4x2 requires 8 players.");
      // Opposite-seat pairing: (p0,p4), (p1,p5), (p2,p6), (p3,p7)
      return oppositePairs();
    }
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unsupported teamMode: ${_exhaustive}`);
    }
  }
}

/**
 * Minimal deterministic initial state:
 * - phase: "active" (so gameplay messages are accepted immediately)
 * - players: p0..p{n-1}, seats 0..n-1
 * - all pegs in base
 * - currentPlayerId: "p0"
 * - roll: idle
 */
export function makeState(opts: MakeStateOptions): GameState {
  const n = opts.playerCount;

  const playerIds = Array.from({ length: n }, (_, i) => asPlayerId(`p${i}`));

  const teamPlay = !!opts.teamPlay;

  let teams: readonly TeamConfig[] | undefined = undefined;
  if (teamPlay) {
    let mode: TeamMode | undefined = opts.teamMode;

    if (!mode) {
      if (n === 4) mode = "2x2";
      else if (n === 6) mode = "3x2";
      else if (n === 8) mode = "4x2";
      else throw new Error(`Team play not supported for playerCount=${n}.`);
    }

    teams = makeDefaultTeams(playerIds, mode);
  }

  const players: Record<PlayerId, PlayerState> = {} as any;
  const pegStates: Record<PlayerId, readonly PegState[]> = {} as any;

  playerIds.forEach((pid, seat) => {
    const ps = makePlayerState(pid, seat);

    // If teamPlay, assign teamId based on default team mapping.
    if (teamPlay && teams) {
      const team = teams.find((t) => t.memberPlayerIds.includes(pid));
      if (team) ps.teamId = team.teamId;
    }

    players[pid] = ps;
    pegStates[pid] = makePegStates(pid);
  });

  const state: GameState = {
    gameId: asGameId("g_dev"),
    phase: "active",
    config: {
      playerCount: n,
      options: {
        doubleDice: !!opts.doubleDice,

        // Team-play options are present only when enabled.
        ...(teamPlay ? { teamPlay: true, teams } : {}),
      },
    },
    players,
    pegStates,
    turn: {
      currentPlayerId: asPlayerId("p0"),
      roll: { status: "idle" },
      legalMovesVersion: 0,
    },
    finishedOrder: [],
  };

  return state;
}
