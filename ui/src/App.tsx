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

const WS_URL = "ws://127.0.0.1:8787";
const MAX_LOBBY_SEATS = 8;
const PLAYER_COUNT_OPTIONS = [4, 6, 8] as const;
const CLIENT_ID_STORAGE_KEY = "lmr_client_id_v1";
const ROOM_CODE_STORAGE_KEY = "lmr_room_code_v1";
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
  if (typeof turn.currentPlayerId === "string") return turn.currentPlayerId;
  if (typeof turn.playerId === "string") return turn.playerId;
  if (typeof turn.actorId === "string") return turn.actorId;
  return "";
}

function parsePendingDice(gameState: GameState): PendingDieView[] {
  const turn = gameState.turn as unknown;
  if (!isObject(turn)) return [];
  const raw = Array.isArray(turn.pendingDice) ? turn.pendingDice : [];
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
      ready: player?.ready ?? false,
      occupied: !!player,
    };
  });
}

function parseRollInput(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((die) => Number.isInteger(die) && die >= 1 && die <= 6);
}

function parseDiceList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((die): die is number => typeof die === "number" && Number.isInteger(die));
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

function getMovablePegIds(
  legalMoveOptions: LegalMoveOption[],
  selectedDie: string
): string[] {
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
    const destinationHole = mapMovePositionToHole(
      destinationPosition,
      actorPlayerId,
      boardArms
    );
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
    const destinationHole = mapMovePositionToHole(
      destinationPosition,
      actorPlayerId,
      boardArms
    );
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
    onRoomCodeInputChange,
    onCreateRoom,
    onJoinRoom,
    onReady,
    onNotReady,
    onStartGame,
    onUpdateGameConfig,
  } = props;

  const seatRows = useMemo(() => buildLobbySeatRows(lobby), [lobby]);
  const seatedCount = seatRows.filter((row) => row.occupied).length;
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
            <button onClick={onStartGame} disabled={!connected || seatedCount === 0}>
              Start Game
            </button>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <b>Expected Players:</b> {expectedCount ?? "-"} | <b>Seated:</b> {seatedCount}
          </div>

          <div style={{ marginBottom: "12px", padding: "10px", border: "1px solid #666", width: "fit-content" }}>
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
  rollInput: string;
  latestMessageType: string;
  latestStatusText: string;
  pendingDice: PendingDieView[];
  legalMoveOptions: LegalMoveOption[];
  destinationHighlights: DestinationHighlight[];
  movablePegIds: string[];
  selectedPegId: string | null;
  firstLegalMoveRaw: string;
  onRollInputChange: (value: string) => void;
  onRoll: () => void;
  onSelectDie: (value: string) => void;
  onPegClick: (pegId: string) => void;
  onDestinationClick: (hole: BoardHolePlacement) => void;
  onBackgroundClick: () => void;
}) {
  const {
    connected,
    playerId,
    phase,
    roomCode,
    gameState,
    selectedDie,
    rollInput,
    latestMessageType,
    latestStatusText,
    pendingDice,
    legalMoveOptions,
    destinationHighlights,
    movablePegIds,
    selectedPegId,
    firstLegalMoveRaw,
    onRollInputChange,
    onRoll,
    onSelectDie,
    onPegClick,
    onDestinationClick,
    onBackgroundClick,
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
  const isCurrentPlayerTurn = !!playerId && playerId === currentTurnPlayerId;

  return (
    <div>
      <div>
        <b>Status:</b> {connected ? "Connected" : "Disconnected"} |{" "}
        <b>Player:</b> {playerId || "-"} | <b>Phase:</b> {phase || "-"} |{" "}
        <b>Room:</b> {roomCode || "-"}
      </div>

      <div style={{ margin: "8px 0" }}>
        <b>Turn:</b>{" "}
        <span style={{ color: turnColorText === "-" ? undefined : turnColorText, fontWeight: "bold" }}>
          {turnColorText}
        </span>
      </div>

      <div style={{ marginBottom: "12px", padding: "10px", border: "1px solid #666", width: "fit-content" }}>
        <div style={{ marginBottom: "8px" }}>
          <b>Game Controls</b>
        </div>

        <div style={{ marginBottom: "8px" }}>
          <span style={{ marginRight: "8px" }}>Roll Input</span>
          <input
            type="text"
            value={rollInput}
            onChange={(e) => onRollInputChange(e.target.value)}
            placeholder="e.g. 4 or 3,5"
            style={{ width: "120px", marginRight: "8px" }}
            disabled={!connected || !isCurrentPlayerTurn}
          />
          <button onClick={onRoll} disabled={!connected || !isCurrentPlayerTurn}>
            Roll
          </button>
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Pending Dice:</b>{" "}
          {pendingDice.length === 0 ? (
            <span>-</span>
          ) : (
            pendingDice.map((die, index) => {
              const dieValue = String(die.value);
              const isSelected = selectedDie === dieValue;
              return (
                <button
                  key={`${die.value}-${index}`}
                  onClick={() => onSelectDie(dieValue)}
                  style={{
                    marginRight: "6px",
                    fontWeight: isSelected ? "bold" : undefined,
                    outline: isSelected ? "2px solid #fff" : undefined,
                  }}
                  disabled={!connected}
                >
                  {die.value}
                </button>
              );
            })
          )}
        </div>

        <div style={{ marginBottom: "6px" }}>
          <b>Selected Die:</b> {selectedDie || "-"}
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
          <b>First Legal Move Raw:</b>
          <pre style={{ margin: "6px 0 0 0", fontSize: "11px", whiteSpace: "pre-wrap", maxWidth: "360px" }}>
{firstLegalMoveRaw || "-"}
          </pre>
        </div>

        <div>
          <b>Status Text:</b> {latestStatusText || "-"}
        </div>
      </div>

      <BoardRenderer
        arms={arms}
        pegPlacements={pegPlacements}
        movablePegIds={movablePegIds}
        focusedPegId={selectedPegId ?? ""}
        armColors={armColors}
        arrowIndicators={[]}
        destinationHighlights={destinationHighlights}
        onPegClick={onPegClick}
        onDestinationClick={onDestinationClick}
        onBackgroundClick={onBackgroundClick}
      />
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
  const [selectedDie, setSelectedDie] = useState("");
  const [rollInput, setRollInput] = useState("1");
  const [pendingDice, setPendingDice] = useState<PendingDieView[]>([]);
  const [legalMoveOptions, setLegalMoveOptions] = useState<LegalMoveOption[]>([]);
  const [rawLegalMoves, setRawLegalMoves] = useState<RawLegalMove[]>([]);
  const [selectedPegId, setSelectedPegId] = useState<string | null>(null);
  const [latestMessageType, setLatestMessageType] = useState("");
  const [latestStatusText, setLatestStatusText] = useState("");

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
        setLatestStatusText("Lobby synchronized");
      }

      if (message.type === "stateSync") {
        const parsedState = parseJsonIfString(message.state);
        if (isGameState(parsedState)) {
          setGameState(parsedState);
          setPhase(parsedState.phase);
          setPendingDice(parsePendingDice(parsedState));
          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setSelectedDie("");
          setSelectedPegId(null);
          setSelectedPegId(null);
        }
        setLatestStatusText("Game state synchronized");
      }

      if (message.type === "legalMoves") {
        const rawMoves = Array.isArray(message.moves)
          ? message.moves
          : Array.isArray(message.legalMoves)
            ? message.legalMoves
            : [];
        setRawLegalMoves(rawMoves);
        setLegalMoveOptions(parseLegalMoveOptions(rawMoves));

        const dice = parseDiceList(message.dice);
        if (dice.length > 0) {
          setPendingDice((current) =>
            current.length === 0
              ? dice.map((die) => ({ value: die, controllerId: null }))
              : current
          );
        }

        setLatestStatusText(
          Array.isArray(rawMoves) && rawMoves.length > 0
            ? `Received ${rawMoves.length} legal moves`
            : "No legal moves returned"
        );
      }

      if (message.type === "moveResult") {
        const response = message.response;

        const nextStateCandidate =
          response?.result?.nextState ??
          response?.nextState ??
          null;

        if (isGameState(nextStateCandidate)) {
          setGameState(nextStateCandidate);
          setPhase(nextStateCandidate.phase);

          const nextTurn =
            response?.turn ??
            response?.result?.turn ??
            null;

          if (nextTurn && typeof nextTurn === "object" && Array.isArray((nextTurn as any).pendingDice)) {
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
                      typeof (pd as any).controllerId === "string"
                        ? (pd as any).controllerId
                        : null,
                  };
                })
                .filter(Boolean) as PendingDieView[]
            );
          } else {
            setPendingDice(parsePendingDice(nextStateCandidate));
          }

          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setSelectedDie("");
        }

        setLatestStatusText("Move applied");
      }

      if (message.type === "error") {
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

        if (gameState) {
          const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
          if (currentTurnPlayerId && currentTurnPlayerId === playerId) {
            const parsedDie = Number(onlyDie);
            if (Number.isInteger(parsedDie)) {
              sendMessage(wsRef.current, {
                type: "getLegalMoves",
                actorId: currentTurnPlayerId,
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
  }, [pendingDice, selectedDie, gameState, playerId]);

  const handleSelectDie = (dieValue: string) => {
    setSelectedDie(dieValue);
    setSelectedPegId(null);

    if (!gameState) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

    const parsedDie = Number(dieValue);
    if (!Number.isInteger(parsedDie)) return;

    sendMessage(wsRef.current, {
      type: "getLegalMoves",
      actorId: currentTurnPlayerId,
      die: parsedDie,
    });
  };

  const handleCreateRoom = () => {
    setPlayerId("");
    setPhase("lobby");
    setRoomCode("");
    setJoinedRoom(false);
    setLobby(null);
    setGameState(null);
    setPendingDice([]);
    setLegalMoveOptions([]);
    setRawLegalMoves([]);
    setSelectedDie("");
    setSelectedPegId(null);
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
    setPendingDice([]);
    setLegalMoveOptions([]);
    setRawLegalMoves([]);
    setSelectedDie("");
    setStoredRoomCode(trimmed);
    sendMessage(wsRef.current, { type: "joinRoom", roomCode: trimmed });
  };

  const handleReady = () => {
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
    if (!gameState) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

    const dice = parseRollInput(rollInput);
    if (dice.length === 0) {
      setLatestStatusText("Invalid roll input");
      return;
    }

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

  const movablePegIds = useMemo(
    () => getMovablePegIds(legalMoveOptions, selectedDie),
    [legalMoveOptions, selectedDie]
  );

  const destinationHighlights = useMemo(() => {
    if (!gameState) return [];
    const fallbackPlayerId = playerId || getCurrentTurnPlayerId(gameState);
    return buildDestinationHighlights(
      legalMoveOptions,
      selectedDie,
      selectedPegId,
      fallbackPlayerId,
      normalizeArms(gameState.config.playerCount)
    );
  }, [gameState, legalMoveOptions, selectedDie, selectedPegId, playerId]);

  const handlePegClick = (pegId: string) => {
    setSelectedPegId((current) => (current === pegId ? null : pegId));
  };

  const handleBackgroundClick = () => {
    setSelectedPegId(null);
  };

  const handleDestinationClick = (hole: BoardHolePlacement) => {
    if (!gameState) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return;

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
      playerId || currentTurnPlayerId,
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
      actorId: currentTurnPlayerId,
      dice: [Number(selectedDie)],
      move: parsedMove,
    });
    setSelectedPegId(null);
  };

  const firstLegalMoveRaw = useMemo(() => {
    if (rawLegalMoves.length === 0) return "";
    try {
      return JSON.stringify(rawLegalMoves[0], null, 2);
    } catch {
      return String(rawLegalMoves[0]);
    }
  }, [rawLegalMoves]);

  if (phase === "active" && gameState) {
    return (
      <GameView
        connected={connected}
        playerId={playerId}
        phase={phase}
        roomCode={roomCode}
        gameState={gameState}
        selectedDie={selectedDie}
        rollInput={rollInput}
        latestMessageType={latestMessageType}
        latestStatusText={latestStatusText}
        pendingDice={pendingDice}
        legalMoveOptions={legalMoveOptions}
        destinationHighlights={destinationHighlights}
        movablePegIds={movablePegIds}
        selectedPegId={selectedPegId}
        firstLegalMoveRaw={firstLegalMoveRaw}
        onRollInputChange={setRollInput}
        onRoll={handleRoll}
        onSelectDie={handleSelectDie}
        onPegClick={handlePegClick}
        onDestinationClick={handleDestinationClick}
        onBackgroundClick={handleBackgroundClick}
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
