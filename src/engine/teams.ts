import type { GameState } from "../types";

/**
 * True iff:
 * - teamPlay is enabled
 * - teamId exists in config teams
 * - every member of the team hasFinished === true
 */
export function isTeamFinished(game: GameState, teamId: string): boolean {
  const opts: any = (game as any).config?.options;
  if (!opts?.teamPlay) return false;

  const teams: any[] | undefined = opts?.teams;
  if (!Array.isArray(teams)) return false;

  const team = teams.find((t) => t?.teamId === teamId);
  if (!team || !Array.isArray(team.memberPlayerIds)) return false;

  for (const pid of team.memberPlayerIds) {
    const ps: any = (game as any).players?.[pid];
    if (!ps || ps.hasFinished !== true) return false;
  }
  return true;
}

/**
 * Returns the MEMBERS of a specific team in the order they finished.
 *
 * Contract (per existing tests):
 * - Reads `game.finishedOrder` (playerIds in finish sequence)
 * - Filters to only members of `teamId`
 * - Returns those playerIds in that same sequence
 *
 * NOTE: This does NOT require the team to be fully finished.
 */
export function teamFinishOrder(game: GameState, teamId: string): string[] {
  const opts: any = (game as any).config?.options;
  if (!opts?.teamPlay) return [];

  const teams: any[] | undefined = opts?.teams;
  if (!Array.isArray(teams)) return [];

  const team = teams.find((t) => t?.teamId === teamId);
  if (!team || !Array.isArray(team.memberPlayerIds)) return [];

  const members = new Set<string>(team.memberPlayerIds.filter((x: any) => typeof x === "string"));

  const finishedOrder: any = (game as any).finishedOrder;
  if (!Array.isArray(finishedOrder)) return [];

  return finishedOrder.filter((pid) => typeof pid === "string" && members.has(pid));
}
