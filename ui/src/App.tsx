import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import BoardRenderer, { type PegPlacement } from "./components/BoardRenderer";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { GameState } from "../../src/types";

type SupportedArms = 4 | 6 | 8;

type BoardViewState = {
  arms: SupportedArms;
  pegPlacements: PegPlacement[];
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

type AppStateSetters = {
  setBoardView: Dispatch<SetStateAction<BoardViewState>>;
  setConnected: Dispatch<SetStateAction<boolean>>;
  setClientId: Dispatch<SetStateAction<string>>;
  setPlayerId: Dispatch<SetStateAction<string>>;
  setPhase: Dispatch<SetStateAction<string>>;
  setCurrentActor: Dispatch<SetStateAction<string>>;
  setAwaitingDice: Dispatch<SetStateAction<string>>;
  setPendingDice: Dispatch<SetStateAction<PendingDieView[]>>;
  setBankedDice: Dispatch<SetStateAction<number>>;
  setRollDiceInput: Dispatch<SetStateAction<string>>;
  setPlayerCountInput: Dispatch<SetStateAction<string>>;
  setDoubleDice: Dispatch<SetStateAction<boolean>>;
  setKillRoll: Dispatch<SetStateAction<boolean>>;
  setLegalMoveOptions: Dispatch<SetStateAction<LegalMoveOption[]>>;
  setSelectedPendingDie: Dispatch<SetStateAction<string>>;
  setLog: Dispatch<SetStateAction<string[]>>;
};

const WS_URL = "ws://127.0.0.1:8787";

const EMPTY_BOARD_VIEW: BoardViewState = {
  arms: 4,
  pegPlacements: [],
};

const PEG_COLORS: Record<string, string> = {
  p0: "blue",
  p1: "red",
  p2: "green",
  p3: "orange",
  p4: "purple",
  p5: "yellow",
  p6: "cyan",
  p7: "pink",
};

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

function buildBoardViewFromGameState(gameState: GameState): BoardViewState {
  const uiState = mapGameStateToUI(gameState);
  const arms = normalizeArms(uiState.players.length);

  const playerSeatById = new Map<string, number>(
    uiState.players.map((player) => [String(player.playerId), player.seat])
  );

  const pegPlacements: PegPlacement[] = uiState.pegs.map((peg) => ({
    pegId: `${peg.playerId}-${peg.pegIndex}`,
    hole: mapPositionToBoardHole(
      peg.position,
      playerSeatById.get(String(peg.playerId)) ?? 0,
      arms
    ),
    color: PEG_COLORS[String(peg.playerId)] ?? "gray",
  }));

  return {
    arms,
    pegPlacements,
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function prettyMoveLabel(move: unknown): string {
  if (!isObject(move)) {
    return String(move);
  }

  const id = typeof move.id === "string" ? move.id : undefined;
  const kind = typeof move.kind === "string" ? move.kind : undefined;
  const pegIndex =
    typeof move.pegIndex === "number" ? `peg ${move.pegIndex}` : undefined;
  const steps =
    typeof move.steps === "number"
      ? `${move.steps} step${move.steps === 1 ? "" : "s"}`
      : undefined;

  return [id, kind, pegIndex, steps].filter(Boolean).join(" | ") || safeStringify(move);
}

function parseDiceInput(diceInput: string): number[] | null {
  const trimmed = diceInput.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return null;

  const dice = parts.map((part) => Number(part));
  const valid = dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6);

  return valid ? dice : null;
}

function formatDice(dice: number[]): string {
  return dice.join(",");
}

function buildMoveDice(move: unknown, fallbackDice: number[]): number[] {
  if (!isObject(move)) return fallbackDice;

  if (
    typeof move.steps === "number" &&
    Number.isInteger(move.steps) &&
    move.steps >= 1 &&
    move.steps <= 6
  ) {
    return [move.steps];
  }

  const id = typeof move.id === "string" ? move.id : "";
  const last = id.split(":").at(-1);
  const n = Number(last);
  if (Number.isInteger(n) && n >= 1 && n <= 6) {
    return [n];
  }

  return fallbackDice;
}

function extractPendingDice(turn: unknown): PendingDieView[] {
  if (!isObject(turn) || !Array.isArray(turn.pendingDice)) return [];

  return turn.pendingDice
    .filter(isObject)
    .map((pd) => ({
      value: typeof pd.value === "number" ? pd.value : 0,
      controllerId:
        typeof pd.controllerId === "string" ? pd.controllerId : null,
    }))
    .filter((pd) => pd.value >= 1 && pd.value <= 6);
}

function resetLocalUi(setters: AppStateSetters): void {
  setters.setBoardView(EMPTY_BOARD_VIEW);
  setters.setConnected(false);
  setters.setClientId("");
  setters.setPlayerId("");
  setters.setPhase("");
  setters.setCurrentActor("");
  setters.setAwaitingDice("");
  setters.setPendingDice([]);
  setters.setBankedDice(0);
  setters.setRollDiceInput("1");
  setters.setPlayerCountInput("2");
  setters.setDoubleDice(true);
  setters.setKillRoll(false);
  setters.setLegalMoveOptions([]);
  setters.setSelectedPendingDie("");
  setters.setLog([]);
}

function updateBoardFromStatePayload(payload: unknown, setters: AppStateSetters) {
  if (!isGameState(payload)) return;

  setters.setBoardView(buildBoardViewFromGameState(payload));
  setters.setPhase(payload.phase);

  const currentPlayerId =
    typeof payload.turn?.currentPlayerId === "string"
      ? payload.turn.currentPlayerId
      : "";
  setters.setCurrentActor(currentPlayerId);
}

function updateTurnUi(turn: unknown, setters: AppStateSetters) {
  if (!isObject(turn)) return;

  const nextActorId =
    typeof turn.nextActorId === "string" ? turn.nextActorId : "";
  const awaiting =
    typeof turn.awaitingDice === "boolean" ? String(turn.awaitingDice) : "";

  setters.setCurrentActor((prev) => nextActorId || prev);
  setters.setAwaitingDice(awaiting);

  const nextPendingDice = extractPendingDice(turn);
  setters.setPendingDice(nextPendingDice);

  const nextBankedDice =
    typeof turn.bankedDice === "number" && turn.bankedDice > 0
      ? turn.bankedDice
      : 0;

  setters.setBankedDice(nextBankedDice);

  if (nextPendingDice.length > 0) {
    setters.setRollDiceInput(formatDice(nextPendingDice.map((pd) => pd.value)));
    setters.setSelectedPendingDie((prev) => {
      if (prev && nextPendingDice.some((pd) => String(pd.value) === prev)) {
        return prev;
      }
      return nextPendingDice.length === 1 ? String(nextPendingDice[0].value) : "";
    });
  } else if (nextBankedDice > 0) {
    setters.setRollDiceInput(
      Array.from({ length: nextBankedDice }, () => "1").join(",")
    );
    setters.setSelectedPendingDie("");
  } else {
    setters.setRollDiceInput("1");
    setters.setSelectedPendingDie("");
  }
}

function handleWelcome(message: Record<string, unknown>, setters: AppStateSetters) {
  if (typeof message.clientId === "string") {
    setters.setClientId(message.clientId);
  }
}

function handleRoomJoined(message: Record<string, unknown>, setters: AppStateSetters) {
  if (typeof message.playerId === "string") {
    setters.setPlayerId(message.playerId);
  }
}

function handleLobbySync(message: Record<string, unknown>, setters: AppStateSetters) {
  const lobby = isObject(message.lobby) ? message.lobby : undefined;
  if (lobby && typeof lobby.phase === "string") {
    setters.setPhase(lobby.phase);
  }
}

function handleStateSync(message: Record<string, unknown>, setters: AppStateSetters) {
  const parsed = parseJsonIfString(message.state);

  if (isGameState(parsed)) {
    updateBoardFromStatePayload(parsed, setters);
  }

  updateTurnUi(message.turn, setters);
  setters.setLegalMoveOptions([]);
}

function handleLegalMoves(message: Record<string, unknown>, setters: AppStateSetters) {
  const messageDice = Array.isArray(message.dice)
    ? message.dice.filter((d): d is number => typeof d === "number")
    : typeof message.die === "number"
      ? [message.die]
      : [];

  const moves = Array.isArray(message.moves) ? message.moves : [];
  const options = moves.map((move, index) => ({
    label: `${index + 1}. ${prettyMoveLabel(move)}`,
    value: safeStringify(move),
    dice: buildMoveDice(move, messageDice),
  }));

  setters.setLegalMoveOptions(options);

  if (typeof message.actorId === "string") {
    setters.setCurrentActor(message.actorId);
  }

  updateTurnUi(message.turn, setters);
}

function handleMoveResult(message: Record<string, unknown>, setters: AppStateSetters) {
  if (!isObject(message.response)) return;

  const response = message.response;

  if (response.ok === true) {
    const nextState = isObject(response.result)
      ? parseJsonIfString(response.result.nextState)
      : undefined;

    if (isGameState(nextState)) {
      updateBoardFromStatePayload(nextState, setters);
    }

    updateTurnUi(response.turn, setters);
    setters.setLegalMoveOptions([]);
  }
}

function handleError(_message: Record<string, unknown>, _setters: AppStateSetters) {
  return;
}

function handleServerMessage(message: unknown, setters: AppStateSetters) {
  if (!isObject(message) || typeof message.type !== "string") return;

  switch (message.type) {
    case "welcome":
      handleWelcome(message, setters);
      return;
    case "roomJoined":
      handleRoomJoined(message, setters);
      return;
    case "lobbySync":
      handleLobbySync(message, setters);
      return;
    case "stateSync":
      handleStateSync(message, setters);
      return;
    case "legalMoves":
      handleLegalMoves(message, setters);
      return;
    case "moveResult":
      handleMoveResult(message, setters);
      return;
    case "error":
      handleError(message, setters);
      return;
    default:
      return;
  }
}

export default function App() {
  const [boardView, setBoardView] = useState<BoardViewState>(EMPTY_BOARD_VIEW);

  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState("T98EES");
  const [rollDiceInput, setRollDiceInput] = useState("1");
  const [playerCountInput, setPlayerCountInput] = useState("2");
  const [doubleDice, setDoubleDice] = useState(true);
  const [killRoll, setKillRoll] = useState(false);

  const [clientId, setClientId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState("");
  const [currentActor, setCurrentActor] = useState("");
  const [awaitingDice, setAwaitingDice] = useState<string>("");

  const [pendingDice, setPendingDice] = useState<PendingDieView[]>([]);
  const [bankedDice, setBankedDice] = useState<number>(0);
  const [selectedPendingDie, setSelectedPendingDie] = useState("");

  const [legalMoveOptions, setLegalMoveOptions] = useState<LegalMoveOption[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  function appendLog(msg: string) {
    setLog((prev) => [...prev.slice(-100), msg]);
  }

  const setters: AppStateSetters = {
    setBoardView,
    setConnected,
    setClientId,
    setPlayerId,
    setPhase,
    setCurrentActor,
    setAwaitingDice,
    setPendingDice,
    setBankedDice,
    setRollDiceInput,
    setPlayerCountInput,
    setDoubleDice,
    setKillRoll,
    setLegalMoveOptions,
    setSelectedPendingDie,
    setLog,
  };

  function connect() {
    if (wsRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      appendLog("WS connected");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      appendLog(safeStringify(message));
      handleServerMessage(message, setters);
    };

    ws.onerror = (event) => {
      appendLog(`WS error: ${safeStringify(event)}`);
    };

    ws.onclose = () => {
      wsRef.current = null;
      resetLocalUi(setters);
      setRoomCode((prev) => prev || "T98EES");
    };
  }

  function disconnect() {
    const ws = wsRef.current;
    if (ws) {
      ws.close();
      return;
    }

    resetLocalUi(setters);
    setRoomCode((prev) => prev || "T98EES");
  }

  function clearLog() {
    setLog([]);
  }

  function send(msg: object) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      appendLog("WS not connected");
      return;
    }

    ws.send(JSON.stringify(msg));
    appendLog("SEND: " + JSON.stringify(msg));
  }

  function joinRoom() {
    send({
      type: "joinRoom",
      roomCode,
    });
  }

  function leaveRoom() {
    send({
      type: "leaveRoom",
    });
  }

  function startGame() {
    const playerCount = Number(playerCountInput);
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) {
      appendLog("Invalid player count. Use 2-8.");
      return;
    }

    send({
      type: "startGame",
      playerCount,
      options: {
        doubleDice,
        killRoll,
      },
    });
  }

  function resetGame() {
    send({
      type: "rematchConsent",
      consent: false,
    });
  }

  function requestLegalMovesForDice(dice: number[]) {
    send({
      type: "getLegalMoves",
      actorId: currentActor,
      dice,
    });
  }

  function choosePendingDie(value: number) {
    setSelectedPendingDie(String(value));
    setRollDiceInput(String(value));
    requestLegalMovesForDice([value]);
  }

  function sendRoll() {
    const dice = parseDiceInput(rollDiceInput);
    if (!dice) {
      appendLog("Invalid dice input. Use comma-separated values 1-6.");
      return;
    }

    send({
      type: "roll",
      actorId: currentActor,
      dice,
    });
  }

  function getLegalMoves() {
    const dice = selectedPendingDie
      ? [Number(selectedPendingDie)]
      : pendingDice.length > 0
        ? [pendingDice[0].value]
        : parseDiceInput(rollDiceInput);

    if (!dice || dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) {
      appendLog("Invalid dice input. Use comma-separated values 1-6.");
      return;
    }

    requestLegalMovesForDice(dice);
  }

  function sendMove(option: LegalMoveOption) {
    let move: unknown;
    try {
      move = JSON.parse(option.value);
    } catch {
      appendLog("Selected move is not valid JSON.");
      return;
    }

    send({
      type: "move",
      actorId: currentActor,
      dice: option.dice,
      move,
    });
  }

  const moveButtons = legalMoveOptions.map((option) => (
    <button
      key={option.value}
      onClick={() => sendMove(option)}
      style={{
        textAlign: "left",
        padding: "6px 8px",
        border: "1px solid #bbb",
        background: "#fff",
        cursor: "pointer",
      }}
    >
      {option.label}
    </button>
  ));

  const pendingDieButtons = pendingDice.map((pd, index) => {
    const selected = selectedPendingDie === String(pd.value);
    return (
      <button
        key={`${pd.value}-${pd.controllerId ?? "unassigned"}-${index}`}
        onClick={() => choosePendingDie(pd.value)}
        style={{
          padding: "4px 8px",
          border: "1px solid #bbb",
          background: selected ? "#dfefff" : "#fff",
          cursor: "pointer",
        }}
      >
        {pd.value}
        {pd.controllerId ? ` (${pd.controllerId})` : " (unassigned)"}
      </button>
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: 900,
          border: "1px solid #ccc",
          padding: 10,
          marginBottom: 10,
          background: "#f4f4f4",
          fontSize: 14,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <b>Status:</b> {connected ? "Connected" : "Disconnected"}
          <span style={{ marginLeft: 16 }}>
            <b>Phase:</b> {phase || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Current Actor:</b> {currentActor || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Awaiting Dice:</b> {awaitingDice || "-"}
          </span>
        </div>

        <div style={{ marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Room:
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              style={{ marginLeft: 6, width: 100 }}
            />
          </label>

          <label>
            Roll Dice:
            <input
              value={rollDiceInput}
              onChange={(e) => setRollDiceInput(e.target.value)}
              style={{ marginLeft: 6, width: 90 }}
            />
          </label>

          <label>
            Player Count:
            <input
              value={playerCountInput}
              onChange={(e) => setPlayerCountInput(e.target.value)}
              style={{ marginLeft: 6, width: 50 }}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={doubleDice}
              onChange={(e) => setDoubleDice(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Double Dice
          </label>

          <label>
            <input
              type="checkbox"
              checked={killRoll}
              onChange={(e) => setKillRoll(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Kill Roll
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <span>
            <b>ClientId:</b> {clientId || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>PlayerId:</b> {playerId || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Pending Dice:</b>{" "}
            {pendingDice.length > 0
              ? pendingDice
                  .map((pd) =>
                    pd.controllerId ? `${pd.value}(${pd.controllerId})` : `${pd.value}(unassigned)`
                  )
                  .join(", ")
              : "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Banked Dice:</b> {bankedDice}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={connect}>Connect</button>
          <button onClick={disconnect}>Disconnect</button>
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={leaveRoom}>Leave Room</button>
          <button onClick={startGame}>Start Game</button>
          <button onClick={resetGame}>Reset Game</button>
          <button onClick={sendRoll}>Roll</button>
          <button onClick={getLegalMoves}>Get Legal Moves</button>
          <button onClick={clearLog}>Clear Log</button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Pending Die Buttons:</b>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {pendingDieButtons.length > 0 ? pendingDieButtons : <div>-- none --</div>}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Legal Moves:</b>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {moveButtons.length > 0 ? moveButtons : <div>-- none --</div>}
          </div>
        </div>

        <div
          style={{
            height: 120,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ccc",
            padding: 4,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <BoardRenderer arms={boardView.arms} pegPlacements={boardView.pegPlacements} />
    </div>
  );
}