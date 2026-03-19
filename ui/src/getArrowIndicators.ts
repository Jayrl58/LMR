import type { BoardHolePlacement } from "./components/BoardRenderer";

type SupportedArms = 4 | 6 | 8;

type PendingDieView = {
  value: number;
  controllerId: string | null;
};

type LegalMoveOptionInput = {
  value: string;
  dice: number[];
};

type ParsedMove = Record<string, unknown>;

export type ArrowIndicator = {
  pegId: string;
  fromHole: BoardHolePlacement;
  toHole: BoardHolePlacement;
};

type GetArrowIndicatorsInput = {
  awaitingDice: boolean | null;
  pendingDice: PendingDieView[];
  selectedDie: string;
  legalMoveOptions: LegalMoveOptionInput[];
  boardArms: SupportedArms;
};

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function holesEqual(a: BoardHolePlacement, b: BoardHolePlacement): boolean {
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

function mapMovePositionToHole(
  position: unknown,
  fallbackPlayerId: string | null,
  boardArms: SupportedArms
): BoardHolePlacement | null {
  if (!isObject(position)) return null;

  if (position.zone === "center") {
    return { type: "center" };
  }

  if (
    position.zone === "track" &&
    typeof position.index === "number" &&
    Number.isInteger(position.index)
  ) {
    const trackIndex = position.index;
    const spotsPerArm = 14;
    const arm = Math.floor(trackIndex / spotsPerArm);
    const spot = trackIndex % spotsPerArm;

    if (arm < 0 || arm >= boardArms || spot < 0 || spot >= spotsPerArm) {
      return null;
    }

    return {
      type: "track",
      arm,
      spot,
    };
  }

  if (position.zone === "home") {
    const playerId =
      typeof position.playerId === "string"
        ? position.playerId
        : fallbackPlayerId;

    const slot =
      typeof position.slot === "number" && Number.isInteger(position.slot)
        ? position.slot
        : typeof position.index === "number" && Number.isInteger(position.index)
          ? position.index
          : null;

    const arm = playerId ? Number(playerId.slice(1)) : NaN;

    if (!Number.isInteger(arm) || arm < 0 || arm >= boardArms || slot === null) {
      return null;
    }

    return {
      type: "home",
      arm,
      slot,
    };
  }

  if (position.zone === "base") {
    const playerId =
      typeof position.playerId === "string"
        ? position.playerId
        : fallbackPlayerId;

    const slot =
      typeof position.slot === "number" && Number.isInteger(position.slot)
        ? position.slot
        : null;

    const arm = playerId ? Number(playerId.slice(1)) : NaN;

    if (!Number.isInteger(arm) || arm < 0 || arm >= boardArms || slot === null) {
      return null;
    }

    return {
      type: "base",
      arm,
      slot,
    };
  }

  return null;
}

function parseMove(option: LegalMoveOptionInput): ParsedMove | null {
  try {
    const parsed = JSON.parse(option.value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function optionMatchesSelectedDie(
  option: LegalMoveOptionInput,
  selectedDie: string
): boolean {
  const selectedDieValue = Number(selectedDie);
  if (!Number.isInteger(selectedDieValue)) return false;

  return option.dice.includes(selectedDieValue);
}

function indicatorKeyFor(
  pegId: string,
  fromHole: BoardHolePlacement,
  toHole: BoardHolePlacement
): string {
  return `${pegId}|${JSON.stringify(fromHole)}|${JSON.stringify(toHole)}`;
}

export function getArrowIndicators({
  awaitingDice,
  pendingDice,
  selectedDie,
  legalMoveOptions,
  boardArms,
}: GetArrowIndicatorsInput): ArrowIndicator[] {
  void awaitingDice;
  void pendingDice;

  if (!selectedDie) return [];
  if (legalMoveOptions.length === 0) return [];

  const filteredOptions = legalMoveOptions.filter((option) =>
    optionMatchesSelectedDie(option, selectedDie)
  );

  const indicatorsByKey = new Map<string, ArrowIndicator>();

  filteredOptions.forEach((option) => {
    const move = parseMove(option);
    if (!move) return;

    const actorPlayerId =
      typeof move.actorPlayerId === "string" ? move.actorPlayerId : null;
    const pegIndex = typeof move.pegIndex === "number" ? move.pegIndex : null;

    if (!actorPlayerId || pegIndex === null) return;

    const pegId = `${actorPlayerId}-${pegIndex}`;

    const fromHole = mapMovePositionToHole(move.from, actorPlayerId, boardArms);
    const toHole = mapMovePositionToHole(move.to, actorPlayerId, boardArms);

    if (!fromHole || !toHole || holesEqual(fromHole, toHole)) return;

    const key = indicatorKeyFor(pegId, fromHole, toHole);
    if (indicatorsByKey.has(key)) return;

    indicatorsByKey.set(key, {
      pegId,
      fromHole,
      toHole,
    });
  });

  return Array.from(indicatorsByKey.values());
}
