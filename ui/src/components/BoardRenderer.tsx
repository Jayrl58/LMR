import { useMemo } from "react";
import {
  BOARD_GEOMETRY,
  CANONICAL_ARM,
} from "../../../board_geometry/boardGeometry";

type BoardArms = 4 | 6 | 8;

type Point = {
  x: number;
  y: number;
};

type Spot = {
  armIndex: number;
  id: string;
  x: number;
  y: number;
  kind: "track" | "home";
  screenX: number;
  screenY: number;
};

type BaseSpot = {
  armIndex: number;
  slot: number;
  screenX: number;
  screenY: number;
};

export type BoardHolePlacement =
  | { type: "track"; arm: number; spot: number }
  | { type: "home"; arm: number; slot: number }
  | { type: "base"; arm: number; slot: number }
  | { type: "center" };

export type PegPlacement = {
  pegId: string;
  hole: BoardHolePlacement;
  color?: string;
  isFinished?: boolean;
};

export type DestinationHighlight = {
  hole: BoardHolePlacement;
  color?: string;
};

const VIEW_SIZE = 1000;
const CENTER = VIEW_SIZE / 2;
const DEFAULT_PEG_COLOR = "#2b6cb0";
const DEFAULT_DESTINATION_COLOR = "#7aa7ff";
const FINISHED_GOLD_COLOR = "#d4af37";
const BASE_OUTWARD_OFFSET_MULTIPLIER = 0.95;
const BASE_SLOT_OFFSETS = [-1.5, -0.5, 0.5, 1.5] as const;
const SPECIAL_TRACK_RING_SPOT_IDS = new Set(["T8", "T13"]);
const DEFAULT_ARM_COLORS = [
  "#f59e0b",
  "#7c3aed",
  "#eab308",
  "#1d4ed8",
  "#ef4444",
  "#16a34a",
  "#06b6d4",
  "#f97316",
] as const;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function rotatePoint(p: Point, theta: number): Point {
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  return {
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  };
}

function rotatePointAround(origin: Point, p: Point, theta: number): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  return {
    x: origin.x + dx * c - dy * s,
    y: origin.y + dx * s + dy * c,
  };
}


function toScreen(p: Point): Point {
  return {
    x: CENTER + p.x,
    y: CENTER - p.y,
  };
}

function makeBasePosition(
  armIndex: number,
  arms: number,
  radius: number,
  spacing: number
): Point {
  const step = 360 / arms;
  const theta = degToRad(-armIndex * step);

  const base = {
    x: 0,
    y: -radius * spacing,
  };

  return rotatePoint(base, theta);
}

function getArmRotationRadians(armIndex: number, arms: number): number {
  const step = 360 / arms;
  return degToRad(-armIndex * step);
}

function getBaseHoleWorldPosition(
  armIndex: number,
  arms: number,
  radius: number,
  spacing: number,
  slot: number
): Point {
  const armRotation = getArmRotationRadians(armIndex, arms);
  const armAnchor = makeBasePosition(armIndex, arms, radius, spacing);
  const outward = rotatePoint({ x: 0, y: -1 }, armRotation);
  const lateral = rotatePoint({ x: 1, y: 0 }, armRotation);
  const center = {
    x: armAnchor.x + outward.x * spacing * BASE_OUTWARD_OFFSET_MULTIPLIER,
    y: armAnchor.y + outward.y * spacing * BASE_OUTWARD_OFFSET_MULTIPLIER,
  };
  const lateralOffset = BASE_SLOT_OFFSETS[Math.max(0, Math.min(3, slot))] * spacing;

  return {
    x: center.x + lateral.x * lateralOffset,
    y: center.y + lateral.y * lateralOffset,
  };
}

function applyBranchSwing(localGrid: Point, swing: number): Point {
  if (swing === 0) return localGrid;
  if (localGrid.y === 0) return localGrid;
  if (localGrid.x === 0) return localGrid;

  if (localGrid.x < 0) {
    return rotatePointAround({ x: -2, y: 0 }, localGrid, degToRad(-swing));
  }

  return rotatePointAround({ x: 2, y: 0 }, localGrid, degToRad(swing));
}

function buildArm(
  armIndex: number,
  arms: number,
  radius: number,
  spacing: number,
  swing: number
): Spot[] {
  const armRot = getArmRotationRadians(armIndex, arms);
  const base = makeBasePosition(armIndex, arms, radius, spacing);

  return CANONICAL_ARM.map((spot) => {
    const swung = applyBranchSwing({ x: spot.x, y: spot.y }, swing);

    const local = {
      x: swung.x * spacing,
      y: swung.y * spacing,
    };

    const rotated = rotatePoint(local, armRot);

    const world = {
      x: base.x + rotated.x,
      y: base.y + rotated.y,
    };

    const screen = toScreen(world);

    return {
      armIndex,
      ...spot,
      screenX: screen.x,
      screenY: screen.y,
    };
  });
}

function buildBaseSpots(
  armIndex: number,
  arms: number,
  radius: number,
  spacing: number
): BaseSpot[] {
  return Array.from({ length: 4 }, (_, slot) => {
    const world = getBaseHoleWorldPosition(armIndex, arms, radius, spacing, slot);
    const screen = toScreen(world);

    return {
      armIndex,
      slot,
      screenX: screen.x,
      screenY: screen.y,
    };
  });
}

function getSpotIdForHole(hole: BoardHolePlacement): string | null {
  if (hole.type === "track") return `T${hole.spot}`;
  if (hole.type === "home") return `H${hole.slot}`;
  return null;
}

function getCanonicalArmColor(
  armIndex: number,
  resolvedArmColors?: readonly string[]
): string {
  if (resolvedArmColors && resolvedArmColors.length > 0) {
    return resolvedArmColors[armIndex % resolvedArmColors.length];
  }

  return DEFAULT_ARM_COLORS[armIndex % DEFAULT_ARM_COLORS.length];
}

function getScreenPositionForHole(
  hole: BoardHolePlacement,
  spots: Spot[],
  baseSpots: BaseSpot[]
): Point | null {
  if (hole.type === "center") {
    return { x: CENTER, y: CENTER };
  }

  if (hole.type === "base") {
    const baseSpot = baseSpots.find(
      (candidate) => candidate.armIndex === hole.arm && candidate.slot === hole.slot
    );

    if (!baseSpot) return null;

    return {
      x: baseSpot.screenX,
      y: baseSpot.screenY,
    };
  }

  const spotId = getSpotIdForHole(hole);
  if (!spotId) return null;

  const spot = spots.find(
    (candidate) => candidate.armIndex === hole.arm && candidate.id === spotId
  );

  if (!spot) return null;

  return {
    x: spot.screenX,
    y: spot.screenY,
  };
}


export default function BoardRenderer({
  arms = 4,
  pegPlacements = [],
  movablePegIds = [],
  destinationHighlights = [],
  focusedPegId = "",
  previewPegPlacement = null,
  armColors: providedArmColors,
  onPegClick,
  onDestinationClick,
  onDestinationHover,
  onDestinationLeave,
  onBackgroundClick,
}: {
  arms?: BoardArms;
  pegPlacements?: PegPlacement[];
  movablePegIds?: string[];
  destinationHighlights?: DestinationHighlight[];
  focusedPegId?: string;
  previewPegPlacement?: PegPlacement | null;
  armColors?: readonly string[];
  onPegClick?: (pegId: string) => void;
  onDestinationClick?: (hole: BoardHolePlacement) => void;
  onDestinationHover?: (hole: BoardHolePlacement) => void;
  onDestinationLeave?: () => void;
  onBackgroundClick?: () => void;
}) {
  const safeArms: BoardArms =
    arms === 4 || arms === 6 || arms === 8 ? arms : 4;

  const geometry = BOARD_GEOMETRY[safeArms];

  const movablePegIdSet = useMemo(
    () => new Set(movablePegIds),
    [movablePegIds]
  );

  const spots = useMemo(() => {
    return Array.from({ length: safeArms }, (_, armIndex) =>
      buildArm(
        armIndex,
        safeArms,
        geometry.t6Radius,
        geometry.spotSpacing,
        geometry.branchSwingDeg
      )
    ).flat();
  }, [safeArms, geometry]);

  const baseSpots = useMemo(() => {
    return Array.from({ length: safeArms }, (_, armIndex) =>
      buildBaseSpots(armIndex, safeArms, geometry.t6Radius, geometry.spotSpacing)
    ).flat();
  }, [safeArms, geometry]);

  const armColors = useMemo(() => {
    return Array.from({ length: safeArms }, (_, armIndex) =>
      getCanonicalArmColor(armIndex, providedArmColors)
    );
  }, [safeArms, providedArmColors]);



  const normalizedPegPlacements = useMemo(() => {
    const basePegCounts = new Map<number, number>();

    return pegPlacements.map((peg) => {
      if (peg.hole.type !== "base") return peg;

      const arm = peg.hole.arm;
      const nextSlot = basePegCounts.get(arm) ?? 0;
      basePegCounts.set(arm, nextSlot + 1);

      return {
        ...peg,
        hole: {
          type: "base" as const,
          arm,
          slot: Math.min(nextSlot, 3),
        },
      };
    });
  }, [pegPlacements]);

  const placedPegs = useMemo(() => {
    return normalizedPegPlacements
      .map((peg) => {
        if (peg.hole.type === "center") {
          return {
            ...peg,
            screenX: CENTER,
            screenY: CENTER,
            isMovable: movablePegIdSet.has(peg.pegId),
            isFocused: peg.pegId === focusedPegId,
          };
        }

        const position = getScreenPositionForHole(peg.hole, spots, baseSpots);
        if (!position) return null;

        return {
          ...peg,
          screenX: position.x,
          screenY: position.y,
          isMovable: movablePegIdSet.has(peg.pegId),
          isFocused: peg.pegId === focusedPegId,
        };
      })
      .filter(
        (
          peg
        ): peg is PegPlacement & {
          screenX: number;
          screenY: number;
          isMovable: boolean;
          isFocused: boolean;
        } => peg !== null
      );
  }, [normalizedPegPlacements, spots, baseSpots, movablePegIdSet, focusedPegId]);

  const renderedDestinationHighlights = useMemo(() => {
    return destinationHighlights
      .map((highlight, index) => {
        const position = getScreenPositionForHole(highlight.hole, spots, baseSpots);
        if (!position) return null;

        const isHomeDestination = highlight.hole.type === "home";
        const baseColor = highlight.color ?? DEFAULT_DESTINATION_COLOR;

        return {
          key: `${index}-${JSON.stringify(highlight.hole)}`,
          hole: highlight.hole,
          screenX: position.x,
          screenY: position.y,
          color: baseColor,
          isHomeDestination,
        };
      })
      .filter(
        (
          highlight
        ): highlight is {
          key: string;
          hole: BoardHolePlacement;
          screenX: number;
          screenY: number;
          color: string;
          isHomeDestination: boolean;
        } => highlight !== null
      );
  }, [destinationHighlights, spots, baseSpots]);

  const renderedPreviewPeg = useMemo(() => {
    if (!previewPegPlacement) return null;

    const position = getScreenPositionForHole(
      previewPegPlacement.hole,
      spots,
      baseSpots
    );
    if (!position) return null;

    return {
      ...previewPegPlacement,
      screenX: position.x,
      screenY: position.y,
    };
  }, [previewPegPlacement, spots, baseSpots]);

  const pegRadius = Math.max(
    geometry.holeRadius - 2.5,
    geometry.holeRadius * 0.68
  );

  const movableRingRadius = pegRadius + 5;
  const focusedRingRadius = pegRadius + 9;
  const finishedGoldRingRadius = pegRadius + 3;
  const finishedOuterRingRadius = pegRadius + 8;
  const destinationRingRadius = geometry.holeRadius + 5;
  const homeDestinationInnerRingRadius = geometry.holeRadius + 4;
  const homeDestinationOuterRingRadius = geometry.holeRadius + 8;
  const destinationClickRadius = geometry.holeRadius + 10;
  const previewPegRadius = pegRadius - 1;
  const specialTrackRingRadius = geometry.holeRadius * 2.05;
  const homeRingRadius = geometry.holeRadius * 2.0;
  const baseRingRadius = geometry.holeRadius * 2.0;

  return (
    <svg
      width="900"
      height="900"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      style={{
        border: "1px solid #ccc",
        background: "#fafafa",
      }}
      onClick={onBackgroundClick}
    >
      <rect
        x="0"
        y="0"
        width={VIEW_SIZE}
        height={VIEW_SIZE}
        fill="transparent"
        pointerEvents="all"
      />

      <circle
        cx={CENTER}
        cy={CENTER}
        r={geometry.holeRadius}
        fill="#d7d7d7"
        stroke="#888"
        strokeWidth="1.3"
      />



      {spots
        .filter((s) => s.kind === "home")
        .map((s) => (
          <circle
            key={`home-ring-${s.armIndex}-${s.id}`}
            cx={s.screenX}
            cy={s.screenY}
            r={homeRingRadius}
            fill={armColors[s.armIndex]}
            opacity="0.95"
          />
        ))}

      {baseSpots.map((s) => (
        <circle
          key={`base-ring-${s.armIndex}-${s.slot}`}
          cx={s.screenX}
          cy={s.screenY}
          r={baseRingRadius}
          fill={armColors[s.armIndex]}
          opacity="0.95"
        />
      ))}

      {spots.map((s) =>
        SPECIAL_TRACK_RING_SPOT_IDS.has(s.id) ? (
          <circle
            key={`${s.armIndex}-${s.id}-special-ring`}
            cx={s.screenX}
            cy={s.screenY}
            r={specialTrackRingRadius}
            fill={armColors[s.armIndex]}
            opacity="0.98"
          />
        ) : null
      )}

      {spots.map((s) => (
        <circle
          key={`${s.armIndex}-${s.id}`}
          cx={s.screenX}
          cy={s.screenY}
          r={geometry.holeRadius}
          fill={s.kind === "home" ? "#e7e7e7" : "#d7d7d7"}
          stroke="#888"
          strokeWidth="1.3"
        />
      ))}

      {baseSpots.map((s) => (
        <circle
          key={`base-${s.armIndex}-${s.slot}`}
          cx={s.screenX}
          cy={s.screenY}
          r={geometry.holeRadius}
          fill="#d7d7d7"
          stroke="#888"
          strokeWidth="1.3"
        />
      ))}

      {renderedDestinationHighlights.map((highlight) => (
        <g key={highlight.key}>
          <circle
            cx={highlight.screenX}
            cy={highlight.screenY}
            r={destinationClickRadius}
            fill="transparent"
            stroke="none"
            style={{
              cursor:
                onDestinationClick || onDestinationHover ? "pointer" : "default",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDestinationClick?.(highlight.hole);
            }}
            onMouseEnter={() => onDestinationHover?.(highlight.hole)}
            onMouseLeave={() => onDestinationLeave?.()}
          />
          <circle
            cx={highlight.screenX}
            cy={highlight.screenY}
            r={geometry.holeRadius}
            fill="transparent"
            stroke="none"
            style={{
              cursor:
                onDestinationClick || onDestinationHover ? "pointer" : "default",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDestinationClick?.(highlight.hole);
            }}
            onMouseEnter={() => onDestinationHover?.(highlight.hole)}
            onMouseLeave={() => onDestinationLeave?.()}
          />
          {highlight.isHomeDestination ? (
            <>
              <circle
                cx={highlight.screenX}
                cy={highlight.screenY}
                r={homeDestinationOuterRingRadius}
                fill="none"
                stroke={highlight.color}
                strokeWidth="3.6"
                opacity="0.98"
                style={{ pointerEvents: "none" }}
              />
              <circle
                cx={highlight.screenX}
                cy={highlight.screenY}
                r={homeDestinationInnerRingRadius}
                fill="none"
                stroke={highlight.color}
                strokeWidth="2.2"
                opacity="0.72"
                style={{ pointerEvents: "none" }}
              />
            </>
          ) : (
            <circle
              cx={highlight.screenX}
              cy={highlight.screenY}
              r={destinationRingRadius}
              fill="none"
              stroke={highlight.color}
              strokeWidth="3"
              opacity="0.95"
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      ))}

      {placedPegs.map((peg) =>
        peg.isFinished ? (
          <circle
            key={`${peg.pegId}-finished-outer-ring`}
            cx={peg.screenX}
            cy={peg.screenY}
            r={finishedOuterRingRadius}
            fill="none"
            stroke={peg.color ?? DEFAULT_PEG_COLOR}
            strokeWidth="3.2"
            opacity="0.95"
          />
        ) : null
      )}

      {placedPegs.map((peg) =>
        peg.isFinished ? (
          <circle
            key={`${peg.pegId}-finished-gold-ring`}
            cx={peg.screenX}
            cy={peg.screenY}
            r={finishedGoldRingRadius}
            fill="none"
            stroke={FINISHED_GOLD_COLOR}
            strokeWidth="3.2"
            opacity="1"
          />
        ) : null
      )}

      {placedPegs.map((peg) =>
        peg.isFocused ? (
          <circle
            key={`${peg.pegId}-focus-ring`}
            cx={peg.screenX}
            cy={peg.screenY}
            r={focusedRingRadius}
            fill="none"
            stroke={peg.color ?? DEFAULT_PEG_COLOR}
            strokeWidth="4"
            opacity="1"
          />
        ) : null
      )}

      {placedPegs.map((peg) =>
        peg.isMovable ? (
          <circle
            key={`${peg.pegId}-ring`}
            cx={peg.screenX}
            cy={peg.screenY}
            r={movableRingRadius}
            fill="none"
            stroke={peg.color ?? DEFAULT_PEG_COLOR}
            strokeWidth={peg.isFocused ? "0" : "3"}
            opacity={peg.isFocused ? "0" : "0.9"}
          />
        ) : null
      )}

      {placedPegs.map((peg) => (
        <circle
          key={peg.pegId}
          cx={peg.screenX}
          cy={peg.screenY}
          r={pegRadius}
          fill={peg.color ?? DEFAULT_PEG_COLOR}
          stroke="#ffffff"
          strokeWidth={
            peg.isFinished
              ? "1.8"
              : peg.isFocused
                ? "3.2"
                : peg.isMovable
                  ? "2.6"
                  : "1.4"
          }
          style={{
            cursor: peg.isMovable ? "pointer" : "default",
          }}
          onClick={(e) => {
            if (!peg.isMovable || !onPegClick) return;
            e.stopPropagation();
            onPegClick(peg.pegId);
          }}
        />
      ))}

      {renderedPreviewPeg ? (
        <>
          <circle
            cx={renderedPreviewPeg.screenX}
            cy={renderedPreviewPeg.screenY}
            r={previewPegRadius + 4}
            fill="none"
            stroke={renderedPreviewPeg.color ?? DEFAULT_PEG_COLOR}
            strokeWidth="2"
            opacity="0.55"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
          <circle
            cx={renderedPreviewPeg.screenX}
            cy={renderedPreviewPeg.screenY}
            r={previewPegRadius}
            fill={renderedPreviewPeg.color ?? DEFAULT_PEG_COLOR}
            opacity="0.38"
            stroke={renderedPreviewPeg.color ?? DEFAULT_PEG_COLOR}
            strokeWidth="1.4"
            pointerEvents="none"
          />
        </>
      ) : null}
    </svg>
  );
}
