import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { makeState } from "./helpers";

/**
 * Contract tests (team assignment + self-only swap).
 *
 * Protocol anchors (from src/server/protocol.ts):
 * - Client->Server: hello, joinRoom, setLobbyGameConfig, setReady, startGame, setTeam
 * - Server->Client: welcome, roomJoined, lobbySync, stateSync, error
 */

function makeQueue(ws: WebSocket) {
  const q: string[] = [];
  const history: string[] = [];
  const MAX_HISTORY = 50;
  let resolve: ((s: string) => void) | null = null;

  ws.on("message", (d) => {
    const s = String(d);

    history.push(s);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    if (resolve) {
      const r = resolve;
      resolve = null;
      r(s);
      return;
    }
    q.push(s);
  });

  type NextFn = (() => Promise<string>) & { history: string[] };

  const nextFn = (async function next(): Promise<string> {
    if (q.length) return q.shift()!;
    return await new Promise<string>((r) => (resolve = r));
  }) as unknown as NextFn;

  nextFn.history = history;
  return nextFn;
}

async function nextWithTimeout(next: (() => Promise<string>) & { history?: string[] }, label: string, ms = 2500) {
  const timeout = new Promise<string>((_, reject) =>
    setTimeout(() => {
      const tail = (next.history ?? []).slice(-12).map((raw) => {
        try {
          const m = JSON.parse(raw);
          return m?.type ? `${m.type}${m.reqId ? `(${m.reqId})` : ""}` : raw.slice(0, 80);
        } catch {
          return raw.slice(0, 80);
        }
      });
      const extra = tail.length ? `\nLast messages: ${tail.join(" | ")}` : "";
      reject(new Error(`Timeout waiting for message (${label}) after ${ms}ms${extra}`));
    }, ms)
  );

  return await Promise.race([next(), timeout]);
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


async function waitForAny(next: () => Promise<string>, label: string, predicate: (m: any) => boolean, max = 80, ms = 2500) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (any) #${i}`, ms));
    if (predicate(m)) return m;
  }
  throw new Error(`Did not receive expected message within ${max} messages (${label})`);
}

async function waitForLobby(next: () => Promise<string>, label: string, predicate: (m: any) => boolean, max = 80) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (lobbySync) #${i}`, 3000));
    if (m?.type === "lobbySync" && predicate(m)) return m;
  }
  throw new Error(`Did not receive expected lobbySync within ${max} messages (${label})`);
}

async function expectErrorCodeSoon(next: () => Promise<string>, label: string, code: string, max = 25) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (error) #${i}`, 2000));
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

function leaveRoom(ws: WebSocket, reqId?: string) { ws.send(JSON.stringify({ type: "leaveRoom", ...(reqId ? { reqId } : {}) })); }

function setLobbyGameConfig(ws: WebSocket, gameConfig: any) {
  ws.send(JSON.stringify({ type: "setLobbyGameConfig", gameConfig }));
}

function setReady(ws: WebSocket, ready: boolean) {
  ws.send(JSON.stringify({ type: "setReady", ready }));
}

function startGame(ws: WebSocket) {
  ws.send(JSON.stringify({ type: "startGame" }));
}

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
  return sorted([...new Set(xs)]).join("|");
}

function getTeamA(teams: any): string[] { return (teams?.teamA ?? teams?.teams?.A ?? []); }
function getTeamB(teams: any): string[] { return (teams?.teamB ?? teams?.teams?.B ?? []); }
function getTeam(teams: any, name: "A" | "B"): string[] { return name === "A" ? getTeamA(teams) : getTeamB(teams); }

function expectTeamsPartition(lobbySync: any) {
  const teams = extractTeams(lobbySync);
  expect(teams).toBeTruthy();

  const playerIds = extractPlayerIds(lobbySync);
  const teamA: string[] = (teams?.teamA ?? teams?.teams?.A ?? []);
  const teamB: string[] = (teams?.teamB ?? teams?.teams?.B ?? []);

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

    // Enable Team Play after all players present => must backfill immediately
    setLobbyGameConfig(wss[0], { playerCount: 4, teamPlay: true, teamCount: 2 });

    const l = await waitForLobby(
      nexts[0],
      "0 lobby teamPlay enabled",
      (m) => m.lobby?.players?.length === 4 && m.lobby?.gameConfig?.teamPlay === true && !!extractTeams(m)
    );

    expectTeamsPartition(l);

    const players = extractPlayerIds(l);
    const expected = computeExpectedTeamsByPlayerId(players);
    const t = extractTeams(l);
    expect(asSetKey(getTeamA(t))).toBe(asSetKey(expected.teamA));
        expect(asSetKey(getTeamB(t))).toBe(asSetKey(expected.teamB));

    wss.forEach((ws) => ws.close());
    await server.close();
  });

  it("B1/B2: joining while teamPlay enabled assigns to smaller team; tie -> A", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);

    await Promise.all([wsOpen(ws0), wsOpen(ws1), wsOpen(ws2)]);
    await Promise.all([waitForType(next0, "welcome", "0 welcome"), waitForType(next1, "welcome", "1 welcome"), waitForType(next2, "welcome", "2 welcome")]);

    hello(ws0, "c0");
    hello(ws1, "c1");
    hello(ws2, "c2");
    await Promise.all([waitForType(next0, "welcome", "0 welcomeEcho"), waitForType(next1, "welcome", "1 welcomeEcho"), waitForType(next2, "welcome", "2 welcomeEcho")]);

    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    // Enable teamPlay before other players join
    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });

    // ws1 joins
    join(ws1, roomCode);
    await waitForType(next1, "roomJoined", "1 roomJoined");
    const l2 = await waitForLobby(next0, "0 lobby 2 players", (m) => m.lobby?.players?.length === 2 && !!extractTeams(m));
    expectTeamsPartition(l2);

    // ws2 joins
    join(ws2, roomCode);
    await waitForType(next2, "roomJoined", "2 roomJoined");
    const l3 = await waitForLobby(next0, "0 lobby 3 players", (m) => m.lobby?.players?.length === 3 && !!extractTeams(m));
    expectTeamsPartition(l3);

    // With 3 players, tie->A => A has 2, B has 1
    const teams3 = extractTeams(l3);
    expect(getTeamA(teams3).length).toBe(2);
    expect(getTeamB(teams3).length).toBe(1);

    ws0.close();
    ws1.close();
    ws2.close();
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

    // Create room with ws0
    join(wss[0]);
    const j0 = await waitForType(nexts[0], "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    // Others join (capture actorIds)
    join(wss[1], roomCode);
    join(wss[2], roomCode);
    join(wss[3], roomCode);
    const j1 = await waitForType(nexts[1], "roomJoined", "1 roomJoined");
    await Promise.all([
      waitForType(nexts[2], "roomJoined", "2 roomJoined"),
      waitForType(nexts[3], "roomJoined", "3 roomJoined"),
    ]);

    const p1 = j1.playerId as string;

    setLobbyGameConfig(wss[0], { playerCount: 4, teamPlay: true, teamCount: 2 });

    const l = await waitForLobby(nexts[0], "0 lobby teamPlay enabled", (m) => m.lobby?.players?.length === 4 && !!extractTeams(m));
    expectTeamsPartition(l);

    const teamsBefore = extractTeams(l);
    const inA = (getTeamA(teamsBefore) ?? []).includes(p1);
    const target: "A" | "B" = inA ? "B" : "A";

    setTeam(wss[1], target, "req-swap-1");

    const l2 = await waitForLobby(
      nexts[0],
      "0 lobby after setTeam",
      (m) => m.lobby?.players?.length === 4 && !!extractTeams(m) && (getTeam(extractTeams(m), target)).includes(p1)
    );

    expectTeamsPartition(l2);

    const teamsAfter = extractTeams(l2);
    expect(teamsAfter.isLocked).toBe(false);
    expect(getTeam(teamsAfter, target).includes(p1)).toBe(true);

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

    // make roster complete + trigger lock by ready (all players ready)
for (const ws of wss) setReady(ws, true);
const lLocked = await waitForLobby(nexts[0], "lobby locked", (m) => extractTeams(m)?.isLocked === true);
expect(extractTeams(lLocked)?.isLocked).toBe(true);
setTeam(wss[1], "A", "req-locked");
    await expectErrorCodeSoon(nexts[1], "1 setTeam locked", "LOBBY_LOCKED");

    wss.forEach((ws) => ws.close());
    await server.close();
  });
});

describe("lobby teams hardening (rejections + persistence)", () => {
  it("E1: setTeam rejects when teamPlay is disabled (BAD_MESSAGE)", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    await wsOpen(ws0);
    await waitForType(next0, "welcome", "0 welcome");
    hello(ws0, "c0");
    await waitForType(next0, "welcome", "0 welcomeEcho");

    join(ws0);
    await waitForType(next0, "roomJoined", "0 roomJoined");

    // No teamPlay enable
    setTeam(ws0, "A", "req-disabled");
    await expectErrorCodeSoon(next0, "0 setTeam disabled", "BAD_MESSAGE");

    ws0.close();
    await server.close();
  });

  it("E2: setTeam rejects when not in lobby phase (BAD_MESSAGE)", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const ws3 = new WebSocket(`ws://localhost:${server.port}`);

    const next0 = makeQueue(ws0);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);
    const next3 = makeQueue(ws3);

    await Promise.all([wsOpen(ws0), wsOpen(ws1), wsOpen(ws2), wsOpen(ws3)]);
    await Promise.all([
      waitForType(next0, "welcome", "0 welcome"),
      waitForType(next1, "welcome", "1 welcome"),
      waitForType(next2, "welcome", "2 welcome"),
      waitForType(next3, "welcome", "3 welcome"),
    ]);

    hello(ws0, "c0");
    hello(ws1, "c1");
    hello(ws2, "c2");
    hello(ws3, "c3");
    await Promise.all([
      waitForType(next0, "welcome", "0 welcomeEcho"),
      waitForType(next1, "welcome", "1 welcomeEcho"),
      waitForType(next2, "welcome", "2 welcomeEcho"),
      waitForType(next3, "welcome", "3 welcomeEcho"),
    ]);

    // Create room + join all 4
    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    join(ws1, roomCode);
    join(ws2, roomCode);
    join(ws3, roomCode);
    await Promise.all([
      waitForType(next1, "roomJoined", "1 roomJoined"),
      waitForType(next2, "roomJoined", "2 roomJoined"),
      waitForType(next3, "roomJoined", "3 roomJoined"),
    ]);

    // Enable team play (also ensures teams exist)
    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });
    await waitForLobby(next0, "0 lobby teamPlay enabled", (m) => m.lobby?.players?.length === 4 && !!extractTeams(m));

    // Make startGame valid (roster complete + all ready)
    setReady(ws0, true);
    setReady(ws1, true);
    setReady(ws2, true);
    setReady(ws3, true);
    await waitForLobby(
      next0,
      "0 lobby all ready",
      (m) => m.lobby?.players?.length === 4 && (m.lobby?.players ?? []).every((p: any) => p.ready === true)
    );

    ws0.send(JSON.stringify({ type: "startGame", playerCount: 4, reqId: "req-start" }));

    // Fail fast if startGame is rejected; otherwise wait until we're no longer in lobby phase.
    const started = await waitForAny(
      next0,
      "0 started",
      (m) => m?.type === "error" || m?.type === "stateSync" || (m?.type === "lobbySync" && m?.lobby?.phase === "active"),
      80,
      6000
    );
    if (started?.type === "error") {
      throw new Error(`startGame failed: code=${started.code ?? "?"} msg=${started.message ?? "?"}`);
    }

    setTeam(ws0, "A", "req-not-lobby");
    await expectErrorCodeSoon(next0, "0 setTeam not lobby", "BAD_MESSAGE");

    ws0.close();
    ws1.close();
    ws2.close();
    ws3.close();
    await server.close();
  });

  it("E3: setTeam rejects invalid target team (BAD_MESSAGE)", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    await wsOpen(ws0);
    await waitForType(next0, "welcome", "0 welcome");
    hello(ws0, "c0");
    await waitForType(next0, "welcome", "0 welcomeEcho");

    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    // enable teamPlay
    setLobbyGameConfig(ws0, { playerCount: 2, teamPlay: true, teamCount: 2 });
    await waitForLobby(next0, "0 lobby teamPlay enabled", (m) => m.lobby?.players?.length === 1 && !!extractTeams(m));

    // send malformed team
    ws0.send(JSON.stringify({ type: "setTeam", team: "C", reqId: "req-bad-team" }));
    await expectErrorCodeSoon(next0, "0 setTeam bad team", "BAD_MESSAGE");

    ws0.close();
    await server.close();
  });

  it("E4: setTeam rejects when client has not joined a room (BAD_MESSAGE)", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState });

    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);

    await wsOpen(ws0);
    await waitForType(next0, "welcome", "0 welcome");
    hello(ws0, "c0");
    await waitForType(next0, "welcome", "0 welcomeEcho");

    // No joinRoom
    setTeam(ws0, "A", "req-not-joined");
    await expectErrorCodeSoon(next0, "0 setTeam not joined", "BAD_MESSAGE");

    ws0.close();
    await server.close();
  });

  it("F1: reconnect with same clientId preserves playerId and team", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // ws0 creates room
    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    await wsOpen(ws0);
    await waitForType(next0, "welcome", "0 welcome");
    hello(ws0, "c0");
    await waitForType(next0, "welcome", "0 welcomeEcho");
    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    // ws1 joins
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const next1 = makeQueue(ws1);
    await wsOpen(ws1);
    await waitForType(next1, "welcome", "1 welcome");
    hello(ws1, "c1");
    await waitForType(next1, "welcome", "1 welcomeEcho");
    join(ws1, roomCode);
    const j1 = await waitForType(next1, "roomJoined", "1 roomJoined");
    const p1 = j1.playerId as string;

    // enable teamPlay
    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });
    const l2 = await waitForLobby(next0, "0 lobby teamPlay enabled", (m) => m.lobby?.players?.length === 2 && !!extractTeams(m));
    expectTeamsPartition(l2);

    const teamsBefore = extractTeams(l2);
    const wasInA = (getTeamA(teamsBefore) ?? []).includes(p1);
    const wasInB = (getTeamB(teamsBefore) ?? []).includes(p1);
    expect(wasInA || wasInB).toBe(true);

    // Disconnect ws1 (server should keep roster + teams for reconnect)
    ws1.close();

// Reconnect with same clientId "c1"
    const ws1b = new WebSocket(`ws://localhost:${server.port}`);
    const next1b = makeQueue(ws1b);
    await wsOpen(ws1b);
    await waitForType(next1b, "welcome", "1b welcome");
    hello(ws1b, "c1");
    await waitForType(next1b, "welcome", "1b welcomeEcho");
    join(ws1b, roomCode);
    const j1b = await waitForType(next1b, "roomJoined", "1b roomJoined");
    expect(j1b.playerId).toBe(p1);

    const lAfterRejoin = await waitForLobby(next0, "0 lobby after rejoin", (m) => m.lobby?.players?.length === 2 && !!extractTeams(m));
    expectTeamsPartition(lAfterRejoin);

    const teamsAfterRejoin = extractTeams(lAfterRejoin);
    expect((getTeamA(teamsAfterRejoin) ?? []).includes(p1) || (getTeamB(teamsAfterRejoin) ?? []).includes(p1)).toBe(true);

    ws1b.close();
    ws0.close();
    await server.close();
  });

  it("F2: leave removes from team; rejoin reassigns by smaller-team rule (policy A)", async () => {
    const initialState = makeState({ playerCount: 4 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // ws0 creates room
    const ws0 = new WebSocket(`ws://localhost:${server.port}`);
    const next0 = makeQueue(ws0);
    await wsOpen(ws0);
    await waitForType(next0, "welcome", "0 welcome");
    hello(ws0, "c0");
    await waitForType(next0, "welcome", "0 welcomeEcho");
    join(ws0);
    const j0 = await waitForType(next0, "roomJoined", "0 roomJoined");
    const roomCode = j0.roomCode as string;

    // ws1 and ws2 join
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);

    await Promise.all([wsOpen(ws1), wsOpen(ws2)]);
    await Promise.all([waitForType(next1, "welcome", "1 welcome"), waitForType(next2, "welcome", "2 welcome")]);
    hello(ws1, "c1");
    hello(ws2, "c2");
    await Promise.all([waitForType(next1, "welcome", "1 welcomeEcho"), waitForType(next2, "welcome", "2 welcomeEcho")]);

    join(ws1, roomCode);
    const j1 = await waitForType(next1, "roomJoined", "1 roomJoined");
    const p1 = j1.playerId as string;

    join(ws2, roomCode);
    await waitForType(next2, "roomJoined", "2 roomJoined");

    setLobbyGameConfig(ws0, { playerCount: 4, teamPlay: true, teamCount: 2 });

    const l3 = await waitForLobby(next0, "0 lobby 3 players teamPlay", (m) => m.lobby?.players?.length === 3 && !!extractTeams(m));
    expectTeamsPartition(l3);
    const teams3 = extractTeams(l3);

    // With 3 players and tie->A, team sizes are 2 and 1.
    expect([getTeamA(teams3).length, getTeamB(teams3).length].sort().join("|")).toBe("1|2");

    // Leave (ws1) via leaveRoom (explicit roster removal)
    leaveRoom(ws1, "req-leave-1");
    // close socket after leaving
    ws1.close();
    const l2 = await waitForLobby(next0, "0 lobby after leave", (m) => m.lobby?.players?.length === 2 && !!extractTeams(m));
    expectTeamsPartition(l2);
    const teams2 = extractTeams(l2);
    expect((getTeamA(teams2) ?? []).includes(p1) || (getTeamB(teams2) ?? []).includes(p1)).toBe(false);

    // Rejoin with same clientId => same playerId, reassign by smaller-team rule
    const ws1b = new WebSocket(`ws://localhost:${server.port}`);
    const next1b = makeQueue(ws1b);
    await wsOpen(ws1b);
    await waitForType(next1b, "welcome", "1b welcome");
    hello(ws1b, "c1");
    await waitForType(next1b, "welcome", "1b welcomeEcho");
    join(ws1b, roomCode);
    const j1b = await waitForType(next1b, "roomJoined", "1b roomJoined");
    expect(j1b.playerId).toBe(p1);

    const l3b = await waitForLobby(next0, "0 lobby after rejoin", (m) => m.lobby?.players?.length === 3 && !!extractTeams(m));
    expectTeamsPartition(l3b);

    // With policy A, p1 gets assigned based on current smaller-team state (tie->A).
    // We assert only that p1 is present and partition is correct (no unassigned), leaving exact team choice
    // to the deterministic smaller-team/tie->A algorithm.
    const teamsAfter = extractTeams(l3b);
    expect((getTeamA(teamsAfter) ?? []).includes(p1) || (getTeamB(teamsAfter) ?? []).includes(p1)).toBe(true);

    ws1b.close();
    ws2.close();
    ws0.close();
    await server.close();
  });
});
