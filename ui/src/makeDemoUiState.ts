import { UiController } from "../../src/ui/index";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { GameState } from "../../src/types";
import type { PegPlacement } from "./components/BoardRenderer";

export function makeDemoUiState(): {
  arms: 4 | 6 | 8;
  pegPlacements: PegPlacement[];
} {
  const ui = new UiController();

  const controllerState = ui.getState();
  const gameState = controllerState.game.gameState as GameState | undefined;

  const pegColors: Record<string, string> = {
    p0: "blue",
    p1: "red",
    p2: "green",
    p3: "orange",
  };

  if (!gameState) {
    return {
      arms: 4,
      pegPlacements: [],
    };
  }

  const uiState = mapGameStateToUI(gameState);

  const playerSeatById = new Map<string, number>(
    uiState.players.map((player) => [String(player.playerId), player.seat])
  );

  const pegPlacements: PegPlacement[] = uiState.pegs.map((peg) => ({
    pegId: `${peg.playerId}-${peg.pegIndex}`,
    hole: mapPositionToBoardHole(
      peg.position,
      playerSeatById.get(String(peg.playerId)) ?? 0,
      uiState.players.length
    ),
    color: pegColors[String(peg.playerId)] ?? "gray",
  }));

  const arms = uiState.players.length as 4 | 6 | 8;

  return { arms, pegPlacements };
}