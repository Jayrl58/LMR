import { useEffect, useMemo, useRef, useState } from "react";
import BoardRenderer, {
  type BoardHolePlacement,
  type DestinationHighlight,
  type PegPlacement,
} from "./components/BoardRenderer";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { GameState } from "../../src/types";
import { PLAYER_COLOR_PALETTE } from "./constants/playerColors";

type SupportedArms = 4 | 6 | 8;

type LobbyPlayerView = {
  playerId: string;
  seat: number;
  ready: boolean;
  name: string;
};

type LobbyGameConfigView = {
  playerCount?: number;
  teamPlay?: boolean;
  killRoll?: boolean;
  doubleDice?: boolean;
  fastTrack?: boolean;
};

type LobbyViewState = {
  roomCode?: string;
  phase: string;
  expectedPlayerCount?: number;
  players: LobbyPlayerView[];
  gameConfig?: LobbyGameConfigView;
};

type LobbySeatRow = {
  seat: number;
  color: string;
  playerId: string;
  name: string;
  ready: boolean;
  occupied: boolean;
};

type PendingDieView = {
  value: number;
  controllerId: string | null;
};

type LegalMoveOption = {
  label: string;
  value: string;
  dice: number[];
};

type RawLegalMove = unknown;

type ParsedMove = Record<string, unknown>;

type GameOverResult =
  | {
      mode: "solo";
      winner: {
        playerId: string;
        name: string;
        color: string;
      };
    }
  | {
      mode: "team";
      winners: Array<{
        playerId: string;
        name: string;
        color: string;
      }>;
    };

const WS_URL = "ws://127.0.0.1:8787";
const MAX_LOBBY_SEATS = 8;
const PLAYER_COUNT_OPTIONS = [4, 6, 8] as const;
const CLIENT_ID_STORAGE_KEY = "lmr_client_id_v1";
const ROOM_CODE_STORAGE_KEY = "lmr_room_code_v1";
const DEBUG_HIGHLIGHT_COLOR = "#ff00ff";
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 12;

function getColorForSeat(seat: number): string {
  return PLAYER_COLOR_PALETTE[seat % PLAYER_COLOR_PALETTE.length];
}

function normalizeArms(playerCount: number): SupportedArms {
  if (playerCount <= 4) return 4;
  if (playerCount <= 6) return 6;
  return 8;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

function sendMessage(ws: WebSocket | null, payload: Record<string, unknown>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "client-server-render";

  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing && existing.trim()) return existing;

  let generated = "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    generated = crypto.randomUUID();
  } else {
    generated =
      "client-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36);
  }

  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

function getStoredRoomCode(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ROOM_CODE_STORAGE_KEY) ?? "";
}

function setStoredRoomCode(roomCode: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, roomCode);
}

function parseLobbyState(value: unknown): LobbyViewState | null {
  if (!isObject(value)) return null;

  const playersRaw = Array.isArray(value.players) ? value.players : [];
  const players: LobbyPlayerView[] = playersRaw
    .map((player) => {
      if (!isObject(player)) return null;
      if (typeof player.playerId !== "string") return null;
      if (typeof player.seat !== "number") return null;
      return {
        playerId: player.playerId,
        seat: player.seat,
        ready: !!player.ready,
        name:
          typeof player.name === "string" && player.name.trim()
            ? player.name
            : player.playerId,
      };
    })
    .filter((player): player is LobbyPlayerView => !!player)
    .sort((a, b) => a.seat - b.seat);

  const gameConfigRaw = isObject(value.gameConfig) ? value.gameConfig : undefined;
  const gameConfig: LobbyGameConfigView | undefined = gameConfigRaw
    ? {
        playerCount:
          typeof gameConfigRaw.playerCount === "number" ? gameConfigRaw.playerCount : undefined,
        teamPlay: !!gameConfigRaw.teamPlay,
        killRoll: !!gameConfigRaw.killRoll,
        doubleDice: !!gameConfigRaw.doubleDice,
        fastTrack: !!gameConfigRaw.fastTrack,
      }
    : undefined;

  return {
    roomCode: typeof value.roomCode === "string" ? value.roomCode : undefined,
    phase: typeof value.phase === "string" ? value.phase : "",
    expectedPlayerCount:
      typeof value.expectedPlayerCount === "number" ? value.expectedPlayerCount : undefined,
    players,
    gameConfig,
  };
}

function normalizePlayerNameInput(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getPlayerNameValidationError(
  draftValue: string,
  playerId: string,
  lobby: LobbyViewState | null
): string {
  const normalized = normalizePlayerNameInput(draftValue);

  if (!normalized) return "Name is required.";
  if (normalized.length < MIN_NAME_LENGTH) return `Name must be at least ${MIN_NAME_LENGTH} character${MIN_NAME_LENGTH === 1 ? "" : "s"}.`;
  if (normalized.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!/^[A-Za-z0-9 ]+$/.test(normalized)) return "Use letters, numbers, and spaces only.";

  const duplicateExists = (lobby?.players ?? []).some((player) => {
    if (player.playerId === playerId) return false;
    return normalizePlayerNameInput(player.name).toLowerCase() === normalized.toLowerCase();
  });

  if (duplicateExists) return "Name must be unique.";

  return "";
}

function getCurrentTurnPlayerId(gameState: GameState): string {
  const turn = gameState.turn as unknown;
  if (!isObject(turn)) return "";
  if (typeof turn.nextActorId === "string") return turn.nextActorId;
  if (typeof turn.currentPlayerId === "string") return turn.currentPlayerId;
  if (typeof turn.playerId === "string") return turn.playerId;
  if (typeof turn.actorId === "string") return turn.actorId;
  return "";
}

function getTeamDisplayLabel(gameState: GameState, playerId: string): string {
  if (!playerId) return "-";

  const teamId =
    isObject(gameState.players) &&
    isObject((gameState.players as Record<string, unknown>)[playerId]) &&
    typeof ((gameState.players as Record<string, any>)[playerId]?.teamId) === "string"
      ? String((gameState.players as Record<string, any>)[playerId].teamId)
      : "";

  if (!teamId) return "-";

  const teams = Array.isArray(gameState.config.options?.teams) ? gameState.config.options?.teams : [];
  const idx = teams.findIndex((team: any) => team?.teamId === teamId);
  if (idx >= 0) return `Team ${idx + 1}`;
  return teamId;
}


function mergeTurnIntoGameState(gameState: GameState, turnOverride: unknown): GameState {
  if (!isObject(turnOverride)) return gameState;
  return {
    ...gameState,
    turn: {
      ...(isObject(gameState.turn) ? gameState.turn : {}),
      ...turnOverride,
    },
  };
}

function parsePendingDiceFromTurn(turnValue: unknown): PendingDieView[] {
  if (!isObject(turnValue)) return [];
  const raw = Array.isArray(turnValue.pendingDice) ? turnValue.pendingDice : [];
  return raw
    .map((entry) => {
      if (typeof entry === "number" && Number.isInteger(entry)) {
        return { value: entry, controllerId: null };
      }
      if (!isObject(entry)) return null;
      if (typeof entry.value !== "number" || !Number.isInteger(entry.value)) return null;
      return {
        value: entry.value,
        controllerId: typeof entry.controllerId === "string" ? entry.controllerId : null,
      };
    })
    .filter((entry): entry is PendingDieView => !!entry);
}

function parsePendingDice(gameState: GameState): PendingDieView[] {
  return parsePendingDiceFromTurn(gameState.turn as unknown);
}

function getPendingDieControllerId(
  pendingDice: PendingDieView[],
  dieValue: string
): string | null | undefined {
  if (!dieValue) return undefined;
  const match = pendingDice.find((die) => String(die.value) === dieValue);
  return match ? match.controllerId : undefined;
}

function parseBankedDice(turnValue: unknown): number {
  if (!isObject(turnValue)) return 0;
  return typeof turnValue.bankedDice === "number" && Number.isInteger(turnValue.bankedDice)
    ? turnValue.bankedDice
    : 0;
}

function computeExpectedRollCountForUi(gameState: GameState, turnOverride?: unknown): number {
  const turnValue = turnOverride ?? (gameState.turn as unknown);
  const pendingDice = parsePendingDiceFromTurn(turnValue);
  const bankedDice = parseBankedDice(turnValue);
  const awaitingDice = isObject(turnValue) && turnValue.awaitingDice === true;

  if (pendingDice.length > 0) return 0;
  if (bankedDice > 0) return bankedDice;

  if (awaitingDice) {
    return gameState.config.options?.doubleDice ? 2 : 1;
  }

  return 0;
}

function buildLobbySeatRows(lobby: LobbyViewState | null): LobbySeatRow[] {
  const playerBySeat = new Map<number, LobbyPlayerView>();
  (lobby?.players ?? []).forEach((player) => {
    playerBySeat.set(player.seat, player);
  });

  return Array.from({ length: MAX_LOBBY_SEATS }, (_, seat) => {
    const player = playerBySeat.get(seat);
    return {
      seat,
      color: getColorForSeat(seat),
      playerId: player?.playerId ?? "",
      name: player?.name ?? "",
      ready: player?.ready ?? false,
      occupied: !!player,
    };
  });
}

function parseDiceList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((die): die is number => typeof die === "number" && Number.isInteger(die));
}

function parseRollValues(values: string[]): number[] {
  return values
    .map((value) => Number(value.trim()))
    .filter((die) => Number.isInteger(die) && die >= 1 && die <= 6);
}

function resizeRollValues(previous: string[], nextCount: number): string[] {
  if (nextCount <= 0) return [];
  return Array.from({ length: nextCount }, (_, index) => previous[index] ?? "");
}

function parseMoveLabel(move: Record<string, unknown>, fallbackIndex: number): string {
  if (typeof move.label === "string" && move.label.trim()) return move.label;
  if (typeof move.description === "string" && move.description.trim()) return move.description;
  if (typeof move.summary === "string" && move.summary.trim()) return move.summary;
  const pegIndex = typeof move.pegIndex === "number" ? move.pegIndex : null;
  return pegIndex === null ? `Move ${fallbackIndex + 1}` : `Peg ${pegIndex}`;
}

function parseLegalMoveOptions(value: unknown): LegalMoveOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((move, index) => {
      if (!isObject(move)) return null;

      const dice =
        parseDiceList(move.dice).length > 0
          ? parseDiceList(move.dice)
          : typeof move.die === "number" && Number.isInteger(move.die)
            ? [move.die]
            : [];

      return {
        label: parseMoveLabel(move, index),
        value: JSON.stringify(move),
        dice,
      };
    })
    .filter((move): move is LegalMoveOption => !!move);
}

function parseMove(option: LegalMoveOption): ParsedMove | null {
  try {
    const parsed = JSON.parse(option.value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getMovePegId(move: ParsedMove): string | null {
  const playerId =
    typeof move.playerId === "string"
      ? move.playerId
      : typeof move.actorPlayerId === "string"
        ? move.actorPlayerId
        : typeof move.ownerPlayerId === "string"
          ? move.ownerPlayerId
          : null;

  const pegIndex =
    typeof move.pegIndex === "number" && Number.isInteger(move.pegIndex)
      ? move.pegIndex
      : null;

  if (!playerId || pegIndex === null) return null;
  return `${playerId}-${pegIndex}`;
}

function getMovablePegIds(legalMoveOptions: LegalMoveOption[], selectedDie: string): string[] {
  if (!selectedDie) return [];

  const selectedDieValue = Number(selectedDie);
  if (!Number.isInteger(selectedDieValue)) return [];

  const ids = new Set<string>();

  legalMoveOptions.forEach((option) => {
    if (option.dice.length > 0 && !option.dice.includes(selectedDieValue)) return;

    const move = parseMove(option);
    if (!move) return;

    const pegId = getMovePegId(move);
    if (!pegId) return;

    ids.add(pegId);
  });

  return Array.from(ids);
}

function getMoveTargetPosition(move: ParsedMove): unknown {
  return move.to ?? move.destination ?? move.target ?? move.end ?? move.toPosition ?? null;
}

function getMoveActorPlayerId(move: ParsedMove, fallbackPlayerId: string): string {
  const explicit =
    typeof move.actorPlayerId === "string"
      ? move.actorPlayerId
      : typeof move.playerId === "string"
        ? move.playerId
        : typeof move.ownerPlayerId === "string"
          ? move.ownerPlayerId
          : fallbackPlayerId;

  return explicit;
}

function mapMovePositionToHole(
  position: unknown,
  fallbackPlayerId: string,
  boardArms: SupportedArms
): BoardHolePlacement | null {
  if (!isObject(position)) return null;

  if (position.kind === "center" || position.zone === "center") {
    return { type: "center" };
  }

  if (
    (position.kind === "track" || position.zone === "track") &&
    typeof position.index === "number" &&
    Number.isInteger(position.index)
  ) {
    const trackIndex = position.index;
    const spotsPerArm = 14;
    const arm = Math.floor(trackIndex / spotsPerArm);
    const spot = trackIndex % spotsPerArm;
    if (arm < 0 || arm >= boardArms || spot < 0 || spot >= spotsPerArm) return null;
    return { type: "track", arm, spot };
  }

  if (position.kind === "home" || position.zone === "home") {
    const playerId =
      typeof position.playerId === "string" ? position.playerId : fallbackPlayerId;
    const slot =
      typeof position.slot === "number" && Number.isInteger(position.slot)
        ? position.slot
        : typeof position.index === "number" && Number.isInteger(position.index)
          ? position.index
          : null;
    const arm = Number(playerId.replace(/^p/, ""));
    if (!Number.isInteger(arm) || arm < 0 || arm >= boardArms || slot === null) return null;
    return { type: "home", arm, slot };
  }

  if (position.kind === "base" || position.zone === "base") {
    const playerId =
      typeof position.playerId === "string" ? position.playerId : fallbackPlayerId;
    const slot =
      typeof position.slot === "number" && Number.isInteger(position.slot)
        ? position.slot
        : null;
    const arm = Number(playerId.replace(/^p/, ""));
    if (!Number.isInteger(arm) || arm < 0 || arm >= boardArms || slot === null) return null;
    return { type: "base", arm, slot };
  }

  return null;
}

function holesEqual(a: BoardHolePlacement, b: BoardHolePlacement): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "center" && b.type === "center") return true;
  if (a.type === "track" && b.type === "track") return a.arm === b.arm && a.spot === b.spot;
  if (a.type === "home" && b.type === "home") return a.arm === b.arm && a.slot === b.slot;
  if (a.type === "base" && b.type === "base") return a.arm === b.arm && a.slot === b.slot;
  return false;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getReadableTextColor(backgroundHex: string): string {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return "#111111";

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness >= 150 ? "#111111" : "#ffffff";
}

function mixChannel(a: number, b: number, amount: number): number {
  return Math.round(a + (b - a) * amount);
}

function mixHexColors(baseHex: string, targetHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;

  const r = mixChannel(base.r, target.r, amount);
  const g = mixChannel(base.g, target.g, amount);
  const b = mixChannel(base.b, target.b, amount);

  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getDieShellStyle(color: string, disabled = false) {
  const textColor = getReadableTextColor(color);

  return {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    border: `2px solid ${mixHexColors(color, "#000000", 0.22)}`,
    background: disabled ? mixHexColors(color, "#ffffff", 0.45) : color,
    color: disabled ? mixHexColors(textColor, "#ffffff", 0.35) : textColor,
    boxShadow: disabled ? "none" : "inset 0 -2px 0 rgba(0,0,0,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
    fontWeight: 700,
    fontSize: "18px",
    lineHeight: 1,
  };
}

function buildDestinationHighlights(
  legalMoveOptions: LegalMoveOption[],
  selectedDie: string,
  selectedPegId: string | null,
  fallbackPlayerId: string,
  boardArms: SupportedArms
): DestinationHighlight[] {
  if (!selectedDie) return [];

  const selectedDieValue = Number(selectedDie);
  if (!Number.isInteger(selectedDieValue)) return [];

  const byKey = new Map<string, DestinationHighlight>();

  legalMoveOptions.forEach((option) => {
    if (option.dice.length > 0 && !option.dice.includes(selectedDieValue)) return;

    const move = parseMove(option);
    if (!move) return;

    const pegId = getMovePegId(move);
    if (selectedPegId && pegId !== selectedPegId) return;

    const actorPlayerId = getMoveActorPlayerId(move, fallbackPlayerId);
    const destinationPosition = getMoveTargetPosition(move);
    const destinationHole = mapMovePositionToHole(destinationPosition, actorPlayerId, boardArms);
    if (!destinationHole) return;

    const key = JSON.stringify(destinationHole);
    if (byKey.has(key)) return;

    byKey.set(key, {
      hole: destinationHole,
      color: DEBUG_HIGHLIGHT_COLOR,
    });
  });

  return Array.from(byKey.values());
}

function findMoveForDestination(
  legalMoveOptions: LegalMoveOption[],
  selectedDie: string,
  selectedPegId: string | null,
  clickedHole: BoardHolePlacement,
  fallbackPlayerId: string,
  boardArms: SupportedArms
): LegalMoveOption | null {
  if (!selectedDie) return null;

  const selectedDieValue = Number(selectedDie);
  if (!Number.isInteger(selectedDieValue)) return null;

  for (const option of legalMoveOptions) {
    if (option.dice.length > 0 && !option.dice.includes(selectedDieValue)) continue;

    const move = parseMove(option);
    if (!move) continue;

    const pegId = getMovePegId(move);
    if (selectedPegId && pegId !== selectedPegId) continue;

    const actorPlayerId = getMoveActorPlayerId(move, fallbackPlayerId);
    const destinationPosition = getMoveTargetPosition(move);
    const destinationHole = mapMovePositionToHole(destinationPosition, actorPlayerId, boardArms);
    if (!destinationHole) continue;

    if (holesEqual(destinationHole, clickedHole)) return option;
  }

  return null;
}

function LobbyView(props: {
  connected: boolean;
  playerId: string;
  playerDisplayName: string;
  phase: string;
  roomCode: string;
  roomCodeInput: string;
  joinedRoom: boolean;
  lobby: LobbyViewState | null;
  localPlayerNameDraft: string;
  localPlayerNameError: string;
  onLocalPlayerNameDraftChange: (value: string) => void;
  onCommitLocalPlayerName: () => void;
  onRoomCodeInputChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onStartGame: () => void;
  onUpdateGameConfig: (patch: Partial<LobbyGameConfigView>) => void;
  isOwner: boolean;
  isLocalPlayerReadyEligible: boolean;
}) {
  const {
    connected,
    playerId,
    playerDisplayName,
    phase,
    roomCode,
    roomCodeInput,
    joinedRoom,
    lobby,
    localPlayerNameDraft,
    localPlayerNameError,
    onLocalPlayerNameDraftChange,
    onCommitLocalPlayerName,
    onRoomCodeInputChange,
    onCreateRoom,
    onJoinRoom,
    onToggleReady,
    onStartGame,
    onUpdateGameConfig,
    isOwner,
    isLocalPlayerReadyEligible,
  } = props;

  const seatRows = useMemo(() => buildLobbySeatRows(lobby), [lobby]);
  const seatedCount = seatRows.filter((row) => row.occupied).length;
  const allSeatedReady = seatedCount > 0 && seatRows.filter((row) => row.occupied).every((row) => row.ready);
  const expectedCount = lobby?.expectedPlayerCount;
  const gameConfig = lobby?.gameConfig ?? {};
  const selectedPlayerCount =
    typeof gameConfig.playerCount === "number"
      ? gameConfig.playerCount
      : typeof expectedCount === "number"
        ? expectedCount
        : 4;
  const ownerSeat = seatRows.find((row) => row.occupied)?.seat;
  const isRoomFull = seatedCount === selectedPlayerCount;
  const canStartGame = connected && isRoomFull && allSeatedReady;
  const canCreateRoom = connected && (!joinedRoom || isOwner);
  const canJoinRoom = connected && !joinedRoom && !!roomCodeInput.trim();
  const inactiveEntryButtonStyle = {
    opacity: 0.55,
    cursor: "default" as const,
  };

  return (
    <div>
      <div>
        <b>Status:</b> {connected ? "Connected" : "Disconnected"} |{" "}
        <b>Player:</b> {playerDisplayName || "-"} | <b>Phase:</b> {phase || "-"} |{" "}
        <b>Room:</b> {roomCode || "-"}
      </div>

      <div style={{ margin: "10px 0", display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          value={roomCodeInput}
          onChange={(e) => onRoomCodeInputChange(e.target.value.toUpperCase())}
          placeholder="Room Code"
          maxLength={6}
          style={{ width: "120px", textTransform: "uppercase" }}
        />
        <button
          onClick={onCreateRoom}
          disabled={!canCreateRoom}
          style={!canCreateRoom ? inactiveEntryButtonStyle : undefined}
        >
          Create Room
        </button>
        <button
          onClick={onJoinRoom}
          disabled={!canJoinRoom}
          style={!canJoinRoom ? inactiveEntryButtonStyle : undefined}
        >
          Join Room
        </button>
      </div>

      {joinedRoom && (
        <>
          <div style={{ marginBottom: "12px" }}>
            <b>Players:</b> {seatedCount} / {selectedPlayerCount}
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                padding: "10px",
                border: "1px solid #666",
                width: "fit-content",
                minWidth: "460px",
              }}
            >
              <div style={{ marginBottom: "6px" }}>
                <b>Lobby Seats</b>
              </div>

              <table style={{ borderCollapse: "collapse", minWidth: "460px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Seat</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Color</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666", width: "12ch" }}>Player</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Team</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Ready</th>
                  </tr>
                </thead>
                <tbody>
                  {seatRows.map((row) => {
                    const isCurrentPlayer = row.playerId !== "" && row.playerId === playerId;
                    const isSeatEnabled = row.seat < selectedPlayerCount;
                    const rowIsUnavailable = !isSeatEnabled;

                    return (
                      <tr
                        key={row.seat}
                        style={{
                          backgroundColor: rowIsUnavailable
                            ? "rgba(0,0,0,0.06)"
                            : isCurrentPlayer
                              ? "rgba(255,255,255,0.08)"
                              : undefined,
                          fontWeight: isCurrentPlayer ? "bold" : undefined,
                          color: rowIsUnavailable ? "#777" : undefined,
                        }}
                      >
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                          {row.seat === ownerSeat ? "👑" : row.seat}
                        </td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                          {rowIsUnavailable ? (
                            <span style={{ color: "#777" }}>-</span>
                          ) : (
                            <span style={{ color: row.color, fontWeight: "bold" }}>{row.color}</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "4px 8px",
                            borderBottom: "1px solid #333",
                            width: "12ch",
                            minWidth: "12ch",
                            maxWidth: "12ch",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {rowIsUnavailable ? (
                            "Unavailable"
                          ) : isCurrentPlayer ? (
                            <div>
                              <input
                                type="text"
                                value={localPlayerNameDraft}
                                onChange={(e) => onLocalPlayerNameDraftChange(e.target.value)}
                                onBlur={onCommitLocalPlayerName}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    onCommitLocalPlayerName();
                                  }
                                }}
                                placeholder="Enter name"
                                maxLength={MAX_NAME_LENGTH + 4}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  border: localPlayerNameError ? "1px solid #b00020" : "1px solid #666",
                                  padding: "2px 4px",
                                  fontWeight: 600,
                                }}
                              />
                              {localPlayerNameError ? (
                                <div
                                  style={{
                                    marginTop: "2px",
                                    fontSize: "11px",
                                    lineHeight: 1.2,
                                    color: "#b00020",
                                    whiteSpace: "normal",
                                  }}
                                >
                                  {localPlayerNameError}
                                </div>
                              ) : null}
                            </div>
                          ) : row.occupied ? (
                            row.name
                          ) : (
                            "Empty"
                          )}
                        </td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                          {rowIsUnavailable ? "-" : "—"}
                        </td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                          {rowIsUnavailable ? (
                            "-"
                          ) : isCurrentPlayer ? (
                            <input
                              type="checkbox"
                              checked={row.ready}
                              onChange={(e) => onToggleReady(e.target.checked)}
                              disabled={!connected || !row.occupied || !isLocalPlayerReadyEligible}
                            />
                          ) : row.occupied ? (
                            row.ready ? "✔" : "—"
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{ padding: "10px", border: "1px solid #666", width: "fit-content", minWidth: "220px" }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <b>Pre-Game Options</b>
                </div>

                <label style={{ display: "block", marginBottom: "10px" }}>
                  <span style={{ marginRight: "8px" }}>Player Count</span>
                  <select
                    value={String(selectedPlayerCount)}
                    onChange={(e) => onUpdateGameConfig({ playerCount: Number(e.target.value) })}
                    disabled={!connected}
                  >
                    {PLAYER_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "block", marginBottom: "6px" }}>
                  <input
                    type="checkbox"
                    checked={!!gameConfig.teamPlay}
                    onChange={(e) => onUpdateGameConfig({ teamPlay: e.target.checked })}
                    disabled={!connected}
                  />{" "}
                  Team Play
                </label>

                <label style={{ display: "block", marginBottom: "6px" }}>
                  <input
                    type="checkbox"
                    checked={!!gameConfig.killRoll}
                    onChange={(e) => onUpdateGameConfig({ killRoll: e.target.checked })}
                    disabled={!connected}
                  />{" "}
                  Kill Rules
                </label>

                <label style={{ display: "block", marginBottom: "6px" }}>
                  <input
                    type="checkbox"
                    checked={!!gameConfig.doubleDice}
                    onChange={(e) => onUpdateGameConfig({ doubleDice: e.target.checked })}
                    disabled={!connected}
                  />{" "}
                  Double Dice
                </label>

                <label style={{ display: "block", marginBottom: "6px" }}>
                  <input
                    type="checkbox"
                    checked={!!gameConfig.fastTrack}
                    onChange={(e) => onUpdateGameConfig({ fastTrack: e.target.checked })}
                    disabled={!connected}
                  />{" "}
                  Fast Track
                </label>
              </div>

              <div
                style={{ padding: "10px", border: "1px solid #666", width: "fit-content", minWidth: "220px" }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <b>Start</b>
                </div>

                <button
                  onClick={onStartGame}
                  disabled={!(canStartGame && isOwner)}
                  style={{
                    color: canStartGame && isOwner ? "green" : undefined,
                    fontWeight: canStartGame && isOwner ? 700 : undefined,
                    backgroundColor: canStartGame && isOwner ? "#e6ffe6" : undefined,
                    borderColor: canStartGame && isOwner ? "green" : undefined,
                  }}
                >
                  Start Game
                </button>

                {!canStartGame ? (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#333",
                    }}
                  >
                    {!isRoomFull
                      ? "Room must be full to start."
                      : !allSeatedReady && seatedCount > 0
                      ? "All players must be ready to start."
                      : ""}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GameView(props: {
  connected: boolean;
  playerId: string;
  playerDisplayName: string;
  phase: string;
  roomCode: string;
  gameState: GameState;
  selectedDie: string;
  latestMessageType: string;
  latestStatusText: string;
  pendingDice: PendingDieView[];
  localRolledDice: number[];
  bankedDice: number;
  expectedRollCount: number;
  rollValues: string[];
  legalMoveOptions: LegalMoveOption[];
  destinationHighlights: DestinationHighlight[];
  movablePegIds: string[];
  selectedPegId: string | null;
  firstLegalMoveRaw: string;
  canForfeitPendingDice: boolean;
  gameOverResult: GameOverResult | null;
  isOwner: boolean;
  onRollValueChange: (index: number, value: string) => void;
  onRoll: () => void;
  onSelectDie: (value: string) => void;
  onPegClick: (pegId: string) => void;
  onDestinationClick: (hole: BoardHolePlacement) => void;
  onBackgroundClick: () => void;
  onForfeitPendingDice: () => void;
  onReturnToLobby: () => void;
}) {
  const {
    connected,
    playerId,
    playerDisplayName,
    phase,
    roomCode,
    gameState,
    selectedDie,
    latestMessageType,
    latestStatusText,
    pendingDice,
    localRolledDice,
    bankedDice,
    expectedRollCount,
    rollValues,
    legalMoveOptions,
    destinationHighlights,
    movablePegIds,
    selectedPegId,
    firstLegalMoveRaw,
    canForfeitPendingDice,
    gameOverResult,
    isOwner,
    onRollValueChange,
    onRoll,
    onSelectDie,
    onPegClick,
    onDestinationClick,
    onBackgroundClick,
    onForfeitPendingDice,
    onReturnToLobby,
  } = props;

  const uiState = useMemo(() => mapGameStateToUI(gameState), [gameState]);
  const arms = normalizeArms(gameState.config.playerCount);

  const playerSeatById = useMemo(
    () => new Map<string, number>(uiState.players.map((player) => [String(player.playerId), player.seat])),
    [uiState.players]
  );

  const pegPlacements: PegPlacement[] = useMemo(
    () =>
      uiState.pegs.map((peg) => {
        const seat = playerSeatById.get(String(peg.playerId)) ?? 0;
        return {
          pegId: `${peg.playerId}-${peg.pegIndex}`,
          hole: mapPositionToBoardHole(peg.position, seat, arms),
          color: getColorForSeat(seat),
          isFinished: !!peg.isFinished,
        };
      }),
    [uiState.pegs, playerSeatById, arms]
  );

  const armColors = useMemo(() => {
    const values = Array.from({ length: arms }, () => "");
    uiState.players.forEach((player) => {
      if (player.seat >= 0 && player.seat < arms) {
        values[player.seat] = getColorForSeat(player.seat);
      }
    });
    return values;
  }, [uiState.players, arms]);

  const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
  const turnSeat = playerSeatById.get(currentTurnPlayerId);
  const turnColorText = typeof turnSeat === "number" ? getColorForSeat(turnSeat) : "-";
  const playerTeamLabel = getTeamDisplayLabel(gameState, playerId);
  const showTeamRows = gameState.config.options?.teamPlay === true;
  const isCurrentPlayerTurn = !!playerId && playerId === currentTurnPlayerId;
  const effectivePendingDice =
    pendingDice.length > 0
      ? pendingDice
      : localRolledDice.map((value) => ({ value, controllerId: currentTurnPlayerId || null }));
  const effectiveExpectedRollCount = effectivePendingDice.length > 0 ? 0 : expectedRollCount;
  const localPlayerSeat = playerSeatById.get(playerId);
  const diceColor =
    typeof localPlayerSeat === "number"
      ? getColorForSeat(localPlayerSeat)
      : typeof turnSeat === "number"
        ? getColorForSeat(turnSeat)
        : getColorForSeat(0);
  const rollButtonBackground =
    connected && isCurrentPlayerTurn && effectiveExpectedRollCount > 0
      ? mixHexColors(diceColor, "#ffffff", 0.18)
      : mixHexColors(diceColor, "#ffffff", 0.5);
  const rollButtonText = getReadableTextColor(rollButtonBackground);
  const ownerDisplay = isOwner ? `${playerId || "-"}` : "-";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "fit-content",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 2,
            width: "190px",
            padding: "10px",
            border: "1px solid #666",
            background: "rgba(250, 250, 250, 0.96)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <b>Status</b>
          </div>

          <div style={{ marginBottom: "6px" }}>
            <b>Player:</b> {playerDisplayName || "-"}
          </div>

          <div style={{ marginBottom: "6px" }}>
            <b>Owner:</b> {ownerDisplay}
          </div>

          {showTeamRows ? (
            <div style={{ marginBottom: "6px" }}>
              <b>Team:</b> {playerTeamLabel}
            </div>
          ) : null}

          <div style={showTeamRows ? { marginBottom: "6px" } : undefined}>
            <b>Turn:</b>{" "}
            <span style={{ color: turnColorText === "-" ? undefined : turnColorText, fontWeight: "bold" }}>
              {turnColorText}
            </span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            zIndex: 2,
            width: "190px",
            padding: "10px",
            border: "1px solid #666",
            background: "rgba(250, 250, 250, 0.96)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <b>Options</b>
          </div>

          <div style={{ marginBottom: "6px" }}>
            <b>Double Dice:</b> {gameState.config.options?.doubleDice ? "On" : "Off"}
          </div>

          <div style={{ marginBottom: "6px" }}>
            <b>Kill Roll:</b> {gameState.config.options?.killRoll ? "On" : "Off"}
          </div>

          <div style={{ marginBottom: "6px" }}>
            <b>Team Play:</b> {gameState.config.options?.teamPlay ? "On" : "Off"}
          </div>

          <div>
            <b>Fast Track:</b> {gameState.config.options?.fastTrack ? "On" : "Off"}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 2,
            width: "292px",
            padding: "10px",
            border: "1px solid #666",
            background: "rgba(250, 250, 250, 0.96)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {effectiveExpectedRollCount > 0 ? (
            <div style={{ marginBottom: "10px" }}>
              <b style={{ marginRight: "8px" }}>Roll:</b>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap", verticalAlign: "middle" }}>
                {rollValues.map((value, index) => {
                  const dieStyle = getDieShellStyle(diceColor, !connected || !isCurrentPlayerTurn);
                  return (
                    <div
                      key={index}
                      style={{
                        ...dieStyle,
                        padding: "0",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={value}
                        onChange={(e) => onRollValueChange(index, e.target.value)}
                        placeholder="-"
                        disabled={!connected || !isCurrentPlayerTurn}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          color: dieStyle.color,
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: "18px",
                          outline: "none",
                          padding: "0",
                        }}
                      />
                    </div>
                  );
                })}

                <button
                  onClick={onRoll}
                  disabled={!connected || !isCurrentPlayerTurn || effectiveExpectedRollCount === 0 || !!gameOverResult}
                  style={{
                    minWidth: "64px",
                    height: "42px",
                    borderRadius: "10px",
                    border: `2px solid ${mixHexColors(diceColor, "#000000", 0.22)}`,
                    background: rollButtonBackground,
                    color: rollButtonText,
                    fontWeight: 700,
                    boxShadow:
                      !connected || !isCurrentPlayerTurn || effectiveExpectedRollCount === 0
                        ? "none"
                        : "inset 0 -2px 0 rgba(0,0,0,0.18)",
                    cursor:
                      !connected || !isCurrentPlayerTurn || effectiveExpectedRollCount === 0
                        ? "default"
                        : "pointer",
                  }}
                >
                  Roll
                </button>
              </span>
            </div>
          ) : null}

          {effectivePendingDice.length > 0 ? (
            <div style={{ marginBottom: "10px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap", verticalAlign: "middle" }}>
                {effectivePendingDice.map((die, index) => {
                  const dieValue = String(die.value);
                  const isSelected = selectedDie === dieValue;

                  return (
                    <button
                      key={`${die.value}-${index}`}
                      onClick={() => onSelectDie(dieValue)}
                      disabled={!connected || !!gameOverResult}
                      style={{
                        ...getDieShellStyle(diceColor, !connected),
                        cursor: connected ? "pointer" : "default",
                        outline: "none",
                        transform: isSelected ? "scale(1.06)" : "scale(1)",
                        boxShadow: isSelected
                          ? "0 0 0 3px rgba(255,255,255,0.98), 0 0 0 6px rgba(0,0,0,0.62), 0 4px 10px rgba(0,0,0,0.28), inset 0 -2px 0 rgba(0,0,0,0.18)"
                          : "inset 0 -2px 0 rgba(0,0,0,0.18)",
                      }}
                    >
                      {die.value}
                    </button>
                  );
                })}
              </span>
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "nowrap" }}>
            <div>
              <b>Bank:</b> {bankedDice}
            </div>
            {canForfeitPendingDice ? (
              <button
                onClick={onForfeitPendingDice}
                disabled={!!gameOverResult}
                style={{
                  height: "32px",
                  borderRadius: "8px",
                  border: "1px solid #666",
                  background: "#f3f3f3",
                  padding: "0 10px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                No Legal Moves — Pass
              </button>
            ) : null}
          </div>
        </div>

        <BoardRenderer
          arms={arms}
          pegPlacements={pegPlacements}
          movablePegIds={gameOverResult ? [] : movablePegIds}
          focusedPegId={gameOverResult ? "" : selectedPegId ?? ""}
          armColors={armColors}
          arrowIndicators={[]}
          destinationHighlights={gameOverResult ? [] : destinationHighlights}
          onPegClick={gameOverResult ? () => {} : onPegClick}
          onDestinationClick={gameOverResult ? () => {} : onDestinationClick}
          onBackgroundClick={gameOverResult ? () => {} : onBackgroundClick}
        />

        {gameOverResult ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              background: "rgba(0, 0, 0, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                minWidth: "320px",
                maxWidth: "420px",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #555",
                background: "#ffffff",
                boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "26px", fontWeight: 800, marginBottom: "14px" }}>
                GAME OVER!
              </div>

              {gameOverResult.mode === "solo" ? (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: 700, marginBottom: "6px" }}>Winner</div>
                  <div>
                    <span style={{ color: gameOverResult.winner.color, fontWeight: 700 }}>
                      {gameOverResult.winner.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: 700, marginBottom: "6px" }}>Winning Team</div>
                  {gameOverResult.winners.map((winner) => (
                    <div key={winner.playerId} style={{ marginBottom: "4px" }}>
                      <span style={{ color: winner.color, fontWeight: 700 }}>
                        {winner.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onReturnToLobby}
                disabled={!isOwner}
                style={{
                  height: "38px",
                  minWidth: "150px",
                  borderRadius: "8px",
                  border: "1px solid #444",
                  background: isOwner ? "#ececec" : "#d0d0d0",
                  color: "#111111",
                  fontWeight: 700,
                  cursor: isOwner ? "pointer" : "default",
                }}
              >
                Return to Lobby
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          width: "320px",
          padding: "10px",
          border: "1px solid #666",
          background: "#fafafa",
          alignSelf: "stretch",
          boxSizing: "border-box",
        }}
      >
        <div style={{ marginBottom: "8px" }}>
          <b>Debug</b>
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Selected Die:</b> {selectedDie || "-"}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Expected Roll Count:</b> {effectiveExpectedRollCount}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Legal Moves:</b> {legalMoveOptions.length}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Destination Highlights:</b> {destinationHighlights.length}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Highlight Color:</b> {DEBUG_HIGHLIGHT_COLOR}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Latest Message:</b> {latestMessageType || "-"}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Status Text:</b> {latestStatusText || "-"}
        </div>

        <div style={{ marginBottom: "10px" }}>
          <b>Raw Game Config:</b>
          <pre
            style={{
              margin: "6px 0 0 0",
              fontSize: "11px",
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(gameState.config, null, 2)}
          </pre>
        </div>

        <div>
          <b>First Legal Move Raw:</b>
          <pre
            style={{
              margin: "6px 0 0 0",
              fontSize: "11px",
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              overflowX: "auto",
            }}
          >
            {firstLegalMoveRaw || "-"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [phase, setPhase] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState(getStoredRoomCode());
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [lobby, setLobby] = useState<LobbyViewState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(null);
  const [selectedDie, setSelectedDie] = useState("");
  const [pendingDice, setPendingDice] = useState<PendingDieView[]>([]);
  const [bankedDice, setBankedDice] = useState(0);
  const [expectedRollCount, setExpectedRollCount] = useState(0);
  const [rollValues, setRollValues] = useState<string[]>([""]);
  const [localRolledDice, setLocalRolledDice] = useState<number[]>([]);
  const [legalMoveOptions, setLegalMoveOptions] = useState<LegalMoveOption[]>([]);
  const [rawLegalMoves, setRawLegalMoves] = useState<RawLegalMove[]>([]);
  const [selectedPegId, setSelectedPegId] = useState<string | null>(null);
  const [latestMessageType, setLatestMessageType] = useState("");
  const [latestStatusText, setLatestStatusText] = useState("");
  const [localPlayerNameDraft, setLocalPlayerNameDraft] = useState("");
  const [lastLobbySeededLocalPlayerName, setLastLobbySeededLocalPlayerName] = useState("");

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const clientId = getOrCreateClientId();
      sendMessage(ws, { type: "hello", clientId });
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setLatestMessageType(typeof message.type === "string" ? message.type : "");

      if (message.type === "roomJoined") {
        if (typeof message.playerId === "string") setPlayerId(message.playerId);
        if (typeof message.roomCode === "string") {
          setRoomCode(message.roomCode);
          setRoomCodeInput(message.roomCode);
          setStoredRoomCode(message.roomCode);
        }
        setJoinedRoom(true);
        setGameOverResult(null);
        setLatestStatusText(`Joined room ${typeof message.roomCode === "string" ? message.roomCode : ""}`.trim());
      }

      if (message.type === "lobbySync") {
        const parsedLobby = parseLobbyState(message.lobby);
        if (parsedLobby) {
          setLobby(parsedLobby);
          setPhase(parsedLobby.phase);
          if (parsedLobby.roomCode) {
            setRoomCode(parsedLobby.roomCode);
            setRoomCodeInput(parsedLobby.roomCode);
            setStoredRoomCode(parsedLobby.roomCode);
          }
        }
        setGameOverResult(null);
        setLatestStatusText("Lobby synchronized");
      }

      if (message.type === "stateSync") {
        const parsedState = parseJsonIfString(message.state);
        if (isGameState(parsedState)) {
          const turnEnvelope = isObject(message.turn) ? message.turn : (parsedState.turn as unknown);
          const mergedState = mergeTurnIntoGameState(parsedState, turnEnvelope);

          setGameState(mergedState);
          setPhase(mergedState.phase);
          setPendingDice(parsePendingDiceFromTurn(turnEnvelope));
          setBankedDice(parseBankedDice(turnEnvelope));
          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setLocalRolledDice([]);
          setSelectedDie("");
          setSelectedPegId(null);

          const nextExpectedRollCount =
            typeof message.expectedRollCount === "number" && Number.isInteger(message.expectedRollCount)
              ? message.expectedRollCount
              : computeExpectedRollCountForUi(mergedState, turnEnvelope);
          setExpectedRollCount(nextExpectedRollCount);
          setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));
        } else {
          setPendingDice([]);
          setBankedDice(0);
          setExpectedRollCount(0);
          setRollValues([]);
          setLocalRolledDice([]);
        }

        setLatestStatusText("Game state synchronized");
      }

      if (message.type === "gameOver") {
        const result = message.result;
        if (isObject(result) && result.mode === "solo" && isObject(result.winner)) {
          const winner = result.winner;
          if (
            typeof winner.playerId === "string" &&
            typeof winner.name === "string"
          ) {
            const fallbackSeat = Number(String(winner.playerId).replace(/^p/, ""));
            const fallbackColor =
              Number.isInteger(fallbackSeat) && fallbackSeat >= 0
                ? getColorForSeat(fallbackSeat)
                : getColorForSeat(0);

            setGameOverResult({
              mode: "solo",
              winner: {
                playerId: winner.playerId,
                name: winner.name,
                color: typeof winner.color === "string" && winner.color.trim() ? winner.color : fallbackColor,
              },
            });
          }
        } else if (isObject(result) && result.mode === "team" && Array.isArray(result.winners)) {
          const winners = result.winners
            .map((winner) => {
              if (!isObject(winner)) return null;
              if (
                typeof winner.playerId !== "string" ||
                typeof winner.name !== "string"
              ) {
                return null;
              }

              const fallbackSeat = Number(String(winner.playerId).replace(/^p/, ""));
              const fallbackColor =
                Number.isInteger(fallbackSeat) && fallbackSeat >= 0
                  ? getColorForSeat(fallbackSeat)
                  : getColorForSeat(0);

              return {
                playerId: winner.playerId,
                name: winner.name,
                color:
                  typeof winner.color === "string" && winner.color.trim() ? winner.color : fallbackColor,
              };
            })
            .filter((winner): winner is { playerId: string; name: string; color: string } => !!winner);

          setGameOverResult({
            mode: "team",
            winners,
          });
        }
        setLatestStatusText("Game Over");
      }

      if (message.type === "legalMoves") {
        const rawMoves = Array.isArray(message.moves)
          ? message.moves
          : Array.isArray(message.legalMoves)
            ? message.legalMoves
            : [];
        setRawLegalMoves(rawMoves);
        setLegalMoveOptions(parseLegalMoveOptions(rawMoves));

        const turnEnvelope = isObject(message.turn) ? message.turn : null;
        if (turnEnvelope) {
          setPendingDice(parsePendingDiceFromTurn(turnEnvelope));
          setBankedDice(parseBankedDice(turnEnvelope));

          if (
            typeof message.expectedRollCount === "number" &&
            Number.isInteger(message.expectedRollCount)
          ) {
            setExpectedRollCount(message.expectedRollCount);
            setRollValues((current) =>
              resizeRollValues(current, message.expectedRollCount)
            );
          } else if (gameState) {
            const nextExpectedRollCount = computeExpectedRollCountForUi(gameState, turnEnvelope);
            setExpectedRollCount(nextExpectedRollCount);
            setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));
          }
        } else {
          const dice = parseDiceList(message.dice);
          if (dice.length > 0) {
            setPendingDice((current) =>
              current.length === 0 ? dice.map((die) => ({ value: die, controllerId: null })) : current
            );
          }
        }

        setLocalRolledDice([]);

        setLatestStatusText(
          Array.isArray(rawMoves) && rawMoves.length > 0
            ? `Received ${rawMoves.length} legal moves`
            : "No legal moves returned"
        );
      }

      if (message.type === "moveResult") {
        const response = message.response;

        const nextStateCandidate = response?.result?.nextState ?? response?.nextState ?? null;

        if (isGameState(nextStateCandidate)) {
          const nextTurn = response?.turn ?? response?.result?.turn ?? null;
          const mergedState = mergeTurnIntoGameState(nextStateCandidate, nextTurn);

          setGameState(mergedState);
          setPhase(mergedState.phase);

          if (nextTurn && typeof nextTurn === "object" && Array.isArray((nextTurn as any).pendingDice)) {
            setBankedDice(parseBankedDice(nextTurn));
            const rawPending = (nextTurn as any).pendingDice as Array<any>;
            setPendingDice(
              rawPending
                .map((pd) => {
                  if (typeof pd === "number") {
                    return { value: pd, controllerId: null };
                  }
                  if (!pd || typeof pd !== "object") return null;
                  if (!Number.isInteger((pd as any).value)) return null;
                  return {
                    value: (pd as any).value,
                    controllerId:
                      typeof (pd as any).controllerId === "string" ? (pd as any).controllerId : null,
                  };
                })
                .filter(Boolean) as PendingDieView[]
            );
          } else {
            setPendingDice(parsePendingDice(mergedState));
            setBankedDice(parseBankedDice(mergedState.turn as unknown));
          }

          const nextExpectedRollCount = computeExpectedRollCountForUi(mergedState, nextTurn);
          setExpectedRollCount(nextExpectedRollCount);
          setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));

          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setSelectedDie("");
          setSelectedPegId(null);
        }

        setLatestStatusText("Move applied");
      }

      if (message.type === "error") {
        setLocalRolledDice([]);
        setLatestStatusText(typeof message.message === "string" ? message.message : "Server error");
      }

      if (typeof message.message === "string" && message.type !== "error") {
        setLatestStatusText(message.message);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (pendingDice.length === 1) {
      const onlyDie = String(pendingDice[0].value);

      if (selectedDie !== onlyDie) {
        setSelectedDie(onlyDie);
        setSelectedPegId(null);

        if (gameState && !gameOverResult) {
          const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
          const onlyDieControllerId = pendingDice[0]?.controllerId ?? null;
          const actingActorId =
            typeof onlyDieControllerId === "string" && onlyDieControllerId
              ? onlyDieControllerId
              : currentTurnPlayerId;

          if (actingActorId && actingActorId === playerId) {
            const parsedDie = Number(onlyDie);
            if (Number.isInteger(parsedDie)) {
              sendMessage(wsRef.current, {
                type: "getLegalMoves",
                actorId: actingActorId,
                die: parsedDie,
              });
            }
          }
        }
      }

      return;
    }

    const stillValid = pendingDice.some((die) => String(die.value) === selectedDie);
    if (!stillValid) {
      setSelectedDie("");
    }
  }, [pendingDice, selectedDie, gameState, playerId, gameOverResult]);

  const localPlayerLobbyEntry = useMemo(() => {
    if (!lobby || !playerId) return null;
    return lobby.players.find((player) => player.playerId === playerId) ?? null;
  }, [lobby, playerId]);

  const localPlayerDisplayName = useMemo(() => {
    if (localPlayerLobbyEntry?.name && localPlayerLobbyEntry.name.trim()) {
      return localPlayerLobbyEntry.name;
    }
    if (playerId) return playerId;
    return "-";
  }, [localPlayerLobbyEntry, playerId]);

  useEffect(() => {
    const titleName =
      localPlayerLobbyEntry?.name && localPlayerLobbyEntry.name.trim()
        ? localPlayerLobbyEntry.name
        : playerId || "LMR";
    const titleRoom = roomCode || "LMR";
    document.title = `${titleName} | ${titleRoom}`;
  }, [localPlayerLobbyEntry, playerId, roomCode]);

  useEffect(() => {
    if (!localPlayerLobbyEntry) {
      if (localPlayerNameDraft !== "") setLocalPlayerNameDraft("");
      if (lastLobbySeededLocalPlayerName !== "") setLastLobbySeededLocalPlayerName("");
      return;
    }

    const lobbyName = localPlayerLobbyEntry.name;

    if (localPlayerNameDraft === lastLobbySeededLocalPlayerName) {
      if (localPlayerNameDraft !== lobbyName) {
        setLocalPlayerNameDraft(lobbyName);
      }
      if (lastLobbySeededLocalPlayerName !== lobbyName) {
        setLastLobbySeededLocalPlayerName(lobbyName);
      }
    }
  }, [localPlayerLobbyEntry, localPlayerNameDraft, lastLobbySeededLocalPlayerName]);

  const selectedDieControllerId = getPendingDieControllerId(pendingDice, selectedDie);

  const isOwner = useMemo(() => {
    if (!lobby || !playerId) return false;
    const sorted = [...lobby.players].sort((a, b) => a.seat - b.seat);
    return sorted.length > 0 && sorted[0].playerId === playerId;
  }, [lobby, playerId]);

  const normalizedLocalPlayerNameDraft = useMemo(
    () => normalizePlayerNameInput(localPlayerNameDraft),
    [localPlayerNameDraft]
  );

  const localPlayerNameError = useMemo(
    () => getPlayerNameValidationError(localPlayerNameDraft, playerId, lobby),
    [localPlayerNameDraft, playerId, lobby]
  );

  const isLocalPlayerReadyEligible = useMemo(() => {
    if (!localPlayerLobbyEntry) return false;
    if (localPlayerNameError) return false;
    return normalizePlayerNameInput(localPlayerLobbyEntry.name).length >= MIN_NAME_LENGTH;
  }, [localPlayerLobbyEntry, localPlayerNameError]);

  const handleSelectDie = (dieValue: string) => {
    if (gameOverResult) return;

    setSelectedDie(dieValue);
    setSelectedPegId(null);

    if (!gameState) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    const dieControllerId = getPendingDieControllerId(pendingDice, dieValue);
    const actingActorId =
      typeof dieControllerId === "string" && dieControllerId
        ? dieControllerId
        : currentTurnPlayerId;

    if (!actingActorId || actingActorId !== playerId) return;

    const parsedDie = Number(dieValue);
    if (!Number.isInteger(parsedDie)) return;

    sendMessage(wsRef.current, {
      type: "getLegalMoves",
      actorId: actingActorId,
      die: parsedDie,
    });
  };

  const handleRollValueChange = (index: number, value: string) => {
    const sanitized = value.replace(/[^1-6]/g, "").slice(0, 1);
    setRollValues((current) => {
      const next = resizeRollValues(current, expectedRollCount);
      next[index] = sanitized;
      return next;
    });
  };

  const handleCreateRoom = () => {
    setPlayerId("");
    setPhase("lobby");
    setRoomCode("");
    setJoinedRoom(false);
    setLobby(null);
    setGameState(null);
    setGameOverResult(null);
    setPendingDice([]);
    setBankedDice(0);
    setExpectedRollCount(0);
    setRollValues([]);
    setLocalRolledDice([]);
    setLegalMoveOptions([]);
    setRawLegalMoves([]);
    setSelectedDie("");
    setSelectedPegId(null);
    setStoredRoomCode("");
    sendMessage(wsRef.current, { type: "joinRoom" });
  };

  const handleJoinRoom = () => {
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (!trimmed) return;

    setPlayerId("");
    setPhase("lobby");
    setRoomCode(trimmed);
    setJoinedRoom(false);
    setLobby(null);
    setGameState(null);
    setGameOverResult(null);
    setPendingDice([]);
    setBankedDice(0);
    setExpectedRollCount(0);
    setRollValues([]);
    setLocalRolledDice([]);
    setLegalMoveOptions([]);
    setRawLegalMoves([]);
    setSelectedDie("");
    setSelectedPegId(null);
    setStoredRoomCode(trimmed);
    sendMessage(wsRef.current, { type: "joinRoom", roomCode: trimmed });
  };

  const handleLocalPlayerNameCommit = () => {
    const normalized = normalizePlayerNameInput(localPlayerNameDraft);
    const validationError = getPlayerNameValidationError(localPlayerNameDraft, playerId, lobby);

    if (!localPlayerLobbyEntry) return;

    if (validationError) {
      setLatestStatusText(validationError);
      return;
    }

    if (normalized !== localPlayerNameDraft) {
      setLocalPlayerNameDraft(normalized);
    }

    if (normalized === localPlayerLobbyEntry.name) return;

    sendMessage(wsRef.current, {
      type: "setPlayerName",
      name: normalized,
    });
    setLatestStatusText(`Updating name: ${normalized}`);
  };

  const handleReady = () => {
    if (!isLocalPlayerReadyEligible) {
      setLatestStatusText(localPlayerNameError || "Enter a valid unique name before readying.");
      return;
    }
    sendMessage(wsRef.current, { type: "setReady", ready: true });
  };

  const handleNotReady = () => {
    sendMessage(wsRef.current, { type: "setReady", ready: false });
  };

  const handleStartGame = () => {
    const playerCount =
      lobby?.gameConfig?.playerCount ??
      lobby?.expectedPlayerCount ??
      Math.max(lobby?.players.length ?? 0, 4);

    sendMessage(wsRef.current, { type: "startGame", playerCount });
  };

  const handleUpdateGameConfig = (patch: Partial<LobbyGameConfigView>) => {
    const seatedCount = lobby?.players.length ?? 0;
    const playerCount =
      patch.playerCount ??
      lobby?.gameConfig?.playerCount ??
      lobby?.expectedPlayerCount ??
      Math.max(seatedCount, 4);

    sendMessage(wsRef.current, {
      type: "setLobbyGameConfig",
      gameConfig: {
        playerCount,
        ...(lobby?.gameConfig ?? {}),
        ...patch,
      },
    });
  };

  const handleRoll = () => {
    if (!gameState || gameOverResult) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

    const dice = parseRollValues(rollValues);
    if (dice.length !== expectedRollCount || expectedRollCount <= 0) {
      setLatestStatusText("Invalid roll input");
      return;
    }

    setLocalRolledDice(dice);

    if (dice.length === 1) {
      sendMessage(wsRef.current, {
        type: "roll",
        actorId: currentTurnPlayerId,
        die: dice[0],
      });
      return;
    }

    sendMessage(wsRef.current, {
      type: "roll",
      actorId: currentTurnPlayerId,
      dice,
    });
  };

  const handleForfeitPendingDice = () => {
    if (!gameState || gameOverResult) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

    sendMessage(wsRef.current, {
      type: "forfeitPendingDie",
      actorId: currentTurnPlayerId,
    });
  };

  const handleReturnToLobby = () => {
    if (!isOwner) return;
    sendMessage(wsRef.current, { type: "ackGameOver" });
  };

  const movablePegIds = useMemo(
    () => (gameOverResult ? [] : getMovablePegIds(legalMoveOptions, selectedDie)),
    [legalMoveOptions, selectedDie, gameOverResult]
  );

  const destinationHighlights = useMemo(() => {
    if (!gameState) return [];
    if (!selectedPegId) return [];
    if (gameOverResult) return [];
    const fallbackPlayerId = playerId || getCurrentTurnPlayerId(gameState);
    return buildDestinationHighlights(
      legalMoveOptions,
      selectedDie,
      selectedPegId,
      fallbackPlayerId,
      normalizeArms(gameState.config.playerCount)
    );
  }, [gameState, legalMoveOptions, selectedDie, selectedPegId, playerId, gameOverResult]);

  const handlePegClick = (pegId: string) => {
    if (gameOverResult) return;
    setSelectedPegId((current) => (current === pegId ? null : pegId));
  };

  const handleBackgroundClick = () => {
    if (gameOverResult) return;
    setSelectedPegId(null);
  };

  const handleDestinationClick = (hole: BoardHolePlacement) => {
    if (!gameState || gameOverResult) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    const actingActorId =
      typeof selectedDieControllerId === "string" && selectedDieControllerId
        ? selectedDieControllerId
        : currentTurnPlayerId;

    if (!actingActorId || actingActorId !== playerId) return;

    if (pendingDice.length > 1 && !selectedDie) {
      setLatestStatusText("Select a die first");
      return;
    }

    if (!selectedPegId) {
      setLatestStatusText("Select a peg first");
      return;
    }

    const chosen = findMoveForDestination(
      legalMoveOptions,
      selectedDie,
      selectedPegId,
      hole,
      playerId || actingActorId,
      normalizeArms(gameState.config.playerCount)
    );

    if (!chosen) {
      setLatestStatusText("Clicked hole is not a legal destination for the selected peg");
      return;
    }

    const parsedMove = parseMove(chosen);
    if (!parsedMove) {
      setLatestStatusText("Could not parse legal move");
      return;
    }

    sendMessage(wsRef.current, {
      type: "move",
      actorId: actingActorId,
      dice: [Number(selectedDie)],
      move: parsedMove,
    });
    setSelectedPegId(null);
  };

  const selectedPendingDieIsAvailable =
    selectedDie !== "" && pendingDice.some((die) => String(die.value) === selectedDie);

  const canForfeitPendingDice =
    !!gameState &&
    !gameOverResult &&
    playerId !== "" &&
    playerId === getCurrentTurnPlayerId(gameState) &&
    pendingDice.length > 0 &&
    selectedPendingDieIsAvailable &&
    legalMoveOptions.length === 0;

  const firstLegalMoveRaw = useMemo(() => {
    if (rawLegalMoves.length === 0) return "";
    try {
      return JSON.stringify(rawLegalMoves[0], null, 2);
    } catch {
      return String(rawLegalMoves[0]);
    }
  }, [rawLegalMoves]);

  if (gameState && (phase === "active" || phase === "ended" || gameOverResult !== null)) {
    return (
      <GameView
        connected={connected}
        playerId={playerId}
        playerDisplayName={localPlayerDisplayName}
        phase={phase}
        roomCode={roomCode}
        gameState={gameState}
        selectedDie={selectedDie}
        latestMessageType={latestMessageType}
        latestStatusText={latestStatusText}
        pendingDice={pendingDice}
        localRolledDice={localRolledDice}
        bankedDice={bankedDice}
        expectedRollCount={expectedRollCount}
        rollValues={rollValues}
        legalMoveOptions={legalMoveOptions}
        destinationHighlights={destinationHighlights}
        movablePegIds={movablePegIds}
        selectedPegId={selectedPegId}
        firstLegalMoveRaw={firstLegalMoveRaw}
        canForfeitPendingDice={canForfeitPendingDice}
        gameOverResult={gameOverResult}
        isOwner={isOwner}
        onRollValueChange={handleRollValueChange}
        onRoll={handleRoll}
        onSelectDie={handleSelectDie}
        onPegClick={handlePegClick}
        onDestinationClick={handleDestinationClick}
        onBackgroundClick={handleBackgroundClick}
        onForfeitPendingDice={handleForfeitPendingDice}
        onReturnToLobby={handleReturnToLobby}
      />
    );
  }

  return (
    <LobbyView
      connected={connected}
      playerId={playerId}
      playerDisplayName={localPlayerDisplayName}
      phase={phase || lobby?.phase || "lobby"}
      roomCode={roomCode}
      roomCodeInput={roomCodeInput}
      joinedRoom={joinedRoom}
      lobby={lobby}
      localPlayerNameDraft={localPlayerNameDraft}
      localPlayerNameError={localPlayerNameError}
      onLocalPlayerNameDraftChange={setLocalPlayerNameDraft}
      onCommitLocalPlayerName={handleLocalPlayerNameCommit}
      onRoomCodeInputChange={setRoomCodeInput}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onToggleReady={(ready) => {
        if (ready) handleReady();
        else handleNotReady();
      }}
      onStartGame={handleStartGame}
      onUpdateGameConfig={handleUpdateGameConfig}
      isOwner={isOwner}
      isLocalPlayerReadyEligible={isLocalPlayerReadyEligible}
    />
  );
}
