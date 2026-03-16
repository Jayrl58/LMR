import { useEffect, useRef, useState } from "react";
import BoardRenderer, {
  type BoardHolePlacement,
  type DestinationHighlight,
  type PegPlacement,
} from "./components/BoardRenderer";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { GameState } from "../../src/types";

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

function buildArmColors(
  players: Array<{ playerId: string; seat: number }>,
  arms: SupportedArms
): string[] {
  const armColors = Array.from({ length: arms }, () => "");

  players.forEach((player) => {
    if (player.seat < 0 || player.seat >= arms) return;
    armColors[player.seat] = PEG_COLORS[player.playerId] ?? "gray";
  });

  return armColors;
}

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
  const arms = normalizeArms(gameState.config.playerCount);

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
    isFinished: !!peg.isFinished,
  }));

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

function extractMovablePegIds(legalMoveOptions: LegalMoveOption[]): string[] {
  const movablePegIds = new Set<string>();

  legalMoveOptions.forEach((option) => {
    try {
      const move = JSON.parse(option.value) as unknown;
      if (!isObject(move)) return;

      const actorPlayerId =
        typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;
      const pegIndex =
        typeof move.pegIndex === "number" ? move.pegIndex : null;

      if (!actorPlayerId || pegIndex === null) return;

      movablePegIds.add(`${actorPlayerId}-${pegIndex}`);
    } catch {
      return;
    }
  });

  return Array.from(movablePegIds);
}

function holesMatch(a: BoardHolePlacement, b: BoardHolePlacement): boolean {
  if (a.type !== b.type) return false;

  if (a.type === "center" && b.type === "center") return true;

  if (a.type === "track" && b.type === "track") {
    return a.arm === b.arm && a.spot === b.spot;
  }

  if (a.type === "home" && b.type === "home") {
    return a.arm === b.arm && a.slot === b.slot;
  }

  if (a.type === "base" && b.type === "base") {
    return a.arm === b.arm && a.slot === b.slot;
  }

  return false;
}

function mapMoveToHole(
  move: Record<string, unknown>,
  boardArms: SupportedArms
): BoardHolePlacement | null {
  if (!isObject(move.to)) return null;

  const to = move.to as Record<string, unknown>;
  const actorPlayerId =
    typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;

  if (to.zone === "center") {
    return { type: "center" };
  }

  if (
    to.zone === "track" &&
    typeof to.index === "number" &&
    Number.isInteger(to.index) &&
    actorPlayerId
  ) {
    const mapped = mapPositionToBoardHole(
      { zone: "track", index: to.index },
      Number(actorPlayerId.slice(1)),
      boardArms
    );
    return mapped.type === "track" || mapped.type === "home" || mapped.type === "center"
      ? mapped
      : null;
  }

  if (to.zone === "home") {
    const playerId =
      typeof to.playerId === "string"
        ? to.playerId
        : actorPlayerId;

    const slot =
      typeof to.slot === "number" && Number.isInteger(to.slot)
        ? to.slot
        : typeof to.index === "number" && Number.isInteger(to.index)
          ? to.index
          : null;

    if (playerId && slot !== null) {
      const mapped = mapPositionToBoardHole(
        { zone: "home", playerId, slot },
        Number(playerId.slice(1)),
        boardArms
      );
      return mapped.type === "home" || mapped.type === "track" || mapped.type === "center"
        ? mapped
        : null;
    }
  }

  return null;
}

function extractDestinationHighlights(
  legalMoveOptions: LegalMoveOption[],
  boardArms: SupportedArms,
  focusedPegId: string
): DestinationHighlight[] {
  const highlights: DestinationHighlight[] = [];

  legalMoveOptions.forEach((option) => {
    try {
      const move = JSON.parse(option.value) as unknown;
      if (!isObject(move)) return;

      const actorPlayerId =
        typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;
      const pegIndex =
        typeof move.pegIndex === "number" ? move.pegIndex : null;

      if (!actorPlayerId || pegIndex === null) return;

      const movePegId = `${actorPlayerId}-${pegIndex}`;
      if (focusedPegId && movePegId !== focusedPegId) return;

      const hole = mapMoveToHole(move, boardArms);
      if (!hole) return;

      const alreadyPresent = highlights.some((existing) =>
        holesMatch(existing.hole, hole)
      );

      if (!alreadyPresent) {
        highlights.push({
          hole,
          color: PEG_COLORS[actorPlayerId] ?? "gray",
        });
      }
    } catch {
      return;
    }
  });

  return highlights;
}

function optionMatchesDestinationHole(
  option: LegalMoveOption,
  boardArms: SupportedArms,
  hole: BoardHolePlacement,
  focusedPegId: string
): boolean {
  try {
    const move = JSON.parse(option.value) as unknown;
    if (!isObject(move)) return false;

    const actorPlayerId =
      typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;
    const pegIndex =
      typeof move.pegIndex === "number" ? move.pegIndex : null;

    if (!actorPlayerId || pegIndex === null) return false;

    const movePegId = `${actorPlayerId}-${pegIndex}`;
    if (focusedPegId && movePegId !== focusedPegId) return false;

    const mappedHole = mapMoveToHole(move, boardArms);
    if (!mappedHole) return false;

    return holesMatch(mappedHole, hole);
  } catch {
    return false;
  }
}

function extractPreviewPegPlacement(
  legalMoveOptions: LegalMoveOption[],
  boardArms: SupportedArms,
  hoveredDestinationHole: BoardHolePlacement | null,
  focusedPegId: string
): PegPlacement | null {
  if (!hoveredDestinationHole) return null;

  const matchingOption = legalMoveOptions.find((option) =>
    optionMatchesDestinationHole(option, boardArms, hoveredDestinationHole, focusedPegId)
  );

  if (!matchingOption) return null;

  try {
    const move = JSON.parse(matchingOption.value) as unknown;
    if (!isObject(move)) return null;

    const actorPlayerId =
      typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;
    const pegIndex =
      typeof move.pegIndex === "number" ? move.pegIndex : null;

    if (!actorPlayerId || pegIndex === null) return null;

    return {
      pegId: `${actorPlayerId}-${pegIndex}`,
      hole: hoveredDestinationHole,
      color: PEG_COLORS[actorPlayerId] ?? "gray",
      isFinished: false,
    };
  } catch {
    return null;
  }
}

function DieFace({ value }: { value: number | string }) {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        border: "1px solid #999",
        borderRadius: 6,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  );
}

export default function App() {
  const [boardView, setBoardView] = useState<BoardViewState>(EMPTY_BOARD_VIEW);

  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinedRoomCode, setJoinedRoomCode] = useState("");
  const [rollDiceInput, setRollDiceInput] = useState("1");
  const [playerCountInput, setPlayerCountInput] = useState("2");
  const [doubleDice, setDoubleDice] = useState(true);
  const [killRoll, setKillRoll] = useState(false);

  const [clientId, setClientId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState("");
  const [turnUi, setTurnUi] = useState<TurnUiState>(EMPTY_TURN_UI);
  const [focusedPegId, setFocusedPegId] = useState("");
  const [hoveredDestinationHole, setHoveredDestinationHole] =
    useState<BoardHolePlacement | null>(null);

  const [log, setLog] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingJoinRoomCodeRef = useRef("");
  const autoRequestedSingleDieKeyRef = useRef("");

  const currentActor = turnUi.actorId;
  const awaitingDiceDisplay =
    turnUi.awaitingDice === null ? "-" : String(turnUi.awaitingDice);
  const pendingDice = turnUi.pendingDice;
  const bankedDice = turnUi.bankedDice;
  const selectedPendingDie = turnUi.selectedDie;
  const legalMoveOptions = turnUi.legalMoves;
  const movablePegIds = extractMovablePegIds(legalMoveOptions);
  const destinationHighlights = extractDestinationHighlights(
    legalMoveOptions,
    boardView.arms,
    focusedPegId
  );
  const previewPegPlacement = extractPreviewPegPlacement(
    legalMoveOptions,
    boardView.arms,
    hoveredDestinationHole,
    focusedPegId
  );

  function appendLog(msg: string) {
    setLog((prev) => [...prev.slice(-100), msg]);
  }

  function clearBoardFocus() {
    setFocusedPegId("");
    setHoveredDestinationHole(null);
  }

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

      if (message.type === "welcome" && typeof message.clientId === "string") {
        setClientId(message.clientId);
        return;
      }

      if (message.type === "roomJoined") {
        if (typeof message.playerId === "string") {
          setPlayerId(message.playerId);
        }
        if (typeof message.roomCode === "string") {
          setJoinedRoomCode(message.roomCode);
          setRoomCode(message.roomCode);
        }
        return;
      }

      if (message.type === "leaveRoomAck") {
        setPlayerId("");
        setPhase("");
        setTurnUi(EMPTY_TURN_UI);
        setBoardView(EMPTY_BOARD_VIEW);
        setJoinedRoomCode("");
        clearBoardFocus();
        return;
      }

      if (message.type === "lobbySync") {
        if (message.lobby && typeof message.lobby.phase === "string") {
          setPhase(message.lobby.phase);
        }
        return;
      }

      if (message.type === "stateSync") {
        const parsed = parseJsonIfString(message.state);
        if (isGameState(parsed)) {
          setBoardView(buildBoardViewFromGameState(parsed));
          setPhase(parsed.phase);
          const currentPlayerId =
            typeof parsed.turn?.currentPlayerId === "string"
              ? parsed.turn.currentPlayerId
              : "";
          setTurnUi((prev) => ({
            ...prev,
            actorId: currentPlayerId,
          }));
        }

        const turn = message.turn;
        if (isObject(turn)) {
          const nextActorId =
            typeof turn.nextActorId === "string" ? turn.nextActorId : "";
          const nextAwaitingDice =
            typeof turn.awaitingDice === "boolean" ? turn.awaitingDice : null;
          const nextPendingDice = extractPendingDice(turn);
          const nextBankedDice =
            typeof turn.bankedDice === "number" && turn.bankedDice > 0
              ? turn.bankedDice
              : 0;

          if (nextPendingDice.length > 0) {
            setRollDiceInput(formatDice(nextPendingDice.map((pd) => pd.value)));
          } else if (nextBankedDice > 0) {
            setRollDiceInput(
              Array.from({ length: nextBankedDice }, () => "1").join(",")
            );
          } else {
            setRollDiceInput("1");
          }

          setTurnUi((prev) => {
            let nextSelectedDie = "";
            if (nextPendingDice.length > 0) {
              if (
                prev.selectedDie &&
                nextPendingDice.some((pd) => String(pd.value) === prev.selectedDie)
              ) {
                nextSelectedDie = prev.selectedDie;
              } else {
                nextSelectedDie =
                  nextPendingDice.length === 1 ? String(nextPendingDice[0].value) : "";
              }
            }

            return {
              ...prev,
              actorId: nextActorId || prev.actorId,
              awaitingDice: nextAwaitingDice,
              pendingDice: nextPendingDice,
              bankedDice: nextBankedDice,
              selectedDie: nextSelectedDie,
              legalMoves: [],
            };
          });
        }
        return;
      }

      if (message.type === "legalMoves") {
        const messageDice = Array.isArray(message.dice)
          ? message.dice.filter((d: unknown): d is number => typeof d === "number")
          : typeof message.die === "number"
            ? [message.die]
            : [];

        const moves = Array.isArray(message.moves) ? message.moves : [];
        const options = moves.map((move, index) => ({
          label: `${index + 1}. ${prettyMoveLabel(move)}`,
          value: safeStringify(move),
          dice: buildMoveDice(move, messageDice),
        }));

        const turn = message.turn;
        if (isObject(turn)) {
          const nextActorId =
            typeof turn.nextActorId === "string" ? turn.nextActorId : "";
          const nextAwaitingDice =
            typeof turn.awaitingDice === "boolean" ? turn.awaitingDice : null;
          const nextPendingDice = extractPendingDice(turn);
          const nextBankedDice =
            typeof turn.bankedDice === "number" && turn.bankedDice > 0
              ? turn.bankedDice
              : 0;

          if (nextPendingDice.length > 0) {
            setRollDiceInput(formatDice(nextPendingDice.map((pd) => pd.value)));
          } else if (nextBankedDice > 0) {
            setRollDiceInput(
              Array.from({ length: nextBankedDice }, () => "1").join(",")
            );
          } else {
            setRollDiceInput("1");
          }

          setTurnUi((prev) => {
            let nextSelectedDie = "";
            if (nextPendingDice.length > 0) {
              if (
                prev.selectedDie &&
                nextPendingDice.some((pd) => String(pd.value) === prev.selectedDie)
              ) {
                nextSelectedDie = prev.selectedDie;
              } else {
                nextSelectedDie =
                  nextPendingDice.length === 1 ? String(nextPendingDice[0].value) : "";
              }
            }

            return {
              ...prev,
              actorId:
                typeof message.actorId === "string"
                  ? message.actorId
                  : nextActorId || prev.actorId,
              awaitingDice: nextAwaitingDice,
              pendingDice: nextPendingDice,
              bankedDice: nextBankedDice,
              selectedDie: nextSelectedDie,
              legalMoves: options,
            };
          });
        } else {
          setTurnUi((prev) => ({
            ...prev,
            actorId: typeof message.actorId === "string" ? message.actorId : prev.actorId,
            legalMoves: options,
          }));
        }
        return;
      }

      if (message.type === "moveResult" && isObject(message.response)) {
        const response = message.response;
        if (response.ok === true) {
          const nextState = isObject(response.result)
            ? parseJsonIfString(response.result.nextState)
            : undefined;

          if (isGameState(nextState)) {
            setBoardView(buildBoardViewFromGameState(nextState));
            setPhase(nextState.phase);
            const currentPlayerId =
              typeof nextState.turn?.currentPlayerId === "string"
                ? nextState.turn.currentPlayerId
                : "";
            setTurnUi((prev) => ({
              ...prev,
              actorId: currentPlayerId,
            }));
          }

          if (isObject(response.turn)) {
            const turn = response.turn;
            const nextActorId =
              typeof turn.nextActorId === "string" ? turn.nextActorId : "";
            const nextAwaitingDice =
              typeof turn.awaitingDice === "boolean" ? turn.awaitingDice : null;
            const nextPendingDice = extractPendingDice(turn);
            const nextBankedDice =
              typeof turn.bankedDice === "number" && turn.bankedDice > 0
                ? turn.bankedDice
                : 0;

            if (nextPendingDice.length > 0) {
              setRollDiceInput(formatDice(nextPendingDice.map((pd) => pd.value)));
            } else if (nextBankedDice > 0) {
              setRollDiceInput(
                Array.from({ length: nextBankedDice }, () => "1").join(",")
              );
            } else {
              setRollDiceInput("1");
            }

            setTurnUi((prev) => {
              let nextSelectedDie = "";
              if (nextPendingDice.length > 0) {
                if (
                  prev.selectedDie &&
                  nextPendingDice.some((pd) => String(pd.value) === prev.selectedDie)
                ) {
                  nextSelectedDie = prev.selectedDie;
                } else {
                  nextSelectedDie =
                    nextPendingDice.length === 1 ? String(nextPendingDice[0].value) : "";
                }
              }

              return {
                ...prev,
                actorId: nextActorId || prev.actorId,
                awaitingDice: nextAwaitingDice,
                pendingDice: nextPendingDice,
                bankedDice: nextBankedDice,
                selectedDie: nextSelectedDie,
                legalMoves: [],
              };
            });
          } else {
            setTurnUi((prev) => ({
              ...prev,
              legalMoves: [],
            }));
          }
        }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnected(false);
      setClientId("");
      setPlayerId("");
      setPhase("");
      setTurnUi(EMPTY_TURN_UI);
      setBoardView(EMPTY_BOARD_VIEW);
      setJoinedRoomCode("");
      setRoomCode("");
      setLog([]);
      clearBoardFocus();
    };
  }

  function disconnect() {
    const ws = wsRef.current;
    if (ws) {
      ws.close();
      return;
    }

    setConnected(false);
    setClientId("");
    setPlayerId("");
    setPhase("");
    setTurnUi(EMPTY_TURN_UI);
    setBoardView(EMPTY_BOARD_VIEW);
    setJoinedRoomCode("");
    setRoomCode("");
    setLog([]);
    clearBoardFocus();
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

  function createFreshRoom() {
    if (joinedRoomCode) {
      appendLog("Leave the current room before creating a fresh room.");
      return;
    }

    pendingJoinRoomCodeRef.current = "";
    autoRequestedSingleDieKeyRef.current = "";
    clearBoardFocus();
    setPlayerId("");
    setPhase("");
    setTurnUi(EMPTY_TURN_UI);
    setBoardView(EMPTY_BOARD_VIEW);
    setJoinedRoomCode("");

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const freshRoomCode = Array.from({ length: 6 }, () => {
      const index = Math.floor(Math.random() * alphabet.length);
      return alphabet[index];
    }).join("");

    setRoomCode(freshRoomCode);
    appendLog(`Fresh room prepared: ${freshRoomCode}`);
  }

  function joinRoom() {
    const trimmedRoomCode = roomCode.trim().toUpperCase();

    if (!trimmedRoomCode) {
      appendLog("Create or enter a room code before joining.");
      return;
    }

    if (!(connected && !joinedRoomCode)) {
      appendLog("Already in a room. Leave the current room first.");
      return;
    }

    pendingJoinRoomCodeRef.current = trimmedRoomCode;
    autoRequestedSingleDieKeyRef.current = "";
    clearBoardFocus();
    setPlayerId("");
    setPhase("");
    setTurnUi(EMPTY_TURN_UI);
    setBoardView(EMPTY_BOARD_VIEW);
    setRoomCode(trimmedRoomCode);

    send({
      type: "joinRoom",
      roomCode: trimmedRoomCode,
    });
  }

  function leaveRoom() {
    if (!(connected && !!joinedRoomCode && phase !== "active")) {
      appendLog("Not currently joined to a room.");
      return;
    }

    send({
      type: "leaveRoom",
    });

    pendingJoinRoomCodeRef.current = "";
    autoRequestedSingleDieKeyRef.current = "";
    clearBoardFocus();
    setPlayerId("");
    setPhase("");
    setTurnUi(EMPTY_TURN_UI);
    setBoardView(EMPTY_BOARD_VIEW);
    setJoinedRoomCode("");
    appendLog("Left room locally; awaiting server sync.");
  }

  function startGame() {
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before starting a game.");
      return;
    }

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
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before resetting a game.");
      return;
    }

    send({
      type: "rematchConsent",
      consent: false,
    });
  }

  function requestLegalMovesForDice(dice: number[]) {
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before requesting legal moves.");
      return;
    }

    send({
      type: "getLegalMoves",
      actorId: currentActor,
      dice,
    });
  }

  function choosePendingDie(value: number) {
    autoRequestedSingleDieKeyRef.current = "";
    clearBoardFocus();
    setTurnUi((prev) => ({
      ...prev,
      selectedDie: String(value),
    }));
    setRollDiceInput(String(value));
    requestLegalMovesForDice([value]);
  }

  function handlePegClick(pegId: string) {
    setHoveredDestinationHole(null);
    setFocusedPegId((prev) => (prev === pegId ? "" : pegId));
  }

  function handleDestinationClick(hole: BoardHolePlacement) {
    const matchingOption = legalMoveOptions.find((option) =>
      optionMatchesDestinationHole(option, boardView.arms, hole, focusedPegId)
    );

    if (!matchingOption) {
      appendLog("No legal move matched the selected destination.");
      return;
    }

    sendMove(matchingOption);
  }

  function handleDestinationHover(hole: BoardHolePlacement) {
    setHoveredDestinationHole(hole);
  }

  function handleDestinationLeave() {
    setHoveredDestinationHole(null);
  }

  function sendRoll() {
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before rolling.");
      return;
    }

    const dice = parseDiceInput(rollDiceInput);
    if (!dice) {
      appendLog("Invalid dice input. Use comma-separated values 1-6.");
      return;
    }

    clearBoardFocus();
    send({
      type: "roll",
      actorId: currentActor,
      dice,
    });
  }

  function getLegalMoves() {
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before requesting legal moves.");
      return;
    }

    const dice = selectedPendingDie
      ? [Number(selectedPendingDie)]
      : pendingDice.length > 0
        ? [pendingDice[0].value]
        : parseDiceInput(rollDiceInput);

    if (!dice || dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) {
      appendLog("Invalid dice input. Use comma-separated values 1-6.");
      return;
    }

    clearBoardFocus();
    requestLegalMovesForDice(dice);
  }

  function sendMove(option: LegalMoveOption) {
    if (!(connected && !!joinedRoomCode)) {
      appendLog("Join a room before sending a move.");
      return;
    }

    let move: unknown;
    try {
      move = JSON.parse(option.value);
    } catch {
      appendLog("Selected move is not valid JSON.");
      return;
    }

    clearBoardFocus();
    send({
      type: "move",
      actorId: currentActor,
      dice: option.dice,
      move,
    });
  }

  useEffect(() => {
    if (!(connected && !!joinedRoomCode)) {
      autoRequestedSingleDieKeyRef.current = "";
      return;
    }

    if (pendingDice.length !== 1) {
      autoRequestedSingleDieKeyRef.current = "";
      return;
    }

    const die = pendingDice[0];
    const selectedDieValue = String(die.value);
    const requestKey = `${currentActor}|${selectedDieValue}|${pendingDice.length}|${bankedDice}`;

    if (autoRequestedSingleDieKeyRef.current === requestKey) {
      return;
    }

    autoRequestedSingleDieKeyRef.current = requestKey;
    clearBoardFocus();
    setTurnUi((prev) => ({
      ...prev,
      selectedDie: selectedDieValue,
    }));
    setRollDiceInput(selectedDieValue);
    requestLegalMovesForDice([die.value]);
  }, [connected, joinedRoomCode, currentActor, pendingDice, bankedDice]);

  useEffect(() => {
    if (!focusedPegId) return;
    if (!movablePegIds.includes(focusedPegId)) {
      setFocusedPegId("");
    }
  }, [focusedPegId, movablePegIds]);

  useEffect(() => {
    if (!hoveredDestinationHole) return;
    const stillValid = destinationHighlights.some((highlight) =>
      holesMatch(highlight.hole, hoveredDestinationHole)
    );
    if (!stillValid) {
      setHoveredDestinationHole(null);
    }
  }, [hoveredDestinationHole, destinationHighlights]);

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
            <b>Room:</b> {joinedRoomCode || roomCode || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Phase:</b> {phase || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Current Actor:</b> {currentActor || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Awaiting Dice:</b> {awaitingDiceDisplay}
          </span>
        </div>

        <div style={{ marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Room:
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              disabled={!!joinedRoomCode}
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
          <span style={{ marginLeft: 16 }}>
            <b>Focused Peg:</b> {focusedPegId || "-"}
          </span>
          <span style={{ marginLeft: 16 }}>
            <b>Preview:</b>{" "}
            {previewPegPlacement ? `${previewPegPlacement.pegId}` : "-"}
          </span>
        </div>

        <div
          style={{
            marginBottom: 8,
            padding: 8,
            border: "1px solid #ccc",
            background: "#fff",
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <b>Dice Display:</b>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>
                <b>Pending</b>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 62 }}>
                {pendingDice.length > 0 ? pendingDice.map((pd, index) => {
                  const selected = selectedPendingDie === String(pd.value);
                  return (
                    <button
                      key={`visual-${pd.value}-${pd.controllerId ?? "unassigned"}-${index}`}
                      onClick={() => choosePendingDie(pd.value)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: 4,
                        border: selected ? "1px solid #7aa7ff" : "1px solid #bbb",
                        borderRadius: 8,
                        background: selected ? "#eef5ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <DieFace value={pd.value} />
                      <div style={{ fontSize: 11 }}>
                        {pd.controllerId ?? "unassigned"}
                      </div>
                    </button>
                  );
                }) : <div>-- none --</div>}
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>
                <b>Banked</b>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 62 }}>
                {Array.from({ length: bankedDice }, (_, index) => (
                  <div
                    key={`banked-${index}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: 4,
                    }}
                  >
                    <DieFace value="?" />
                    <div style={{ fontSize: 11 }}>banked</div>
                  </div>
                ))}
                {bankedDice === 0 ? <div>-- none --</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={connect} disabled={connected}>
            Connect
          </button>
          <button onClick={disconnect} disabled={!connected}>
            Disconnect
          </button>
          <button onClick={createFreshRoom} disabled={!connected || !!joinedRoomCode}>
            Create Fresh Room
          </button>
          <button onClick={joinRoom} disabled={!(connected && !joinedRoomCode) || !roomCode.trim()}>
            Join Room
          </button>
          <button onClick={leaveRoom} disabled={!(connected && !!joinedRoomCode && phase !== "active")}>
            Leave Room
          </button>
          <button onClick={startGame} disabled={!(connected && !!joinedRoomCode)}>
            Start Game
          </button>
          <button onClick={resetGame} disabled={!(connected && !!joinedRoomCode)}>
            Reset Game
          </button>
          <button onClick={sendRoll} disabled={!(connected && !!joinedRoomCode)}>
            Roll
          </button>
          <button onClick={getLegalMoves} disabled={!(connected && !!joinedRoomCode)}>
            Get Legal Moves
          </button>
          <button onClick={clearLog}>Clear Log</button>
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

      <BoardRenderer
        arms={boardView.arms}
        pegPlacements={boardView.pegPlacements}
        armColors={boardView.armColors}
        movablePegIds={movablePegIds}
        destinationHighlights={destinationHighlights}
        focusedPegId={focusedPegId}
        previewPegPlacement={previewPegPlacement}
        onPegClick={handlePegClick}
        onDestinationClick={handleDestinationClick}
        onDestinationHover={handleDestinationHover}
        onDestinationLeave={handleDestinationLeave}
        onBackgroundClick={clearBoardFocus}
      />
    </div>
  );
}
