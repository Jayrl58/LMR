// src/engine/publicApi.ts
//
// Public engine API surface.
// This is the ONLY place legalMoves / chooseRollRecipient are exported from.

import type { GameState, PlayerId } from "../types";
import { listLegalMovesForPlayer } from "./legalMoves";

/**
 * Contract name: legalMoves
 * Used by server + tests.
 */
export function legalMoves(game: GameState, actorId: PlayerId, dice: readonly number[]) {
  return listLegalMovesForPlayer(game, actorId, dice);
}

/**
 * Contract name: chooseRollRecipient
 *
 * Team-play rule support:
 * - If teamPlay is OFF: the roller is the recipient.
 * - If teamPlay is ON and the roller has finished:
 *     the roller may "distribute" the die to a teammate who has legal moves.
 *
 * This function returns the PlayerId that should receive legalMoves + make the move
 * for the provided dice.
 *
 * Note: This does NOT advance turns; it only resolves "who acts for this roll".
 */
export function chooseRollRecipient(
  game: GameState,
  rollerId: PlayerId,
  dice: readonly number[]
): PlayerId {
  if (!game.config.options.teamPlay) return rollerId;

  const roller = game.players[rollerId];
  if (!roller) return rollerId;

  // Only distribute after the roller has finished.
  if (!roller.hasFinished) return rollerId;

  const teamId = roller.teamId;
  if (!teamId) return rollerId;

  const team = (game.config.options.teams ?? []).find((t) => t.teamId === teamId);
  if (!team) return rollerId;

  for (const pid of team.memberPlayerIds) {
    if (pid === rollerId) continue;

    const moves = listLegalMovesForPlayer(game, pid, dice);
    if (moves.length > 0) return pid;
  }

  return rollerId;
}
