import { describe, it, expect } from "vitest";
import { makeState } from "../src/engine/makeState";
import { legalMoves } from "../src/engine";

const P = (id: string) => id as any;

function byKind(moves: any[], kind: string) {
  return moves.filter((m) => m?.kind === kind);
}

// entry index for p0 is 0 in current mapping
function entryIdx() {
  return 0;
}
function oneSpotIdx() {
  return (entryIdx() + 8) % 56;
}
function pointIdx() {
  return (entryIdx() + 13) % 56;
}

describe("ENGINE AUDIT (LMR Rules v1.6) — Entry / Track semantics", () => {
  it("Base -> Track entry on roll 1 enters at the player's 1 Spot", () => {
    const s = makeState({ playerCount: 2 });
    const p0 = P("p0");

    const moves = legalMoves(s as any, p0 as any, [1]);
    const enters = byKind(moves as any[], "enter");

    expect(enters.length).toBeGreaterThan(0);
    for (const m of enters) {
      expect(m.to).toEqual({ zone: "track", index: oneSpotIdx() });
    }
  });

  it("Base -> Track entry on roll 6 enters at the player's Point (6 Spot)", () => {
    const s = makeState({ playerCount: 2 });
    const p0 = P("p0");

    const moves = legalMoves(s as any, p0 as any, [6]);
    const enters = byKind(moves as any[], "enter");

    expect(enters.length).toBeGreaterThan(0);
    for (const m of enters) {
      expect(m.to).toEqual({ zone: "track", index: pointIdx() });
    }
  });
});
