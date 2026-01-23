// src/ui/screens/LobbyScreen.ts
export function createLobbyViewModel() {
    return {
        roomCode: "",
        players: [],
        canToggleReady: false,
        canStartGame: false,
    };
}
