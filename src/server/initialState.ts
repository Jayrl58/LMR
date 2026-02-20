import { GameState } from "../types";
import { makeState, TeamMode } from "../engine/makeState";

/**
 * Production + dev initializer.
 * Uses real engine state construction.
 *
 * Environment variables (optional):
 * - PLAYER_COUNT: number (handled by caller)
 * - TEAM_PLAY: "true" | "false"
 * - TEAM_MODE: "2x2" | "2x3" | "3x2" | "2x4" | "4x2"
 * - DOUBLE_DICE: "true" | "false"
 * - FAST_TRACK: "true" | "false"
 */
export function createInitialState(playerCount: number): GameState {
  const teamPlay = process.env.TEAM_PLAY === "true";
  const teamMode = (process.env.TEAM_MODE as TeamMode | undefined) ?? undefined;
  const doubleDice = process.env.DOUBLE_DICE === "true";
  const fastTrack = process.env.FAST_TRACK === "true";

  return makeState({
    // makeState expects a narrow union type; env is dynamic, so cast is required here.
    playerCount: playerCount as any,
    teamPlay,
    teamMode,
    doubleDice,
    fastTrack,
  });
}
