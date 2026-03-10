export type BoardGeometry = {
  arms: number;
  t6Radius: number;
  spotSpacing: number;
  branchSwingDeg: number;
  holeRadius: number;
  expectedJoinDistance: number;
};

export const BOARD_GEOMETRY: Record<4 | 6 | 8, BoardGeometry> = {
  4: {
    arms: 4,
    t6Radius: 7,
    spotSpacing: 56,
    branchSwingDeg: 0,
    holeRadius: 10,
    expectedJoinDistance: 56
  },

  6: {
    arms: 6,
    t6Radius: 9,
    spotSpacing: 40,
    branchSwingDeg: -3.6,
    holeRadius: 8.0,
    expectedJoinDistance: 40
  },

  8: {
    arms: 8,
    t6Radius: 10.6,
    spotSpacing: 31,
    branchSwingDeg: -3.6,
    holeRadius: 6.6,
    expectedJoinDistance: 31.2
  }
};