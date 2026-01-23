// src/ui/screens/GameScreen.ts

// Conceptual game screen.
// Shows turn info, dice submission, legal moves, and apply action.

export type TurnBannerView = {
  actorLabel: string; // e.g. "p0’s turn"
  awaitingDice: boolean;
};

export type MoveOptionView = {
  id: string;
  label: string; // human-readable description later
};

export type GameViewModel = {
  turn: TurnBannerView;
  canSubmitRoll: boolean;
  canApplyMove: boolean;

  // Multi-dice capable. In single-die mode this will typically be [die].
  selectedDice?: number[];
  legalMoves: readonly MoveOptionView[];
  selectedMoveId?: string;

  statusMessage?: string; // errors, waiting, etc.
};

export function createGameViewModel(): GameViewModel {
  return {
    turn: { actorLabel: "", awaitingDice: false },
    canSubmitRoll: false,
    canApplyMove: false,
    legalMoves: [],
  };
}
