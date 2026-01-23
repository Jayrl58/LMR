// src/ui/screens/LobbyScreen.ts

// Conceptual lobby screen.
// Shows players, ready state, and (optionally) Start Game for host.

export type LobbyPlayerRow = {
  playerId: string;
  seat: number;
  ready: boolean;
};

export type LobbyViewModel = {
  roomCode: string;
  players: readonly LobbyPlayerRow[];
  canToggleReady: boolean;
  canStartGame: boolean;
};

export function createLobbyViewModel(): LobbyViewModel {
  return {
    roomCode: "",
    players: [],
    canToggleReady: false,
    canStartGame: false,
  };
}
