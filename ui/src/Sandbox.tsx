import React, { useMemo, useState } from "react";
import {
  BOARD_GEOMETRY,
  CANONICAL_ARM,
  TRACK_LOOP_ORDER,
} from "../../board_geometry/boardGeometry";

type BoardType = "4P" | "6P" | "8P";
type Point = { x: number; y: number };

type RenderedSpot = {
  id: string;
  x: number;
  y: number;
  kind: "track" | "home";
  screenX: number;
  screenY: number;
};

type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
};

type JoinDistance = {
  key: string;
  fromArm: number;
  toArm: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  distancePx: number;
};

const VIEW_SIZE = 1000;
const CENTER = VIEW_SIZE / 2;

const PRESETS: Record<BoardType, { arms: 4 | 6 | 8 }> = {
  "4P": { arms: 4 },
  "6P": { arms: 6 },
  "8P": { arms: 8 },
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rotatePointAround(origin: Point, p: Point, thetaRad: number): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const c = Math.cos(thetaRad);
  const s = Math.sin(thetaRad);

  return {
    x: origin.x + dx * c - dy * s,
    y: origin.y + dx * s + dy * c,
  };
}

function rotateMathPoint(p: Point, thetaRad: number): Point {
  const c = Math.cos(thetaRad);
  const s = Math.sin(thetaRad);
  return {
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  };
}

function toScreenPoint(p: Point): Point {
  return {
    x: CENTER + p.x,
    y: CENTER - p.y,
  };
}

function makeBasePos(
  radiusSpots: number,
  spacingPx: number,
  armIndex: number,
  arms: number
): Point {
  const stepDeg = 360 / arms;
  const thetaRad = degToRad(-armIndex * stepDeg);

  const base = {
    x: 0,
    y: -radiusSpots * spacingPx,
  };

  return rotateMathPoint(base, thetaRad);
}

function applyBranchSwing(localGrid: Point, swingDeg: number): Point {
  if (swingDeg === 0) return localGrid;
  if (localGrid.y === 0) return localGrid;
  if (localGrid.x === 0) return localGrid;

  if (localGrid.x < 0) {
    const pivot = { x: -2, y: 0 };
    return rotatePointAround(pivot, localGrid, degToRad(-swingDeg));
  }

  if (localGrid.x > 0) {
    const pivot = { x: 2, y: 0 };
    return rotatePointAround(pivot, localGrid, degToRad(swingDeg));
  }

  return localGrid;
}

function buildArmSpots(
  armIndex: number,
  arms: number,
  radiusSpots: number,
  spacingPx: number,
  swingDeg: number
): RenderedSpot[] {
  const stepDeg = 360 / arms;
  const armRotationRad = degToRad(-armIndex * stepDeg);
  const basePos = makeBasePos(radiusSpots, spacingPx, armIndex, arms);

  return CANONICAL_ARM.map((spot) => {
    const localGrid = { x: spot.x, y: spot.y };

    const swungGrid = applyBranchSwing(localGrid, swingDeg);

    const localPx = {
      x: swungGrid.x * spacingPx,
      y: swungGrid.y * spacingPx,
    };

    const rotated = rotateMathPoint(localPx, armRotationRad);

    const worldMath = {
      x: basePos.x + rotated.x,
      y: basePos.y + rotated.y,
    };

    const screen = toScreenPoint(worldMath);

    return {
      ...spot,
      screenX: screen.x,
      screenY: screen.y,
    };
  });
}

function buildCenterline(
  armIndex: number,
  arms: number,
  radiusSpots: number,
  spacingPx: number
) {
  const stepDeg = 360 / arms;
  const thetaRad = degToRad(-armIndex * stepDeg);

  const startMath = rotateMathPoint({ x: 0, y: -radiusSpots * spacingPx }, thetaRad);
  const endMath = { x: 0, y: 0 };

  const p1 = toScreenPoint(startMath);
  const p2 = toScreenPoint(endMath);

  return {
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
  };
}

function buildTrackOverlaySegments(arms: RenderedSpot[][]): Segment[] {
  const segments: Segment[] = [];

  for (let armIndex = 0; armIndex < arms.length; armIndex++) {
    const arm = arms[armIndex];
    const nextArm = arms[(armIndex + 1) % arms.length];

    const armTrackMap = new Map(
      arm.filter((s) => s.kind === "track").map((s) => [s.id, s])
    );
    const nextTrackMap = new Map(
      nextArm.filter((s) => s.kind === "track").map((s) => [s.id, s])
    );

    for (let i = 0; i < TRACK_LOOP_ORDER.length - 1; i++) {
      const fromId = TRACK_LOOP_ORDER[i];
      const toId = TRACK_LOOP_ORDER[i + 1];
      const from = armTrackMap.get(fromId);
      const to = armTrackMap.get(toId);

      if (from && to) {
        segments.push({
          x1: from.screenX,
          y1: from.screenY,
          x2: to.screenX,
          y2: to.screenY,
          key: `arm-${armIndex}-${fromId}-${toId}`,
        });
      }
    }

    const handoffFrom = armTrackMap.get("T13");
    const handoffTo = nextTrackMap.get("T0");

    if (handoffFrom && handoffTo) {
      segments.push({
        x1: handoffFrom.screenX,
        y1: handoffFrom.screenY,
        x2: handoffTo.screenX,
        y2: handoffTo.screenY,
        key: `handoff-${armIndex}-to-${(armIndex + 1) % arms.length}`,
      });
    }
  }

  return segments;
}

function buildJoinDistances(arms: RenderedSpot[][]): JoinDistance[] {
  const joins: JoinDistance[] = [];

  for (let armIndex = 0; armIndex < arms.length; armIndex++) {
    const arm = arms[armIndex];
    const nextArm = arms[(armIndex + 1) % arms.length];

    const armTrackMap = new Map(
      arm.filter((s) => s.kind === "track").map((s) => [s.id, s])
    );
    const nextTrackMap = new Map(
      nextArm.filter((s) => s.kind === "track").map((s) => [s.id, s])
    );

    const from = armTrackMap.get("T13");
    const to = nextTrackMap.get("T0");

    if (!from || !to) continue;

    const dx = to.screenX - from.screenX;
    const dy = to.screenY - from.screenY;
    const distancePx = Math.hypot(dx, dy);

    joins.push({
      key: `join-${armIndex}-to-${(armIndex + 1) % arms.length}`,
      fromArm: armIndex,
      toArm: (armIndex + 1) % arms.length,
      x1: from.screenX,
      y1: from.screenY,
      x2: to.screenX,
      y2: to.screenY,
      midX: from.screenX + dx * 0.5,
      midY: from.screenY + dy * 0.5,
      distancePx,
    });
  }

  return joins;
}

function buildArrowGlyph(seg: Segment, size = 10) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy);

  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;

  const midX = seg.x1 + dx * 0.5;
  const midY = seg.y1 + dy * 0.5;

  const tipX = midX + ux * (size * 0.8);
  const tipY = midY + uy * (size * 0.8);

  const baseX = midX - ux * (size * 0.8);
  const baseY = midY - uy * (size * 0.8);

  const px = -uy;
  const py = ux;

  const leftX = baseX + px * (size * 0.55);
  const leftY = baseY + py * (size * 0.55);

  const rightX = baseX - px * (size * 0.55);
  const rightY = baseY - py * (size * 0.55);

  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

export default function Sandbox() {
  const [boardType, setBoardType] = useState<BoardType>("4P");

  const initialGeometry = BOARD_GEOMETRY[4];

  const [t6RadiusSpots, setT6RadiusSpots] = useState<number>(initialGeometry.t6Radius);
  const [branchSwingDeg, setBranchSwingDeg] = useState<number>(initialGeometry.branchSwingDeg);
  const [spotSpacingPx, setSpotSpacingPx] = useState<number>(initialGeometry.spotSpacing);
  const [holeRadiusPx, setHoleRadiusPx] = useState<number>(initialGeometry.holeRadius);

  const [showCenterlines, setShowCenterlines] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [showTrackOverlay, setShowTrackOverlay] = useState<boolean>(true);
  const [showDirectionArrows, setShowDirectionArrows] = useState<boolean>(true);
  const [showJoinDistances, setShowJoinDistances] = useState<boolean>(false);

  function loadPreset(nextBoardType: BoardType) {
    const arms = PRESETS[nextBoardType].arms;
    const preset = BOARD_GEOMETRY[arms];

    setBoardType(nextBoardType);
    setT6RadiusSpots(preset.t6Radius);
    setBranchSwingDeg(preset.branchSwingDeg);
    setSpotSpacingPx(preset.spotSpacing);
    setHoleRadiusPx(preset.holeRadius);
  }

  function resetPreset() {
    loadPreset(boardType);
  }

  const armsCount = PRESETS[boardType].arms;

  const arms = useMemo(() => {
    return Array.from({ length: armsCount }, (_, armIndex) =>
      buildArmSpots(armIndex, armsCount, t6RadiusSpots, spotSpacingPx, branchSwingDeg)
    );
  }, [armsCount, t6RadiusSpots, spotSpacingPx, branchSwingDeg]);

  const centerlines = useMemo(() => {
    return Array.from({ length: armsCount }, (_, armIndex) =>
      buildCenterline(armIndex, armsCount, t6RadiusSpots, spotSpacingPx)
    );
  }, [armsCount, t6RadiusSpots, spotSpacingPx]);

  const trackOverlaySegments = useMemo(() => buildTrackOverlaySegments(arms), [arms]);

  const joinDistances = useMemo(() => buildJoinDistances(arms), [arms]);

  const arrowGlyphs = useMemo(() => {
    const arrowSize = Math.max(7, holeRadiusPx * 0.9);

    return trackOverlaySegments
      .map((seg) => ({
        key: `arrow-${seg.key}`,
        points: buildArrowGlyph(seg, arrowSize),
      }))
      .filter((a): a is { key: string; points: string } => a.points != null);
  }, [trackOverlaySegments, holeRadiusPx]);

  const cardStyle: React.CSSProperties = {
    border: "1px solid #cfcfcf",
    borderRadius: 8,
    background: "#f8f8f8",
    padding: 12,
    marginBottom: 16,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 12,
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
  };

  return (
    <section style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>LMR Sandbox</h3>

      <div style={rowStyle}>
        <label style={labelStyle}>
          <span>Board</span>
          <select value={boardType} onChange={(e) => loadPreset(e.target.value as BoardType)}>
            <option value="4P">4P</option>
            <option value="6P">6P</option>
            <option value="8P">8P</option>
          </select>
        </label>

        <button onClick={resetPreset}>Reset Preset</button>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showCenterlines}
            onChange={(e) => setShowCenterlines(e.target.checked)}
          />
          <span>Show Centerlines</span>
        </label>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showTrackOverlay}
            onChange={(e) => setShowTrackOverlay(e.target.checked)}
          />
          <span>Show Track Overlay</span>
        </label>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showDirectionArrows}
            onChange={(e) => setShowDirectionArrows(e.target.checked)}
          />
          <span>Show Direction Arrows</span>
        </label>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showJoinDistances}
            onChange={(e) => setShowJoinDistances(e.target.checked)}
          />
          <span>Show Join Distances</span>
        </label>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          <span>Show Labels</span>
        </label>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>
          <span>T6 Radius</span>
          <input
            type="range"
            min="5"
            max="14"
            step="0.1"
            value={t6RadiusSpots}
            onChange={(e) => setT6RadiusSpots(Number(e.target.value))}
          />
          <span>{t6RadiusSpots.toFixed(1)}</span>
        </label>

        <label style={labelStyle}>
          <span>Spot Spacing</span>
          <input
            type="range"
            min="20"
            max="70"
            step="1"
            value={spotSpacingPx}
            onChange={(e) => setSpotSpacingPx(Number(e.target.value))}
          />
          <span>{spotSpacingPx}</span>
        </label>

        <label style={labelStyle}>
          <span>Branch Swing</span>
          <input
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={branchSwingDeg}
            onChange={(e) => setBranchSwingDeg(Number(e.target.value))}
          />
          <span>{branchSwingDeg.toFixed(1)}°</span>
        </label>

        <label style={labelStyle}>
          <span>Hole Size</span>
          <input
            type="range"
            min="4"
            max="14"
            step="0.2"
            value={holeRadiusPx}
            onChange={(e) => setHoleRadiusPx(Number(e.target.value))}
          />
          <span>{holeRadiusPx.toFixed(1)}</span>
        </label>
      </div>

      <svg
        width="900"
        height="900"
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        style={{
          border: "1px solid #cfcfcf",
          background: "#fafafa",
          maxWidth: "100%",
        }}
      >
        {showCenterlines &&
          centerlines.map((line, idx) => (
            <line
              key={`centerline-${idx}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#d0d0d0"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          ))}

        {showTrackOverlay &&
          trackOverlaySegments.map((seg) => (
            <line
              key={seg.key}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="#5d86ff"
              strokeWidth="3"
              strokeOpacity="0.65"
              strokeLinecap="round"
            />
          ))}

        {showDirectionArrows &&
          arrowGlyphs.map((arrow) => (
            <polygon
              key={arrow.key}
              points={arrow.points}
              fill="#315fe8"
              fillOpacity="0.85"
            />
          ))}

        {showJoinDistances &&
          joinDistances.map((join) => (
            <g key={join.key}>
              <line
                x1={join.x1}
                y1={join.y1}
                x2={join.x2}
                y2={join.y2}
                stroke="#ff8a00"
                strokeWidth="4"
                strokeOpacity="0.9"
                strokeLinecap="round"
              />
              <rect
                x={join.midX - 22}
                y={join.midY - 11}
                width="44"
                height="18"
                rx="4"
                ry="4"
                fill="#fff4e8"
                stroke="#ff8a00"
                strokeWidth="1"
              />
              <text
                x={join.midX}
                y={join.midY + 3}
                fontSize="11"
                textAnchor="middle"
                fill="#a65100"
              >
                {join.distancePx.toFixed(1)}
              </text>
            </g>
          ))}

        <circle cx={CENTER} cy={CENTER} r={holeRadiusPx} fill="#111111" />

        {arms.flat().map((spot, idx) => (
          <g key={`${spot.id}-${idx}`}>
            <circle
              cx={spot.screenX}
              cy={spot.screenY}
              r={holeRadiusPx}
              fill={spot.kind === "home" ? "#e7e7e7" : "#d7d7d7"}
              stroke="#8d8d8d"
              strokeWidth="1.4"
            />
            {showLabels && (
              <text
                x={spot.screenX + holeRadiusPx + 4}
                y={spot.screenY - holeRadiusPx - 2}
                fontSize="14"
                fill={spot.kind === "home" ? "#0b7a0b" : "#333333"}
              >
                {spot.id}
              </text>
            )}
          </g>
        ))}
      </svg>
    </section>
  );
}