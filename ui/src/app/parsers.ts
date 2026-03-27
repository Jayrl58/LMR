import type { GameState } from "../../../src/types";
import type {
  BoardHolePlacement,
  DestinationHighlight,
} from "../components/BoardRenderer";

export type SupportedArms = 4 | 6 | 8;

export type LobbyPlayerView = {
  playerId: string;
  seat: number;
  ready: boolean;
};

export type LobbyGameConfigView = {
  playerCount?: number;
  teamPlay?: boolean;
  killRoll?: boolean;
  doubleDice?: boolean;
  fastTrack?: boolean;
};

export type LobbyViewState = {
  roomCode?: string;
  phase: string;
  expectedPlayerCount?: number;
  players: LobbyPlayerView[];
  gameConfig?: LobbyGameConfigView;
};

export type PendingDieView = {
  value: number;
  controllerId: string | null;
};

export type LegalMoveOption = {
  label: string;
  value: string;
  dice: number[];
};

export type RawLegalMove = unknown;

export type ParsedMove = Record<string, unknown>;

const DEBUG_HIGHLIGHT_COLOR = "#ff00ff";

export function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

export function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function isGameState(value: unknown): value is GameState {
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

export function parseLobbyState(value: unknown): LobbyViewState | null {
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

export function parsePendingDiceFromTurn(turnValue: unknown): PendingDieView[] {
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

export function parsePendingDice(gameState: GameState): PendingDieView[] {
  return parsePendingDiceFromTurn(gameState.turn as unknown);
}

export function getPendingDieControllerId(
  pendingDice: PendingDieView[],
  dieValue: string
): string | null | undefined {
  if (!dieValue) return undefined;
  const match = pendingDice.find((die) => String(die.value) === dieValue);
  return match ? match.controllerId : undefined;
}

export function parseBankedDice(turnValue: unknown): number {
  if (!isObject(turnValue)) return 0;
  return typeof turnValue.bankedDice === "number" && Number.isInteger(turnValue.bankedDice)
    ? turnValue.bankedDice
    : 0;
}

export function computeExpectedRollCountForUi(
  gameState: GameState,
  turnOverride?: unknown
): number {
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

export function parseDiceList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((die): die is number => typeof die === "number" && Number.isInteger(die));
}

export function parseRollValues(values: string[]): number[] {
  return values
    .map((value) => Number(value.trim()))
    .filter((die) => Number.isInteger(die) && die >= 1 && die <= 6);
}

export function resizeRollValues(previous: string[], nextCount: number): string[] {
  if (nextCount <= 0) return [];
  return Array.from({ length: nextCount }, (_, index) => previous[index] ?? "");
}

export function parseMoveLabel(move: Record<string, unknown>, fallbackIndex: number): string {
  if (typeof move.label === "string" && move.label.trim()) return move.label;
  if (typeof move.description === "string" && move.description.trim()) return move.description;
  if (typeof move.summary === "string" && move.summary.trim()) return move.summary;
  const pegIndex = typeof move.pegIndex === "number" ? move.pegIndex : null;
  return pegIndex === null ? `Move ${fallbackIndex + 1}` : `Peg ${pegIndex}`;
}

export function parseLegalMoveOptions(value: unknown): LegalMoveOption[] {
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

export function parseMove(option: LegalMoveOption): ParsedMove | null {
  try {
    const parsed = JSON.parse(option.value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getMovePegId(move: ParsedMove): string | null {
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

export function getMoveTargetPosition(move: ParsedMove): unknown {
  return move.to ?? move.destination ?? move.target ?? move.end ?? move.toPosition ?? null;
}

export function getMoveActorPlayerId(move: ParsedMove, fallbackPlayerId: string): string {
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

export function mapMovePositionToHole(
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

export function holesEqual(a: BoardHolePlacement, b: BoardHolePlacement): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "center" && b.type === "center") return true;
  if (a.type === "track" && b.type === "track") return a.arm === b.arm && a.spot === b.spot;
  if (a.type === "home" && b.type === "home") return a.arm === b.arm && a.slot === b.slot;
  if (a.type === "base" && b.type === "base") return a.arm === b.arm && a.slot === b.slot;
  return false;
}

export function buildDestinationHighlights(
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

export function findMoveForDestination(
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
