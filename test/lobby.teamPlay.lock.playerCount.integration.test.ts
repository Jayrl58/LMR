import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { makeState } from "./helpers";

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

async function nextWithTimeout(next: () => Promise<string>, label: string, ms = 2000) {
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
    const m = JSON.parse(await nextWithTimeout(next, `${label} (lobbySync) #${i}`, 2500));
    if (m?.type === "lobbySync" && predicate(m)) return m;
  }
  throw new Error(`Did not receive expected lobbySync within ${max} messages (${label})`);
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

function extractTeams(m: any) {
  return m?.lobby?.gameConfig?.teams;
}

function asSetKey(ids: string[]) {
  return [...new Set(ids)].sort().join("|");
}

describe("lobby team play lock (playerCount-gated)", () => {
  it("does not lock teams before roster is complete; locks once complete on first ready=true", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // 3 clients join a new room
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

    // Set lobby config (teamPlay + playerCount=4)
    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });

    // Wait until lobby reflects the gameConfig and 3 players
    await waitForLobby(
      next0,
      "0 lobby w/config",
      (m) => m.lobby?.players?.length === 3 && m.lobby?.gameConfig?.teamPlay === true && m.lobby?.gameConfig?.playerCount === 4
    );

    // Ready before roster complete => should NOT lock teams (but teams may exist/assign)
    setReady(ws0, true);
    const lNoLock = await waitForLobby(next0, "0 lobby no-lock", (m) => m.lobby?.players?.length === 3);

    const teamsNoLock = extractTeams(lNoLock);
    expect(teamsNoLock).toBeTruthy();
    expect(teamsNoLock?.isLocked).toBe(false);
    expect(Array.isArray(teamsNoLock?.teamA)).toBe(true);
    expect(Array.isArray(teamsNoLock?.teamB)).toBe(true);

    // Partition equals players (no unassigned)
    const playerIds3 = (lNoLock.lobby?.players ?? []).map((p: any) => p.playerId);
    const allTeamIds3 = [...teamsNoLock.teamA, ...teamsNoLock.teamB];
    expect(asSetKey(allTeamIds3)).toBe(asSetKey(playerIds3));

    // With 3 players and tie->A assignment, expect A has 2 and B has 1
    expect(teamsNoLock.teamA.length).toBe(2);
    expect(teamsNoLock.teamB.length).toBe(1);

    // 4th client joins
    const ws3 = new WebSocket(`ws://localhost:${server.port}`);
    const next3 = makeQueue(ws3);
    await wsOpen(ws3);
    await waitForType(next3, "welcome", "3 welcome");
    hello(ws3, "c3");
    await waitForType(next3, "welcome", "3 welcomeEcho");
    join(ws3, roomCode);
    await waitForType(next3, "roomJoined", "3 roomJoined");

    // Ensure lobby sees 4 players
    await waitForLobby(next0, "0 lobby 4 players", (m) => m.lobby?.players?.length === 4);

    // First ready after roster complete => lock teams
    setReady(ws1, true);
    const lLocked = await waitForLobby(
      next0,
      "0 lobby locked",
      (m) => m.lobby?.players?.length === 4 && !!extractTeams(m)?.isLocked
    );

    const teams = extractTeams(lLocked);
    expect(teams?.isLocked).toBe(true);
    expect(Array.isArray(teams?.teamA)).toBe(true);
    expect(Array.isArray(teams?.teamB)).toBe(true);
    expect(teams.teamA.length).toBe(2);
    expect(teams.teamB.length).toBe(2);

    // Partition equals players
    const playerIds4 = (lLocked.lobby?.players ?? []).map((p: any) => p.playerId);
    const allTeamIds4 = [...teams.teamA, ...teams.teamB];
    expect(asSetKey(allTeamIds4)).toBe(asSetKey(playerIds4));

    const firstTeamsJson = JSON.stringify(teams);

    // Subsequent ready events must not reshuffle
    setReady(ws2, true);
    const lStillLocked = await waitForLobby(
      next0,
      "0 lobby still locked",
      (m) => m.lobby?.players?.length === 4 && !!extractTeams(m)?.isLocked
    );
    expect(JSON.stringify(extractTeams(lStillLocked))).toBe(firstTeamsJson);

    ws0.close();
    ws1.close();
    ws2.close();
    ws3.close();
    await server.close();
  });

  it("does not lock teams for odd playerCount (two-team split requires even count)", async () => {
    const initialState = makeState({ playerCount: 5 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // 5 clients
    const wss = Array.from({ length: 5 }, () => new WebSocket(`ws://localhost:${server.port}`));
    const nexts = wss.map(makeQueue);

    await Promise.all(wss.map(wsOpen));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcome`)));

    wss.forEach((ws, i) => hello(ws, `c${i}`));
    await Promise.all(nexts.map((n, i) => waitForType(n, "welcome", `${i} welcomeEcho`)));

    join(wss[0]);
    const j0 = await waitForType(nexts[0], "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    for (let i = 1; i < 5; i++) join(wss[i], roomCode);
    await Promise.all(nexts.slice(1).map((n, i) => waitForType(n, "roomJoined", `${i + 1} roomJoined`)));

    setLobbyGameConfig(wss[0], { playerCount: 5, teamPlay: true, teamCount: 2 });

    // Wait until lobby sees 5 players + config
    await waitForLobby(
      nexts[0],
      "0 lobby 5 players w/config",
      (m) =>
        m.lobby?.players?.length === 5 &&
        m.lobby?.gameConfig?.teamPlay === true &&
        m.lobby?.gameConfig?.playerCount === 5
    );

    // Ready after roster complete but odd => should NOT lock (but teams may exist/assign)
    setReady(wss[0], true);
    const l = await waitForLobby(nexts[0], "0 lobby post-ready", (m) => m.lobby?.players?.length === 5);

    const teamsPostReady = extractTeams(l);
    expect(teamsPostReady).toBeTruthy();
    expect(teamsPostReady?.isLocked).toBe(false);
    expect(Array.isArray(teamsPostReady?.teamA)).toBe(true);
    expect(Array.isArray(teamsPostReady?.teamB)).toBe(true);

    // Partition equals players (no unassigned)
    const playerIds = (l.lobby?.players ?? []).map((p: any) => p.playerId);
    const allTeamIds = [...teamsPostReady.teamA, ...teamsPostReady.teamB];
    expect(asSetKey(allTeamIds)).toBe(asSetKey(playerIds));

    // With 5 players and tie->A assignment, expect A has 3 and B has 2
    expect(teamsPostReady.teamA.length).toBe(3);
    expect(teamsPostReady.teamB.length).toBe(2);

    wss.forEach((ws) => ws.close());
    await server.close();
  });
});
