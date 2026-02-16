import { GameState, PlayerId } from "../types";

const VALIDATE = process.env.LMR_VALIDATE_STATE !== "0";

export function validateState(state: GameState, where = "unknown"): void {
  if (!VALIDATE) return;

  assert(state, "state missing", where);

  assert(state.players && typeof state.players === "object", "players missing", where);
  const playerIds = Object.keys(state.players) as PlayerId[];

  // ---------------------------
  // Turn + pending dice
  // ---------------------------

  if (state.turn && (state.turn as any).pendingDice) {
    const pendingDice = (state.turn as any).pendingDice;

    assert(Array.isArray(pendingDice), "turn.pendingDice must be array", where);

    const teamPlayEnabled = state.config?.options?.teamPlay === true;

    for (const die of pendingDice) {
      assert(die, "pending die missing", where);

      if ("resolved" in die) {
        assert(typeof die.resolved === "boolean", "die.resolved must be boolean", where);
      }

      // ---------------------------
      // NEW: Delegation invariants
      // ---------------------------

      if (die.controllerId !== undefined) {
        // 1️⃣ Must reference valid player
        assert(
          playerIds.includes(die.controllerId as PlayerId),
          `die.controllerId invalid: ${die.controllerId}`,
          where
        );

        // 2️⃣ Only allowed when team play enabled
        assert(
          teamPlayEnabled,
          "die.controllerId present but teamPlay disabled",
          where
        );

        // 3️⃣ Cannot exist on resolved die
        assert(
          die.resolved !== true,
          "die.controllerId present on resolved die",
          where
        );
      }
    }
  }
}

function assert(condition: unknown, message: string, where: string): asserts condition {
  if (!condition) {
    throw new Error(`validateState: ${message}${where ? ` @ ${where}` : ""}`);
  }
}
