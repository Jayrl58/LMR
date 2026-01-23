import type { GameState } from "../types";

/**
 * A single replay entry records one authoritative state transition.
 */
export type ReplayEntry = {
  /** Hash of the state BEFORE the move */
  beforeHash: string;

  /** The move that was applied */
  move: unknown;

  /** Hash of the state AFTER the move */
  afterHash: string;
};

/**
 * A replay log is an ordered list of replay entries.
 */
export type ReplayLog = ReplayEntry[];
