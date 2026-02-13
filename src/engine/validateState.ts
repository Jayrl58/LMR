import { GameState, PlayerId } from "../types";

const VALIDATE = process.env.LMR_VALIDATE_STATE !== "0";

/**
 * validateState (minimal / shape-only)
 *
 * Intent:
 * - Catch structural drift (missing fields, invalid ids, bad dice values, malformed peg refs)
 * - Avoid rule duplication (NO legal-move computation, NO “must be finished” derivations, etc.)
 *
 * Important: This validator is designed to be safe to run at multiple internal checkpoints
 * (e.g., applyMove:enter/applyMove:advance/applyMove:exitCenter), so it avoids assumptions
 * about derived lists being fully synchronized mid-move.
 */
export function validateState(state: GameState, where = "unknown"): void {
  if (!VALIDATE) return;

  assert(state, "state missing", where);

  // ---------------------------
  // Core shape
  // ---------------------------

  assert(state.gameId, "gameId missing", where);
  assert(state.phase === "lobby" || state.phase === "active" || state.phase === "ended", "phase invalid", where);

  assert(state.config, "config missing", where);

  // NOTE: Be permissive here. Tests/state constructors may temporarily use 0/undefined-like
  // values during transitions; functional correctness is covered elsewhere by rules/tests.
  assert(typeof state.config.playerCount === "number", "config.playerCount missing", where);
  assert(Number.isInteger(state.config.playerCount), "config.playerCount not integer", where);
  assert(state.config.playerCount >= 0, "config.playerCount negative", where);

  assert(state.config.options, "config.options missing", where);

  // ---------------------------
  // Players + pegs
  // ---------------------------

  // IMPORTANT: In this codebase, players is a PlayerId->Player map (NOT an array).
  assert(state.players && typeof state.players === "object", "players missing", where);
  const playerIds = Object.keys(state.players) as PlayerId[];
  assert(playerIds.length > 0, "no players", where);

  for (const pid of playerIds) {
    const p = state.players[pid];
    assert(p, `player missing: ${pid}`, where);
    assert(p.playerId === pid, `player.playerId mismatch for ${pid}`, where);
    assert(typeof p.displayName === "string", `player.displayName invalid for ${pid}`, where);
    assert(typeof p.seat === "number", `player.seat invalid for ${pid}`, where);
    assert(typeof p.isReady === "boolean", `player.isReady invalid for ${pid}`, where);
    assert(typeof p.hasFinished === "boolean", `player.hasFinished invalid for ${pid}`, where);

    if (p.teamId !== undefined) {
      // teamId is branded at type-level; runtime check is “stringy” only
      assert(typeof p.teamId === "string", `player.teamId invalid for ${pid}`, where);
    }
  }

  assert(state.pegStates && typeof state.pegStates === "object", "pegStates missing", where);
  for (const pid of playerIds) {
    const pegs = state.pegStates[pid];
    assert(Array.isArray(pegs), `pegStates missing/invalid for ${pid}`, where);
    assert(pegs.length === 4, `pegStates[${pid}] must have 4 pegs`, where);

    for (const peg of pegs) {
      assert(peg, `peg missing for ${pid}`, where);
      assert(typeof peg.pegIndex === "number", `pegIndex invalid for ${pid}`, where);
      assert(peg.pegIndex >= 0 && peg.pegIndex <= 3, `pegIndex out of range for ${pid}`, where);
      assert(typeof peg.isFinished === "boolean", `peg.isFinished invalid for ${pid}`, where);
      assertSpotRef(peg.position, where);
    }
  }

  // ---------------------------
  // Turn
  // ---------------------------

  assert(state.turn, "turn missing", where);
  assert(typeof state.turn.currentPlayerId === "string", "turn.currentPlayerId missing", where);
  assert(playerIds.includes(state.turn.currentPlayerId), "turn.currentPlayerId not in players", where);

  assert(state.turn.roll, "turn.roll missing", where);
  if (state.turn.roll.status === "idle") {
    // ok
  } else if (state.turn.roll.status === "rolled") {
    assert(Array.isArray(state.turn.roll.dice), "turn.roll.dice not array", where);
    for (const d of state.turn.roll.dice) assertDie(d, "invalid die", where);
  } else {
    assert(false, "turn.roll.status invalid", where);
  }

  assert(typeof state.turn.legalMovesVersion === "number", "turn.legalMovesVersion invalid", where);

  // ---------------------------
  // finishedOrder (structural only)
  // ---------------------------

  assert(Array.isArray(state.finishedOrder), "finishedOrder not array", where);
  {
    const seen = new Set<string>();
    for (const pid of state.finishedOrder) {
      assert(typeof pid === "string", "finishedOrder entry not string", where);
      assert(playerIds.includes(pid as PlayerId), `finishedOrder invalid playerId: ${pid}`, where);
      assert(!seen.has(pid), `duplicate in finishedOrder: ${pid}`, where);
      seen.add(pid);
      // Note: we do NOT require hasFinished===true here; state may update these in different steps.
    }
  }

  // ---------------------------
  // Team play (shape-only)
  // ---------------------------

  const teamPlayEnabled = state.config.options.teamPlay === true;

  if (teamPlayEnabled && state.config.options.teams) {
    assert(Array.isArray(state.config.options.teams), "config.options.teams not array", where);

    const membership = new Set<string>();
    for (const team of state.config.options.teams) {
      assert(team, "team config missing", where);
      assert(typeof team.teamId === "string", "team.teamId invalid", where);
      assert(Array.isArray(team.memberPlayerIds), "team.memberPlayerIds not array", where);

      for (const pid of team.memberPlayerIds) {
        assert(playerIds.includes(pid as PlayerId), `team contains invalid playerId: ${pid}`, where);
        assert(!membership.has(pid as string), `player appears in multiple teams: ${pid}`, where);
        membership.add(pid as string);
      }
    }

    // If teams are fully declared, they should cover all players.
    // We allow partial coverage during lobby configuration; therefore, only enforce coverage if sizes match.
    if (membership.size > 0) {
      assert(membership.size === playerIds.length, "teams do not cover all players", where);
    }
  }

  // ---------------------------
  // Outcome (structural only)
  // ---------------------------

  if (state.phase === "ended") {
    assert(state.outcome, "ended phase requires outcome", where);
  }

  if (state.outcome) {
    if (state.outcome.kind === "individual") {
      assert(playerIds.includes(state.outcome.winnerPlayerId), "outcome winnerPlayerId invalid", where);
    } else if (state.outcome.kind === "team") {
      assert(typeof state.outcome.winnerTeamId === "string", "outcome winnerTeamId invalid", where);
      assert(Array.isArray(state.outcome.winnerTeamPlayersInFinishOrder), "winnerTeamPlayersInFinishOrder not array", where);
      for (const pid of state.outcome.winnerTeamPlayersInFinishOrder) {
        assert(playerIds.includes(pid as PlayerId), `winnerTeamPlayersInFinishOrder invalid playerId: ${pid}`, where);
      }
    } else {
      assert(false, "outcome.kind invalid", where);
    }
  }
}

// -------------------------------------
// Helpers
// -------------------------------------

function assert(condition: unknown, message: string, where: string): asserts condition {
  if (!condition) throw new Error(`[validateState @ ${where}] ${message}`);
}

function assertDie(value: unknown, message: string, where: string) {
  assert(typeof value === "number", message + ": not a number", where);
  assert(Number.isInteger(value), message + ": not integer", where);
  assert(value >= 0 && value <= 6, message + ": out of range " + value, where);
}

function assertSpotRef(ref: any, where: string) {
  assert(ref && typeof ref === "object", "SpotRef missing", where);
  assert(typeof ref.zone === "string", "SpotRef.zone missing", where);

  switch (ref.zone) {
    case "base":
      assert(typeof ref.playerId === "string", "SpotRef.base.playerId invalid", where);
      break;
    case "track":
      assert(typeof ref.index === "number", "SpotRef.track.index invalid", where);
      assert(Number.isInteger(ref.index), "SpotRef.track.index not integer", where);
      break;
    case "home":
      assert(typeof ref.playerId === "string", "SpotRef.home.playerId invalid", where);
      assert(ref.index === 0 || ref.index === 1 || ref.index === 2 || ref.index === 3, "SpotRef.home.index invalid", where);
      break;
    case "center":
      break;
    case "blackhole":
      break;
    default:
      assert(false, "SpotRef.zone invalid: " + ref.zone, where);
  }
}
