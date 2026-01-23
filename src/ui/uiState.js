// src/ui/uiState.ts
// Minimal initial state (safe, conservative)
export const initialUiModel = {
    connection: { connected: false },
    lobby: { phase: "lobby", players: [] },
    game: {},
    turnInteraction: {},
};
