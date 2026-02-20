import { describe, it, expect } from "vitest";
import { makeState } from "../src/engine/makeState";
import { applyMove } from "../src/engine/applyMove";
import { setPeg, makeHome, makeTrack } from "./helpers";

describe("team modes: default team mapping", () => {
  it("4P teamPlay default is 2x2: (p0,p2) vs (p1,p3)", () => {
    const s: any = makeState({ playerCount: 4, teamPlay: true });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(2);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p2"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p3"]);
  });

  it("6P teamPlay default is 3x2 opposite pairs: (p0,p3) (p1,p4) (p2,p5)", () => {
    const s: any = makeState({ playerCount: 6, teamPlay: true });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(3);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p3"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p4"]);
    expect(teams[2].memberPlayerIds).toEqual(["p2", "p5"]);
  });

  it("8P teamPlay default is 4x2 opposite pairs: (p0,p4) (p1,p5) (p2,p6) (p3,p7)", () => {
    const s: any = makeState({ playerCount: 8, teamPlay: true });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(4);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p4"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p5"]);
    expect(teams[2].memberPlayerIds).toEqual(["p2", "p6"]);
    expect(teams[3].memberPlayerIds).toEqual(["p3", "p7"]);
  });
});

describe("team modes: explicit selection", () => {
  it("6P 2x3 is evens vs odds: (p0,p2,p4) vs (p1,p3,p5)", () => {
    const s: any = makeState({ playerCount: 6, teamPlay: true, teamMode: "2x3" });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(2);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p2", "p4"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p3", "p5"]);
  });

  it("6P 3x2 is opposite pairs: (p0,p3) (p1,p4) (p2,p5)", () => {
    const s: any = makeState({ playerCount: 6, teamPlay: true, teamMode: "3x2" });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(3);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p3"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p4"]);
    expect(teams[2].memberPlayerIds).toEqual(["p2", "p5"]);
  });

  it("8P 2x4 is evens vs odds: evens (p0,p2,p4,p6) odds (p1,p3,p5,p7)", () => {
    const s: any = makeState({ playerCount: 8, teamPlay: true, teamMode: "2x4" });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(2);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p2", "p4", "p6"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p3", "p5", "p7"]);
  });

  it("8P 4x2 is opposite pairs: (p0,p4) (p1,p5) (p2,p6) (p3,p7)", () => {
    const s: any = makeState({ playerCount: 8, teamPlay: true, teamMode: "4x2" });
    const teams = s.config.options.teams;
    expect(teams).toHaveLength(4);
    expect(teams[0].memberPlayerIds).toEqual(["p0", "p4"]);
    expect(teams[1].memberPlayerIds).toEqual(["p1", "p5"]);
    expect(teams[2].memberPlayerIds).toEqual(["p2", "p6"]);
    expect(teams[3].memberPlayerIds).toEqual(["p3", "p7"]);
  });
});

describe("team modes: invalid combinations", () => {
  it("4P cannot use 3x2", () => {
    expect(() => makeState({ playerCount: 4, teamPlay: true, teamMode: "3x2" as any })).toThrow();
  });

  it("6P cannot use 2x2", () => {
    expect(() => makeState({ playerCount: 6, teamPlay: true, teamMode: "2x2" as any })).toThrow();
  });

  it("8P cannot use 2x3", () => {
    expect(() => makeState({ playerCount: 8, teamPlay: true, teamMode: "2x3" as any })).toThrow();
  });
});
