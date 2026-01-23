// src/engine/teamTurn.ts

import type { GameState, PlayerId } from "../types";
import { listLegalMovesForPlayer } from "./legalMoves";

export function resolveRollActor(state: GameState, dice: readonly number[]): PlayerId {
  const current = state.turn.currentPlayerId;
  const curPlayer = state.players[current];

  if (!state.config.options.teamPlay) return current;
  if (!curPlayer.hasFinished) return current;

  const teamId = curPlayer.teamId;
  if (!teamId) return current;

  const team = (state.config.options.teams ?? []).find((t) => t.teamId === teamId);
  if (!team) return current;

  for (const pid of team.memberPlayerIds) {
    if (pid === current) continue;
    const moves = listLegalMovesForPlayer(state, pid, dice);
    if (moves.length > 0) return pid;
  }

  return current;
}
