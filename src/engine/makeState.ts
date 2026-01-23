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
    displayName: `Player ${seat}`,
    seat,
    isReady: true,
    hasFinished: false,
  };
}

export type MakeStateOptions = {
  playerCount: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  doubleDice?: boolean;

  /**
   * Team play (optional).
   * When enabled, this dev-state generator assigns players into two teams:
   * - teamA: even seats (p0, p2, p4, p6)
   * - teamB: odd seats  (p1, p3, p5, p7)
   */
  teamPlay?: boolean;
};

function makeDefaultTwoTeams(playerIds: readonly PlayerId[]): readonly TeamConfig[] {
  const teamA = asTeamId("teamA");
  const teamB = asTeamId("teamB");

  const a: PlayerId[] = [];
  const b: PlayerId[] = [];

  playerIds.forEach((pid, seat) => {
    if (seat % 2 === 0) a.push(pid);
    else b.push(pid);
  });

  return [
    { teamId: teamA, memberPlayerIds: a },
    { teamId: teamB, memberPlayerIds: b },
  ];
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
  const teams = teamPlay ? makeDefaultTwoTeams(playerIds) : undefined;

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
