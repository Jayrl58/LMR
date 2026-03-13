type AnyPosition = {
  zone?: unknown;
  index?: unknown;
  slot?: unknown;
  playerId?: unknown;
};

export type BoardHole =
  | { type: "track"; arm: number; spot: number }
  | { type: "home"; arm: number; slot: number }
  | { type: "base"; arm: number; slot: number }
  | { type: "center" };

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function mapPositionToBoardHole(
  pos: unknown,
  playerSeat: number,
  playerCount: number
): BoardHole {
  const ARM_LENGTH = 14;
  const p = asObject(pos) as AnyPosition | null;

  if (!p) {
    return {
      type: "base",
      arm: playerSeat,
      slot: 0,
    };
  }

  if (p.zone === "center") {
    return {
      type: "center",
    };
  }

  if (p.zone === "track") {
    const index = asNumber(p.index, 0);

    return {
      type: "track",
      arm: Math.floor(index / ARM_LENGTH),
      spot: index % ARM_LENGTH,
    };
  }

  if (p.zone === "home") {
    const slot =
      typeof p.slot === "number"
        ? p.slot
        : typeof p.index === "number"
          ? p.index
          : 0;

    return {
      type: "home",
      arm: playerSeat,
      slot,
    };
  }

  const slot =
    typeof p.slot === "number"
      ? p.slot
      : typeof p.index === "number"
        ? p.index
        : 0;

  return {
    type: "base",
    arm: playerSeat,
    slot,
  };
}