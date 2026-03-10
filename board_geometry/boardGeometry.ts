export type BoardArms = 4 | 6 | 8;

export interface BoardGeometry {
  t6Radius: number;
  spotSpacing: number;
  branchSwingDeg: number;
  holeRadius: number;
}

/*
LMR Board Geometry Authority
Frozen from sandbox calibration session.

4P
T6 radius: 7
Spot spacing: 56
Branch swing: 0
Hole radius: 10
Join distance ≈ 56

6P
T6 radius: 9
Spot spacing: 40
Branch swing: -3.6
Hole radius: 8
Join distance ≈ 40

8P
T6 radius: 10.6
Spot spacing: 31
Branch swing: -3.6
Hole radius: 6.6
Join distance ≈ 31.2
*/

export const BOARD_GEOMETRY: Record<BoardArms, BoardGeometry> = {
  4: {
    t6Radius: 7,
    spotSpacing: 56,
    branchSwingDeg: 0,
    holeRadius: 10,
  },

  6: {
    t6Radius: 9,
    spotSpacing: 40,
    branchSwingDeg: -3.6,
    holeRadius: 8,
  },

  8: {
    t6Radius: 10.6,
    spotSpacing: 31,
    branchSwingDeg: -3.6,
    holeRadius: 6.6,
  },
};

export interface ArmSpot {
  id: string;
  x: number;
  y: number;
  kind: "track" | "home";
}

/*
Canonical arm layout grid.

Coordinate system:
y = 0 → bottom row (T4–T8)
x = 0 → centerline

Left branch (toward center):
T8 → T13

Right branch:
T4 → T0

Home column:
H0 → H3
*/

export const CANONICAL_ARM: ArmSpot[] = [
  { id: "T4", x: 2, y: 0, kind: "track" },
  { id: "T5", x: 1, y: 0, kind: "track" },
  { id: "T6", x: 0, y: 0, kind: "track" },
  { id: "T7", x: -1, y: 0, kind: "track" },
  { id: "T8", x: -2, y: 0, kind: "track" },

  { id: "T3", x: 2, y: 1, kind: "track" },
  { id: "T2", x: 2, y: 2, kind: "track" },
  { id: "T1", x: 2, y: 3, kind: "track" },
  { id: "T0", x: 2, y: 4, kind: "track" },

  { id: "T9", x: -2, y: 1, kind: "track" },
  { id: "T10", x: -2, y: 2, kind: "track" },
  { id: "T11", x: -2, y: 3, kind: "track" },
  { id: "T12", x: -2, y: 4, kind: "track" },
  { id: "T13", x: -2, y: 5, kind: "track" },

  { id: "H0", x: 0, y: 1, kind: "home" },
  { id: "H1", x: 0, y: 2, kind: "home" },
  { id: "H2", x: 0, y: 3, kind: "home" },
  { id: "H3", x: 0, y: 4, kind: "home" },
];

export const TRACK_LOOP_ORDER = [
  "T0",
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "T10",
  "T11",
  "T12",
  "T13",
];