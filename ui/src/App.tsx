import { useEffect, useMemo, useState } from "react";
import BoardRenderer, {
  type BoardHolePlacement,
  type DestinationHighlight,
  type PegPlacement,
} from "./components/BoardRenderer";
import { mapGameStateToUI } from "../../src/ui/mapGameStateToUI";
import { mapPositionToBoardHole } from "../../src/ui/mapPositionToBoardHole";
import type { LobbyGameConfigView, LobbyViewState, PendingDieView, LegalMoveOption, SupportedArms } from "./app/parsers";
import type { GameState } from "../../src/types";
import { PLAYER_COLOR_PALETTE } from "./constants/playerColors";
import {
  getStoredRoomCode,
  sendMessage,
  setStoredRoomCode,
  type GameOverResult,
  useClientSession,
} from "./app/useClientSession";
import { useLobbyController, type LobbySeatRow } from "./app/useLobbyController";







type RawLegalMove = unknown;

type ParsedMove = Record<string, unknown>;

const PLAYER_COUNT_OPTIONS = [4, 6, 8] as const;
const DEBUG_HIGHLIGHT_COLOR = "#ff00ff";

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
      color: DEBUG_HIGHLIGHT_COLOR
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
  phase: string;
  roomCode: string;
  roomCodeInput: string;
  joinedRoom: boolean;
  lobby: LobbyViewState | null;
  seatRows: LobbySeatRow[];
  onRoomCodeInputChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onReady: () => void;
  onNotReady: () => void;
  onStartGame: () => void;
  onUpdateGameConfig: (patch: Partial<LobbyGameConfigView>) => void;
}) {
  const {
    connected,
    playerId,
    phase,
    roomCode,
    roomCodeInput,
    joinedRoom,
    lobby,
    seatRows,
    onRoomCodeInputChange,
    onCreateRoom,
    onJoinRoom,
    onReady,
    onNotReady,
    onStartGame,
    onUpdateGameConfig,
  } = props;

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

  return (
    <div>
      <div>
        <b>Status:</b> {connected ? "Connected" : "Disconnected"} |{" "}
        <b>Player:</b> {playerId || "-"} | <b>Phase:</b> {phase || "-"} |{" "}
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
        <button onClick={onCreateRoom} disabled={!connected}>
          Create Room
        </button>
        <button onClick={onJoinRoom} disabled={!connected || !roomCodeInput.trim()}>
          Join Room
        </button>
      </div>

      {joinedRoom && (
        <>
          <div style={{ margin: "10px 0", display: "flex", gap: "8px" }}>
            <button onClick={onReady} disabled={!connected}>
              Ready
            </button>
            <button onClick={onNotReady} disabled={!connected}>
              Not Ready
            </button>
            <button onClick={onStartGame} disabled={!connected || seatedCount === 0 || !allSeatedReady}>
              Start Game
            </button>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <b>Expected Players:</b> {expectedCount ?? "-"} | <b>Seated:</b> {seatedCount}
          </div>

          <div
            style={{ marginBottom: "12px", padding: "10px", border: "1px solid #666", width: "fit-content" }}
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

          <div style={{ marginBottom: "6px" }}>
            <b>Lobby Seats</b>
          </div>

          <table style={{ borderCollapse: "collapse", minWidth: "460px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Seat</th>
                <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Color</th>
                <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Player</th>
                <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #666" }}>Ready</th>
              </tr>
            </thead>
            <tbody>
              {seatRows.map((row) => {
                const isCurrentPlayer = row.playerId !== "" && row.playerId === playerId;
                return (
                  <tr
                    key={row.seat}
                    style={{
                      backgroundColor: isCurrentPlayer ? "rgba(255,255,255,0.08)" : undefined,
                      fontWeight: isCurrentPlayer ? "bold" : undefined,
                    }}
                  >
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>{row.seat}</td>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                      <span style={{ color: row.color, fontWeight: "bold" }}>{row.color}</span>
                    </td>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                      {row.occupied ? row.playerId : "Empty"}
                    </td>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #333" }}>
                      {row.occupied ? (row.ready ? "Ready" : "Not Ready") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function GameView(props: {
  connected: boolean;
  playerId: string;
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
            <b>Player:</b> {playerId || "-"}
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

  const { wsRef, connected } = useClientSession({
    getColorForSeat,
    gameState,
    playerId,
    setPlayerId,
    setPhase,
    setRoomCode,
    setRoomCodeInput,
    setJoinedRoom,
    setLobby,
    setGameState,
    setGameOverResult,
    setSelectedDie,
    setPendingDice,
    setBankedDice,
    setExpectedRollCount,
    setRollValues,
    setLocalRolledDice,
    setLegalMoveOptions,
    setRawLegalMoves,
    setSelectedPegId,
    setLatestMessageType,
    setLatestStatusText
  });

  const {
    seatRows,
    handleCreateRoom,
    handleJoinRoom,
    handleReady,
    handleNotReady,
    handleStartGame,
    handleUpdateGameConfig,
  } = useLobbyController({
    wsRef,
    lobby,
    roomCodeInput,
    setPlayerId,
    setPhase,
    setRoomCode,
    setJoinedRoom,
    setLobby,
    setGameState,
    setGameOverResult,
    setPendingDice,
    setBankedDice,
    setExpectedRollCount,
    setRollValues,
    setLocalRolledDice,
    setLegalMoveOptions,
    setRawLegalMoves,
    setSelectedDie,
    setSelectedPegId,
    getColorForSeat,
  });




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
                die: parsedDie
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

  const selectedDieControllerId = getPendingDieControllerId(pendingDice, selectedDie);

  const isOwner = useMemo(() => {
    if (!lobby || !playerId) return false;
    const sorted = [...lobby.players].sort((a, b) => a.seat - b.seat);
    return sorted.length > 0 && sorted[0].playerId === playerId;
  }, [lobby, playerId]);

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
      die: parsedDie
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
        die: dice[0]
  });
      return;
    }

    sendMessage(wsRef.current, {
      type: "roll",
      actorId: currentTurnPlayerId,
      dice
  });
  };

  const handleForfeitPendingDice = () => {
    if (!gameState || gameOverResult) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

    sendMessage(wsRef.current, {
      type: "forfeitPendingDie",
      actorId: currentTurnPlayerId
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
      move: parsedMove
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
      phase={phase || lobby?.phase || "lobby"}
      roomCode={roomCode}
      roomCodeInput={roomCodeInput}
      joinedRoom={joinedRoom}
      lobby={lobby}
      seatRows={seatRows}
      onRoomCodeInputChange={setRoomCodeInput}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onReady={handleReady}
      onNotReady={handleNotReady}
      onStartGame={handleStartGame}
      onUpdateGameConfig={handleUpdateGameConfig}
    />
  );
}
