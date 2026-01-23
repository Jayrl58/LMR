import type {
  GameState,
  PlayerId,
  GameId,
  PegState,
  PegIndex,
  SpotRef,
} from "../src/types";

// brand casts for tests
export const P = (s: string) => s as PlayerId;
export const G = (s: string) => s as GameId;

export function makeBase(playerId: PlayerId): SpotRef {
  return { zone: "base", playerId };
}

export function makeTrack(index: number): SpotRef {
  return { zone: "track", index };
}

export function makeHome(playerId: PlayerId, index: 0 | 1 | 2 | 3): SpotRef {
  return { zone: "home", playerId, index };
}

export function makeInitialPegs(playerId: PlayerId): readonly PegState[] {
  return [
    { pegIndex: 0, position: makeBase(playerId), isFinished: false },
    { pegIndex: 1, position: makeBase(playerId), isFinished: false },
    { pegIndex: 2, position: makeBase(playerId), isFinished: false },
    { pegIndex: 3, position: makeBase(playerId), isFinished: false },
  ] as const;
}

export interface MakeStateArgs {
  playerCount: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  currentSeat?: number;
  doubleDice?: boolean;
}

export function makeState(args: MakeStateArgs): GameState {
  const { playerCount, currentSeat = 0, doubleDice = false } = args;

  const playerIds = Array.from({ length: playerCount }, (_, i) => P(`p${i}`));

  const players: GameState["players"] = Object.fromEntries(
    playerIds.map((pid, seat) => [
      pid,
      {
        playerId: pid,
        displayName: `Player ${seat}`,
        seat,
        isReady: true,
        hasFinished: false,
      },
    ])
  );

  const pegStates: GameState["pegStates"] = Object.fromEntries(
    playerIds.map((pid) => [pid, makeInitialPegs(pid)])
  );

  return {
    gameId: G("g_test"),
    phase: "active",
    config: {
      playerCount,
      options: { doubleDice },
    },
    players,
    pegStates,
    turn: {
      currentPlayerId: playerIds[currentSeat],
      roll: { status: "idle" },
      legalMovesVersion: 0,
    },
    finishedOrder: [],
  };
}

export function setPeg(
  state: GameState,
  playerId: PlayerId,
  pegIndex: PegIndex,
  position: SpotRef,
  isFinished = false
): GameState {
  const next: GameState = { ...state, pegStates: { ...state.pegStates } };

  const pegs = next.pegStates[playerId].map((p) =>
    p.pegIndex === pegIndex ? ({ ...p, position, isFinished } as PegState) : p
  );

  next.pegStates[playerId] = pegs;
  return next;
}

export function findPeg(state: GameState, playerId: PlayerId, pegIndex: PegIndex): PegState {
  const p = state.pegStates[playerId].find((x) => x.pegIndex === pegIndex);
  if (!p) throw new Error("peg not found");
  return p;
}
