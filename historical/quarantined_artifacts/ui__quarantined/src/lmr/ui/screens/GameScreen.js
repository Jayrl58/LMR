// src/ui/screens/GameScreen.ts
export function createGameViewModel() {
    return {
        turn: { actorLabel: "", awaitingDice: false },
        canSubmitRoll: false,
        canApplyMove: false,
        legalMoves: [],
    };
}
