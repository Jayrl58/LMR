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

  ui.applyServerMessage({
    type: "welcome",
    serverVersion: "lmr-ws-0.1.4",
    clientId: "ui-loop-v0",
  });

  ui.applyServerMessage({
    type: "roomJoined",
    roomCode: "ABCDE1",
    clientId: "ui-loop-v0",
    playerId: "p0",
  });

  ui.applyServerMessage({
    type: "lobbySync",
    lobby: {
      roomCode: "ABCDE1",
      phase: "active",
      expectedPlayerCount: 4,
      players: [
        { playerId: "p0", clientId: "c0", seat: 0, ready: true },
        { playerId: "p1", clientId: "c1", seat: 1, ready: true },
        { playerId: "p2", clientId: "c2", seat: 2, ready: true },
        { playerId: "p3", clientId: "c3", seat: 3, ready: true },
      ],
    },
  });

  ui.applyServerMessage({
    type: "stateSync",
    roomCode: "ABCDE1",
    state: {
      gameId: "g_dev",
      phase: "active",
      players: {
        p0: { playerId: "p0", seat: 0, displayName: "Player 0" },
        p1: { playerId: "p1", seat: 1, displayName: "Player 1" },
        p2: { playerId: "p2", seat: 2, displayName: "Player 2" },
        p3: { playerId: "p3", seat: 3, displayName: "Player 3" },
      },
      pegStates: {
        p0: [{ pegIndex: 0, position: { kind: "track", index: 2 }, isFinished: false }],
        p1: [{ pegIndex: 0, position: { kind: "track", index: 19 }, isFinished: false }],
        p2: [{ pegIndex: 0, position: { kind: "track", index: 35 }, isFinished: false }],
        p3: [{ pegIndex: 0, position: { kind: "track", index: 50 }, isFinished: false }],
      },
      turn: {
        currentPlayerId: "p0",
        roll: { status: "rolled", dice: [1] },
      },
      finishedOrder: [],
      outcome: undefined,
    },
    stateHash: "hash0",
    turn: {
      nextActorId: "p0",
      dicePolicy: "external",
      awaitingDice: true,
    },
  });

  const controllerState = ui.getState();
  const gameState = controllerState.game.gameState as GameState | undefined;
  const uiState = gameState ? mapGameStateToUI(gameState) : undefined;

  const pegColors: Record<string, string> = {
    p0: "blue",
    p1: "red",
    p2: "green",
    p3: "orange",
  };

  const pegPlacements: PegPlacement[] = uiState
    ? (() => {
        const playerSeatById = new Map<string, number>(
          uiState.players.map((player) => [String(player.playerId), player.seat])
        );

        return uiState.pegs.map((peg) => ({
          pegId: `${peg.playerId}-${peg.pegIndex}`,
          hole: mapPositionToBoardHole(
            peg.position,
            playerSeatById.get(String(peg.playerId)) ?? 0,
            uiState.players.length
          ),
          color: pegColors[String(peg.playerId)] ?? "gray",
        }));
      })()
    : [];

  const arms = (uiState?.players.length ?? 4) as 4 | 6 | 8;

  return { arms, pegPlacements };
}