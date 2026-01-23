import { describe, it, expect } from "vitest";
import { runScenario } from "./runScenario";
import { makeState, P } from "../helpers";

describe("Scenario harness", () => {
  it("runs a minimal scenario (all pegs in base, roll 2 => no legal moves)", () => {
    const state = makeState({ playerCount: 2 });

    const { moves } = runScenario({
      name: "p0 all in base, dice [2]",
      actorId: P("p0"),
      dice: [2],
      initial: state,
      expectLegalMoveCount: 0,
    });

    expect(moves.length).toBe(0);
  });
});
