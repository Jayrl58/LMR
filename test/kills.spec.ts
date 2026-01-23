import { describe, it, expect } from "vitest";

import { makeState, setPeg, P, makeTrack } from "./helpers";
import { listLegalMoves } from "../src/engine/legalMoves";
import { getTrackEntryIndex } from "../src/engine/boardMapping";
import { normalizeTrackIndex } from "../src/engine/constants";

describe("Kills (captures)", () => {
  it("base entry on roll 1 captures a peg on the 1 Spot (+8)", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");
    const B = P("p1");

    const entryIdx = getTrackEntryIndex(s, A);
    const oneSpotIdx = normalizeTrackIndex(entryIdx + 8);

    // Victim occupies the destination entry space
    s = setPeg(s, B, 0, makeTrack(oneSpotIdx));

    const moves = listLegalMoves(s, [1]);
    const enter = moves.find(
      (m) => m.kind === "enter" && m.to.zone === "track" && m.to.index === oneSpotIdx
    );

    expect(enter).toBeTruthy();
    expect((enter as any).captures?.length).toBe(1);
    expect((enter as any).captures?.[0].victimPlayerId).toBe(B);
  });

  it("base entry on roll 6 captures a peg on the Point (+13)", () => {
    let s = makeState({ playerCount: 2, currentSeat: 0 });
    const A = P("p0");
    const B = P("p1");

    const entryIdx = getTrackEntryIndex(s, A);
    const pointIdx = normalizeTrackIndex(entryIdx + 13);

    // Victim occupies the destination entry space
    s = setPeg(s, B, 0, makeTrack(pointIdx));

    const moves = listLegalMoves(s, [6]);
    const enter = moves.find(
      (m) => m.kind === "enter" && m.to.zone === "track" && m.to.index === pointIdx
    );

    expect(enter).toBeTruthy();
    expect((enter as any).captures?.length).toBe(1);
    expect((enter as any).captures?.[0].victimPlayerId).toBe(B);
  });
});
