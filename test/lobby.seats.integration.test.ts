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

async function waitForType(next: () => Promise<string>, type: string, label: string, max = 30) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (${type}) #${i}`));
    if (m?.type === type) return m;
  }
  throw new Error(`Did not receive ${type} within ${max} messages (${label})`);
}

async function waitForLobbyPlayerCount(
  next: () => Promise<string>,
  count: number,
  label: string,
  max = 60
) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (lobbySync) #${i}`));
    if (m?.type === "lobbySync" && Array.isArray(m?.lobby?.players) && m.lobby.players.length === count) {
      return m;
    }
  }
  throw new Error(`Did not receive lobbySync with players.length=${count} within ${max} messages (${label})`);
}

function seatsFromLobbySync(msg: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of msg.lobby.players ?? []) out[p.playerId] = p.seat;
  return out;
}

describe("lobby seat assignment (deterministic)", () => {
  it("assigns seats deterministically by sorted playerId", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // Intentionally pick IDs that sort differently than join order
    const wsB = new WebSocket(`ws://localhost:${server.port}`);
    const wsA = new WebSocket(`ws://localhost:${server.port}`);
    const nextB = makeQueue(wsB);
    const nextA = makeQueue(wsA);

    await Promise.all([wsOpen(wsB), wsOpen(wsA)]);

    await waitForType(nextB, "welcome", "B welcome");
    await waitForType(nextA, "welcome", "A welcome");

    wsB.send(JSON.stringify({ type: "hello", clientId: "p1" }));
    wsA.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    await waitForType(nextB, "welcome", "B welcomeEcho");
    await waitForType(nextA, "welcome", "A welcomeEcho");

    // Create room with B, then A joins
    wsB.send(JSON.stringify({ type: "joinRoom" }));
    const jB = await waitForType(nextB, "roomJoined", "B roomJoined");
    const roomCode = jB.roomCode as string;

    wsA.send(JSON.stringify({ type: "joinRoom", roomCode }));
    await waitForType(nextA, "roomJoined", "A roomJoined");

    // Wait until a lobbySync arrives that includes BOTH players
    const lB = await waitForLobbyPlayerCount(nextB, 2, "B lobbySync w/2 players");

    const seats = seatsFromLobbySync(lB);

    // Sorted playerId: p0 then p1 => seats 0,1
    expect(seats["p0"]).toBe(0);
    expect(seats["p1"]).toBe(1);

    wsA.close();
    wsB.close();
    await server.close();
  });

  it("reconnect with same clientId keeps same playerId and seat (given same set of players)", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState });

    // First connect p0 and create room
    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const next1 = makeQueue(ws1);
    await wsOpen(ws1);
    await waitForType(next1, "welcome", "ws1 welcome");
    ws1.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    await waitForType(next1, "welcome", "ws1 welcomeEcho");

    ws1.send(JSON.stringify({ type: "joinRoom" }));
    const j1 = await waitForType(next1, "roomJoined", "ws1 roomJoined");
    const roomCode = j1.roomCode as string;

    // Wait for lobbySync(1 player) and assert seat 0
    const l1 = await waitForLobbyPlayerCount(next1, 1, "ws1 lobbySync 1p");
    expect(seatsFromLobbySync(l1)["p0"]).toBe(0);

    // Close p0
    ws1.close();

    // Reconnect as p0
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next2 = makeQueue(ws2);
    await wsOpen(ws2);
    await waitForType(next2, "welcome", "ws2 welcome");
    ws2.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    await waitForType(next2, "welcome", "ws2 welcomeEcho");

    ws2.send(JSON.stringify({ type: "joinRoom", roomCode }));
    await waitForType(next2, "roomJoined", "ws2 roomJoined");

    const l2 = await waitForLobbyPlayerCount(next2, 1, "ws2 lobbySync 1p");
    expect(seatsFromLobbySync(l2)["p0"]).toBe(0);

    ws2.close();
    await server.close();
  });
});
