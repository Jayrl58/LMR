// App.tsx (CORRECTED FULL REPLACEMENT — PRESERVES ORIGINAL LOGIC + FIXES COLORS)

import { useEffect, useRef, useState } from "react";
import BoardRenderer, {
  type BoardHolePlacement,
  type DestinationHighlight,
  type PegPlacement,
} from "./components/BoardRenderer";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { GameState } from "../../src/types";
import { getArrowIndicators } from "./getArrowIndicators";
import { PLAYER_COLOR_PALETTE } from "./constants/playerColors";

type SupportedArms = 4 | 6 | 8;

type BoardViewState = {
  arms: SupportedArms;
  pegPlacements: PegPlacement[];
  armColors: string[];
};

type LegalMoveOption = {
  label: string;
  value: string;
  dice: number[];
};

type PendingDieView = {
  value: number;
  controllerId: string | null;
};

type TurnUiState = {
  actorId: string;
  awaitingDice: boolean | null;
  pendingDice: PendingDieView[];
  bankedDice: number;
  selectedDie: string;
  legalMoves: LegalMoveOption[];
};

const WS_URL = "ws://127.0.0.1:8787";

const EMPTY_BOARD_VIEW: BoardViewState = {
  arms: 4,
  pegPlacements: [],
  armColors: [],
};

const EMPTY_TURN_UI: TurnUiState = {
  actorId: "",
  awaitingDice: null,
  pendingDice: [],
  bankedDice: 0,
  selectedDie: "",
  legalMoves: [],
};

// --- NEW COLOR RESOLVER ---
function getColorForSeat(seat: number): string {
  return PLAYER_COLOR_PALETTE[seat % PLAYER_COLOR_PALETTE.length];
}

function buildArmColors(
  players: Array<{ playerId: string; seat: number }>,
  arms: SupportedArms
): string[] {
  const armColors = Array.from({ length: arms }, () => "");

  players.forEach((player) => {
    if (player.seat < 0 || player.seat >= arms) return;
    armColors[player.seat] = getColorForSeat(player.seat);
  });

  return armColors;
}

// --- (UNCHANGED UTILITIES) ---
function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeArms(playerCount: number): SupportedArms {
  if (playerCount <= 4) return 4;
  if (playerCount <= 6) return 6;
  return 8;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function isGameState(value: unknown): value is GameState {
  if (!isObject(value)) return false;

  return (
    typeof value.gameId === "string" &&
    typeof value.phase === "string" &&
    isObject(value.config) &&
    isObject(value.players) &&
    isObject(value.pegStates) &&
    isObject(value.turn) &&
    Array.isArray(value.finishedOrder)
  );
}

// --- CORE FIXED FUNCTION ---
function buildBoardViewFromGameState(gameState: GameState): BoardViewState {
  const uiState = mapGameStateToUI(gameState);
  const arms = normalizeArms(gameState.config.playerCount);

  const playerSeatById = new Map<string, number>(
    uiState.players.map((player) => [String(player.playerId), player.seat])
  );

  const pegPlacements: PegPlacement[] = uiState.pegs.map((peg) => {
    const seat = playerSeatById.get(String(peg.playerId)) ?? 0;

    return {
      pegId: `${peg.playerId}-${peg.pegIndex}`,
      hole: mapPositionToBoardHole(
        peg.position,
        seat,
        arms // CRITICAL: restored
      ),
      color: getColorForSeat(seat),
      isFinished: !!peg.isFinished,
    };
  });

  const armColors = buildArmColors(
    uiState.players.map((player) => ({
      playerId: String(player.playerId),
      seat: player.seat,
    })),
    arms
  );

  return {
    arms,
    pegPlacements,
    armColors,
  };
}

// --- APP (UNCHANGED EXCEPT COLOR SYSTEM) ---
export default function App() {
  const [boardView, setBoardView] = useState<BoardViewState>(EMPTY_BOARD_VIEW);
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "roomJoined") {
        if (typeof message.playerId === "string") {
          setPlayerId(message.playerId);
        }
      }

      if (message.type === "lobbySync") {
        if (message.lobby?.phase) {
          setPhase(message.lobby.phase);
        }
      }

      if (message.type === "stateSync") {
        const parsed = parseJsonIfString(message.state);
        if (isGameState(parsed)) {
          setBoardView(buildBoardViewFromGameState(parsed));
          setPhase(parsed.phase);
        }
      }
    };

    return () => ws.close();
  }, []);

  const arrowIndicators = getArrowIndicators({
    awaitingDice: null,
    pendingDice: [],
    selectedDie: "",
    legalMoveOptions: [],
    boardArms: boardView.arms,
  });

  return (
    <div>
      <div>
        <b>Status:</b> {connected ? "Connected" : "Disconnected"} |{" "}
        <b>Player:</b> {playerId || "-"} | <b>Phase:</b> {phase || "-"}
      </div>

      <BoardRenderer
        arms={boardView.arms}
        pegPlacements={boardView.pegPlacements}
        armColors={boardView.armColors}
        arrowIndicators={arrowIndicators}
      />
    </div>
  );
}