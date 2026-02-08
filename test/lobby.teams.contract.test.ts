import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { makeState } from "./helpers";

/**
 * Contract tests (team assignment + team swap).
 *
 * Protocol anchors (from src/server/protocol.ts):
 * - Client->Server: hello, joinRoom, setLobbyGameConfig, setReady
 * - Server->Client: welcome, roomJoined, lobbySync, error
 *
 * IMPORTANT:
 * These tests are written contract-first. They should FAIL until the server implements:
 * - Auto-creation + auto-assignment of gameConfig.teams when teamPlay is enabled (Hybrid Option 4)
 * - A new client message "setTeam" (self-only) and related validations
 *
 * Design principle for contract-first tests:
 * - Never "wait forever" for unimplemented behavior.
 * - Wait for an observable baseline state (lobbySync with teamPlay enabled), then assert contract-required fields.
 */

function makeQueue(ws: WebSocket) {
  const q: string[] = [];
  let resolve: ((s: string) => void) | null = null;

  ws.on("message", (d) => {
    const s = typeof d === "string" ? d : d.toString("utf8");
    if (resolve) {
      const r = resolve;
      resolve = null;
      r(s);
    } else q.push(s);
  });

  return async () => {
    if (q.length) return q.shift()!;
    return await new Promise<string>((r) => (resolve = r));
  };
}

async function nextWithTimeout(next: () => Promise<string>, label: string, ms = 2500) {
  return await Promise.race([
    next(),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for message (${label}) after ${ms}ms`)), ms)
    ),
  ]);
}

async function wsOpen(ws: WebSocket) {
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });
}

async function waitForType(next: () => Promise<string>, type: string, label: string, max = 40) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (${type}) #${i}`));
    if (m?.type === type) return m;
  }
  throw new Error(`Did not receive ${type} within ${max} messages (${label})`);
}

async function waitForLobby(next: () => Promise<string>, label: string, predicate: (m: any) => boolean, max = 80) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (lobbySync) #${i}`, 3000));
    if (m?.type === "lobbySync" && predicate(m)) return m;
  }
  throw new Error(`Did not receive expected lobbySync within ${max} messages (${label})`);
}

async function expectErrorCodeSoon(next: () => Promise<string>, label: string, code: string, max = 20) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (error) #${i}`, 1500));
    if (m?.type === "error") {
      expect(m.code).toBe(code);
      return m;
    }
  }
  throw new Error(`Did not receive error(${code}) within ${max} messages (${label})`);
}

function hello(ws: WebSocket, clientId: string) {
  ws.send(JSON.stringify({ type: "hello", clientId }));
}

function join(ws: WebSocket, roomCode?: string) {
  ws.send(JSON.stringify({ type: "joinRoom", roomCode }));
}

function setLobbyGameConfig(ws: WebSocket, gameConfig: any) {
  ws.send(JSON.stringify({ type: "setLobbyGameConfig", gameConfig }));
}

function setReady(ws: WebSocket, ready: boolean) {
  ws.send(JSON.stringify({ type: "setReady", ready }));
}

/**
 * Contract-introduced message (not yet in protocol.ts)
 * Self-only team swap request.
 */
function setTeam(ws: WebSocket, team: "A" | "B", reqId?: string) {
  ws.send(JSON.stringify({ type: "setTeam", team, reqId }));
}

function extractTeams(m: any) {
  return m?.lobby?.gameConfig?.teams;
}

function extractPlayerIds(m: any): string[] {
  const players = m?.lobby?.players ?? [];
  return players.map((p: any) => p.playerId).filter(Boolean);
}

function sorted(xs: string[]) {
  return [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function asSetKey(xs: string[]) {
  return sorted(xs).join("|");
}

function expectTeamsPartition(lobbySync: any) {
  const teams = extractTeams(lobbySync);
  expect(teams).toBeTruthy();

  const playerIds = extractPlayerIds(lobbySync);
  const teamA: string[] = teams?.teamA ?? [];
  const teamB: string[] = teams?.teamB ?? [];

  // No duplicates within teams
  expect(new Set(teamA).size).toBe(teamA.length);
  expect(new Set(teamB).size).toBe(teamB.length);

  // No overlap
  const overlap = teamA.filter((id) => teamB.includes(id));
  expect(overlap).toEqual([]);

  // Partition equals players
  const allTeamIds = [...teamA, ...teamB];
  expect(asSetKey(allTeamIds)).toBe(asSetKey(playerIds));
}

function computeExpectedTeamsByPlayerId(playerIds: string[]) {
  // Hybrid Option 4 deterministic algorithm locked:
  // - order by playerId ascending
  // - assign to smaller-count team, tie->A
  const ordered = sorted(playerIds);
  const teamA: string[] = [];
  const teamB: string[] = [];
  for (const id of ordered) {
    if (teamA.length < teamB.length) teamA.push(id);
    else if (teamB.length < teamA.length) teamB.push(id);
    else teamA.push(id);
  }
  return { teamA, teamB };
}

describe("lobby teams contract (assignment + self-only swap)", () => {
  it("A1: enabling Team Play must backfill teams and partition players deterministically (hybrid option 4)", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const wss = Array.from({ length: 4 }, () => new WebSocket(`ws://localhost:${server.port}`));
    const nexts = wss.map(makeQueue);

    await Promise.all(wss.map(wsOpen));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcome`)));

    wss.forEach((ws, i) => hello(ws, `c${i}`));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcomeEcho`)));

    join(wss[0]);
    const j0 = await waitForType(nexts[0], "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    for (let i = 1; i < 4; i++) join(wss[i], roomCode);
    await Promise.all(nexts.slice(1).map((n, i) => waitForType(n, "roomJoined", `${i + 1} roomJoined`)));

    // Enable Team Play
    setLobbyGameConfig(wss[0], { playerCount: 4, teamPlay: true, teamCount: 2 });

    // Baseline observable: lobbySync reflects teamPlay enabled with all players present.
    const l = await waitForLobby(
      nexts[0],
      "0 lobbySync after enabling teamPlay",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teamPlay === true
    );

    // Contract-required: teams must exist and be unlocked initially (unless existing auto-lock rules apply).
    const teams = extractTeams(l);
    expect(teams).toBeTruthy();
    expect(teams.isLocked).toBe(false);

    expectTeamsPartition(l);

    const playerIds = extractPlayerIds(l);
    const expected = computeExpectedTeamsByPlayerId(playerIds);

    expect(sorted(teams.teamA)).toEqual(sorted(expected.teamA));
    expect(sorted(teams.teamB)).toEqual(sorted(expected.teamB));

    wss.forEach((ws) => ws.close());
    await server.close();
  });

  it("B1/B2: joining while teamPlay enabled assigns to smaller team; tie -> A", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // 3 initial clients
    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);

    await Promise.all([wsOpen(ws0), wsOpen(ws1), wsOpen(ws2)]);
    await Promise.all([
      waitForType(next0, "welcome", "0 welcome"),
      waitForType(next1, "welcome", "1 welcome"),
      waitForType(next2, "welcome", "2 welcome"),
    ]);

    hello(ws0, "c0");
    hello(ws1, "c1");
    hello(ws2, "c2");
    await Promise.all([
      waitForType(next0, "welcome", "0 welcomeEcho"),
      waitForType(next1, "welcome", "1 welcomeEcho"),
      waitForType(next2, "welcome", "2 welcomeEcho"),
    ]);

    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    join(ws1, roomCode);
    join(ws2, roomCode);
    await Promise.all([
      waitForType(next1, "roomJoined", "1 roomJoined"),
      waitForType(next2, "roomJoined", "2 roomJoined"),
    ]);

    // Enable Team Play with 3 players present (backfill)
    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });

    const l3 = await waitForLobby(
      next0,
      "0 lobbySync after enabling teamPlay (3 players)",
      (m) => m.lobby?.players?.length === 3 && m.lobby?.gameConfig?.teamPlay === true
    );

    const teams3 = extractTeams(l3);
    expect(teams3).toBeTruthy();
    expect(teams3.isLocked).toBe(false);
    expectTeamsPartition(l3);

    // 4th client joins
    const ws3 = new WebSocket(`ws://localhost:${server.port}`);
    const next3 = makeQueue(ws3);
    await wsOpen(ws3);
    await waitForType(next3, "welcome", "3 welcome");
    hello(ws3, "c3");
    await waitForType(next3, "welcome", "3 welcomeEcho");
    join(ws3, roomCode);
    await waitForType(next3, "roomJoined", "3 roomJoined");

    const l4 = await waitForLobby(
      next0,
      "0 lobbySync after 4th join",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teamPlay === true
    );

    const teams4 = extractTeams(l4);
    expect(teams4).toBeTruthy();
    expect(teams4.isLocked).toBe(false);
    expectTeamsPartition(l4);

    // Validate assignment matches deterministic algorithm
    const playerIds = extractPlayerIds(l4);
    const expected = computeExpectedTeamsByPlayerId(playerIds);
    expect(sorted(teams4.teamA)).toEqual(sorted(expected.teamA));
    expect(sorted(teams4.teamB)).toEqual(sorted(expected.teamB));

    ws0.close();
    ws1.close();
    ws2.close();
    ws3.close();
    await server.close();
  });

  it("C1: setTeam (self-only) swaps team pre-lock and updates lobbySync", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const wss = Array.from({ length: 4 }, () => new WebSocket(`ws://localhost:${server.port}`));
    const nexts = wss.map(makeQueue);

    await Promise.all(wss.map(wsOpen));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcome`)));

    wss.forEach((ws, i) => hello(ws, `c${i}`));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcomeEcho`)));

    join(wss[0]);
    const j0 = await waitForType(nexts[0], "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    for (let i = 1; i < 4; i++) join(wss[i], roomCode);
    await Promise.all(nexts.slice(1).map((n, i) => waitForType(n, "roomJoined", `${i + 1} roomJoined`)));

    setLobbyGameConfig(wss[0], { playerCount: 4, teamPlay: true, teamCount: 2 });

    const l0 = await waitForLobby(
      nexts[0],
      "0 lobbySync after enabling teamPlay (pre-swap)",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teamPlay === true
    );

    const teams0 = extractTeams(l0);
    expect(teams0).toBeTruthy();
    expect(teams0.isLocked).toBe(false);
    expectTeamsPartition(l0);

    // Determine p0 playerId (prefer matching by clientId if present; otherwise fall back to first player)
    const myPlayerId = (l0.lobby.players as any[]).find((p) => p.clientId === "c0")?.playerId;
    const p0 = myPlayerId ?? l0.lobby.players?.[0]?.playerId;
    expect(typeof p0).toBe("string");

    const wasOnA = teams0.teamA.includes(p0);
    const targetTeam: "A" | "B" = wasOnA ? "B" : "A";

    setTeam(wss[0], targetTeam, "req-swap-0");

    // Contract: should receive lobbySync reflecting the swap (or error if server rejects).
    // We wait for either a lobbySync that contains teams, then assert membership.
    const l1 = await waitForLobby(
      nexts[0],
      "0 lobbySync after setTeam",
      (m) => m.lobby?.gameConfig?.teamPlay === true
    );

    const teams1 = extractTeams(l1);
    expect(teams1).toBeTruthy();
    expect(teams1.isLocked).toBe(false);
    expectTeamsPartition(l1);

    if (targetTeam === "A") {
      expect(teams1.teamA.includes(p0)).toBe(true);
      expect(teams1.teamB.includes(p0)).toBe(false);
    } else {
      expect(teams1.teamB.includes(p0)).toBe(true);
      expect(teams1.teamA.includes(p0)).toBe(false);
    }

    wss.forEach((ws) => ws.close());
    await server.close();
  });

  it("D2: setTeam rejects when teams are locked (error code LOBBY_LOCKED)", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const wss = Array.from({ length: 4 }, () => new WebSocket(`ws://localhost:${server.port}`));
    const nexts = wss.map(makeQueue);

    await Promise.all(wss.map(wsOpen));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcome`)));

    wss.forEach((ws, i) => hello(ws, `c${i}`));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcomeEcho`)));

    join(wss[0]);
    const j0 = await waitForType(nexts[0], "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    for (let i = 1; i < 4; i++) join(wss[i], roomCode);
    await Promise.all(nexts.slice(1).map((n, i) => waitForType(n, "roomJoined", `${i + 1} roomJoined`)));

    setLobbyGameConfig(wss[0], { playerCount: 4, teamPlay: true, teamCount: 2 });

    // Baseline observable: teamPlay enabled with 4 players
    const preLock = await waitForLobby(
      nexts[0],
      "0 lobbySync after enabling teamPlay (pre-lock)",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teamPlay === true
    );

    const teamsPre = extractTeams(preLock);
    expect(teamsPre).toBeTruthy();
    expect(teamsPre.isLocked).toBe(false);

    // Existing lock-on-first-ready semantics should lock when roster complete.
    setReady(wss[1], true);

    const lockedLobby = await waitForLobby(
      nexts[0],
      "0 lobbySync locked",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teams?.isLocked === true
    );
    expect(extractTeams(lockedLobby).isLocked).toBe(true);

    setTeam(wss[0], "A", "req-swap-locked");

    // Contract: server must reject with error code LOBBY_LOCKED.
    await expectErrorCodeSoon(nexts[0], "0 error after setTeam while locked", "LOBBY_LOCKED");

    wss.forEach((ws) => ws.close());
    await server.close();
  });
});
