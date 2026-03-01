// src/ui/mapGameStateToUI.ts

import type { GameState } from "../types";
import type { UIGameState, UIPlayer, UIPeg } from "./uiTypes";

export function mapGameStateToUI(game: GameState): UIGameState {
  const players: UIPlayer[] = Object.values(game.players).map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    seat: p.seat,
    teamId: p.teamId,
    hasFinished: p.hasFinished,
  }));

  const pegs: UIPeg[] = [];

  for (const [playerId, pegList] of Object.entries(game.pegStates)) {
    for (const peg of pegList) {
      pegs.push({
        playerId: playerId as any,
        pegIndex: peg.pegIndex,
        position: peg.position,
        isFinished: peg.isFinished,
      });
    }
  }

  return {
    phase: game.phase,
    players,
    pegs,
    turn: {
      currentPlayerId: game.turn.currentPlayerId,
      dice:
        game.turn.roll.status === "rolled"
          ? game.turn.roll.dice
          : null,
    },
    finishedOrder: game.finishedOrder,
    outcome: game.outcome
      ? {
          kind: game.outcome.kind,
          winnerPlayerId:
            game.outcome.kind === "individual"
              ? game.outcome.winnerPlayerId
              : undefined,
          winnerTeamId:
            game.outcome.kind === "team"
              ? game.outcome.winnerTeamId
              : undefined,
          winnerTeamPlayersInFinishOrder:
            game.outcome.kind === "team"
              ? game.outcome.winnerTeamPlayersInFinishOrder
              : undefined,
        }
      : undefined,
  };
}