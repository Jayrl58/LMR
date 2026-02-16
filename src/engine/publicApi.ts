import type { GameState, PlayerId } from "../types";
import { listLegalMovesForPlayer } from "./legalMoves";

/**
 * Contract name: legalMoves
 */
export function legalMoves(
  game: GameState,
  playerId: PlayerId,
  dice: readonly number[]
) {
  return listLegalMovesForPlayer(game, playerId, dice);
}

/**
 * Contract name: chooseRollRecipient
 *
 * Purpose:
 * - In teamPlay mode, when the roller has finished, a roll may be delegated to a teammate.
 * - If no teammate has legal moves, the roller remains the recipient (and the die will be dead/forfeited later by normal rules).
 *
 * NOTE:
 * - This function is an auto-picker (deterministic by team list order).
 * - If you want “turn owner chooses recipient among eligible teammates”, the server protocol must expose
 *   the eligible recipients and require an explicit delegate action (separate change).
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

    const candidate = game.players[pid];
    if (!candidate) continue;
    if (candidate.hasFinished) continue;

    const moves = listLegalMovesForPlayer(game, pid, dice);
    if (moves.length > 0) return pid;
  }

  return rollerId;
}
