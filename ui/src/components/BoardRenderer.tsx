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

export type BoardHolePlacement =
  | { type: "track"; arm: number; spot: number }
  | { type: "home"; arm: number; slot: number }
  | { type: "base"; arm: number; slot: number }
  | { type: "center" };

export type PegPlacement = {
  pegId: string;
  hole: BoardHolePlacement;
  color?: string;
};

const VIEW_SIZE = 1000;
const CENTER = VIEW_SIZE / 2;
const DEFAULT_PEG_COLOR = "#2b6cb0";

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
  const step = 360 / arms;
  const armRot = degToRad(-armIndex * step);
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

function getSpotIdForHole(hole: BoardHolePlacement): string | null {
  if (hole.type === "track") return `T${hole.spot}`;
  if (hole.type === "home") return `H${hole.slot}`;
  return null;
}

export default function BoardRenderer({
  arms = 4,
  pegPlacements = [],
}: {
  arms?: BoardArms;
  pegPlacements?: PegPlacement[];
}) {
  const safeArms: BoardArms =
    arms === 4 || arms === 6 || arms === 8 ? arms : 4;

  const geometry = BOARD_GEOMETRY[safeArms];

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

  const placedPegs = useMemo(() => {
    return pegPlacements
      .map((peg) => {
        if (peg.hole.type === "center") {
          return {
            ...peg,
            screenX: CENTER,
            screenY: CENTER,
          };
        }

        const spotId = getSpotIdForHole(peg.hole);
        if (!spotId) return null;

        const spot = spots.find(
          (candidate) =>
            candidate.armIndex === peg.hole.arm && candidate.id === spotId
        );

        if (!spot) return null;

        return {
          ...peg,
          screenX: spot.screenX,
          screenY: spot.screenY,
        };
      })
      .filter(
        (
          peg
        ): peg is PegPlacement & {
          screenX: number;
          screenY: number;
        } => peg !== null
      );
  }, [pegPlacements, spots]);

  const pegRadius = Math.max(
    geometry.holeRadius - 2.5,
    geometry.holeRadius * 0.68
  );

  return (
    <svg
      width="900"
      height="900"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      style={{
        border: "1px solid #ccc",
        background: "#fafafa",
      }}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={geometry.holeRadius}
        fill="#d7d7d7"
        stroke="#888"
        strokeWidth="1.3"
      />

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

      {placedPegs.map((peg) => (
        <circle
          key={peg.pegId}
          cx={peg.screenX}
          cy={peg.screenY}
          r={pegRadius}
          fill={peg.color ?? DEFAULT_PEG_COLOR}
          stroke="#222"
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}