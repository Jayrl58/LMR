import { GameState } from "../types";

type PlayerLike = { id: string };

function coercePlayers(state: any): PlayerLike[] {
  // Accept either:
  // - players: Player[]
  // - players: Record<string, Player>
  // - playersById: Record<string, Player>
  const p = state?.players;

  if (Array.isArray(p)) return p as PlayerLike[];

  if (p && typeof p === "object") return Object.values(p) as PlayerLike[];

  const byId = state?.playersById;
  if (byId && typeof byId === "object") return Object.values(byId) as PlayerLike[];

  return [];
}

export function validateState(state: GameState): void {
  if (!state) {
    throw new Error("validateState: state is required");
  }

  const players = coercePlayers(state as any);

  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("validateState: players must be a non-empty collection");
  }

  const playerCount = players.length;

  // Only constrain playerCount to 4/6/8 when teamPlay is enabled.
  if (state.teamPlay) {
    if (![4, 6, 8].includes(playerCount)) {
      throw new Error("validateState: teamPlay requires playerCount to be 4, 6, or 8");
    }
  }

  // ------------------------------------------------------------
  // Team Configuration Invariants
  // ------------------------------------------------------------

  if (state.teamPlay) {
    if (!Array.isArray((state as any).teams)) {
      throw new Error("validateState: teams must be an array when teamPlay is enabled");
    }

    const teams = (state as any).teams as unknown[];

    if (teams.length === 0) {
      throw new Error("validateState: teams cannot be empty when teamPlay is enabled");
    }

    const playerIds = new Set(players.map(p => p.id));
    const allTeamMembers: string[] = [];

    for (const team of teams) {
      if (!Array.isArray(team) || team.length === 0) {
        throw new Error("validateState: each team must be a non-empty array");
      }

      for (const memberId of team) {
        if (typeof memberId !== "string") {
          throw new Error("validateState: team member IDs must be strings");
        }

        if (!playerIds.has(memberId)) {
          throw new Error("validateState: team member not found in players");
        }

        allTeamMembers.push(memberId);
      }
    }

    // Must partition players exactly once
    if (allTeamMembers.length !== playerCount) {
      throw new Error("validateState: teams must include all players exactly once");
    }

    const uniqueMembers = new Set(allTeamMembers);
    if (uniqueMembers.size !== playerCount) {
      throw new Error("validateState: duplicate player detected across teams");
    }

    // Validate allowed team shapes (scope: 2–4 teams, constrained by playerCount)
    const teamSizes = (teams as string[][]).map((t) => t.length).sort((a, b) => a - b);

    const isValid4 =
      playerCount === 4 &&
      teamSizes.length === 2 &&
      teamSizes[0] === 2 &&
      teamSizes[1] === 2;

    // 6P team play supports:
    // - 2 teams of 3 (2x3)
    // - 3 teams of 2 (3x2)
    const isValid6 =
      playerCount === 6 &&
      ((teamSizes.length === 2 && teamSizes[0] === 3 && teamSizes[1] === 3) ||
        (teamSizes.length === 3 &&
          teamSizes[0] === 2 &&
          teamSizes[1] === 2 &&
          teamSizes[2] === 2));

    // 8P team play supports:
    // - 2 teams of 4 (2x4)
    // - 4 teams of 2 (4x2)
    const isValid8 =
      playerCount === 8 &&
      ((teamSizes.length === 2 && teamSizes[0] === 4 && teamSizes[1] === 4) ||
        (teamSizes.length === 4 &&
          teamSizes[0] === 2 &&
          teamSizes[1] === 2 &&
          teamSizes[2] === 2 &&
          teamSizes[3] === 2));

    if (!(isValid4 || isValid6 || isValid8)) {
      throw new Error("validateState: invalid team configuration for player count");
    }
  }

  // ------------------------------------------------------------
  // Finished order integrity (existing invariant pattern)
  // ------------------------------------------------------------

  if ((state as any).finishedOrder) {
    const finishedOrder = (state as any).finishedOrder as unknown;
    if (!Array.isArray(finishedOrder)) {
      throw new Error("validateState: finishedOrder must be an array when present");
    }

    const finishedSet = new Set(finishedOrder);
    if (finishedSet.size !== finishedOrder.length) {
      throw new Error("validateState: finishedOrder contains duplicates");
    }
  }
}
