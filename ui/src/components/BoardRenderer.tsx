import React, { useMemo } from "react";
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
  id: string;
  x: number;
  y: number;
  kind: "track" | "home";
  screenX: number;
  screenY: number;
};

const VIEW_SIZE = 1000;
const CENTER = VIEW_SIZE / 2;

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
      ...spot,
      screenX: screen.x,
      screenY: screen.y,
    };
  });
}

export default function BoardRenderer({
  arms = 4,
}: {
  arms?: BoardArms;
}) {
  const geometry = BOARD_GEOMETRY[arms];

  const spots = useMemo(() => {
    return Array.from({ length: arms }, (_, armIndex) =>
      buildArm(
        armIndex,
        arms,
        geometry.t6Radius,
        geometry.spotSpacing,
        geometry.branchSwingDeg
      )
    ).flat();
  }, [arms, geometry]);

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
      <circle cx={CENTER} cy={CENTER} r={geometry.holeRadius} fill="#111" />

      {spots.map((s, i) => (
        <circle
          key={i}
          cx={s.screenX}
          cy={s.screenY}
          r={geometry.holeRadius}
          fill={s.kind === "home" ? "#e7e7e7" : "#d7d7d7"}
          stroke="#888"
          strokeWidth="1.3"
        />
      ))}
    </svg>
  );
}