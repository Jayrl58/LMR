import type { GameState } from "../types";
import { applyMove } from "./applyMove";
import type { ReplayLog } from "./replay";
import { recordMove } from "./replayRecorder";

export type ApplyAndRecordResult = {
  nextState: GameState;
  nextLog: ReplayLog;
};

/**
 * Apply a move and append a replay entry for the state transition.
 */
export function applyAndRecord(
  state: GameState,
  move: unknown,
  log: ReplayLog
): ApplyAndRecordResult {
  const { state: nextState } = applyMove(state, move as any);
  const nextLog = recordMove(log, state, move, nextState);
  return { nextState, nextLog };
}
