import type { GameState } from "../types";
import type { ReplayLog } from "./replay";

export const REPLAY_FORMAT_VERSION = 1 as const;

export type ReplayFileV1 = {
  formatVersion: typeof REPLAY_FORMAT_VERSION;

  // ISO timestamp string
  createdAt: string;

  // Initial state for replay (authoritative start point)
  initialState: GameState;

  // Recorded transitions
  log: ReplayLog;
};

export type ReplayFile = ReplayFileV1;
