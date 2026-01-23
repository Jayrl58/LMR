import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { legalMoves } from "../src/engine";
import { makeState, P, setPeg, makeTrack } from "./helpers";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";

function getTrackLen(state: unknown): number {
  const s: any = state as any;
  return s?.board?.trackLength ?? s?.board?.trackLen ?? s?.trackLength ?? s?.trackLen ?? 56;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function makeQueue(ws: WebSocket) {
  const q: string[] = [];
  let resolve: ((s: string) => void) | null = null;

  ws.on("message", (d) => {
    const s = typeof d === "string" ? d : d.toString("utf8");
    if (resolve) {
      const r = resolve;
      resolve = null;
      r(s);
    } else {
      q.push(s);
    }
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

async function waitForType(next: () => Promise<string>, type: string, label: string, max = 20) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (${type}) #${i}`));
    if (m?.type === type) return m;
  }
  throw new Error(`Did not receive ${type} within ${max} messages (${label})`);
}

async function waitForLobbyPhase(
  next: () => Promise<string>,
  phase: "lobby" | "active",
  label: string,
  max = 30
) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextWithTimeout(next, `${label} (lobbySync) #${i}`));
    if (m?.type === "lobbySync" && m?.lobby?.phase === phase) return m;
  }
  throw new Error(`Did not receive lobbySync phase=${phase} within ${max} messages (${label})`);
}

describe("wsServer multi-client integration", () => {
  it("two clients join same room, both ready, startGame=2, both receive stateSync and broadcast moveResult", async () => {
    const pid0 = P("p0");
    let initialState = makeState({ playerCount: 2 });

    // Ensure p0 has an easy legal move for die=1
    const len = getTrackLen(initialState);
    const homeEntry = getHomeEntryTrackIndex(initialState, pid0);
    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);
    initialState = setPeg(initialState, pid0, 0, makeTrack(start));

    // IMPORTANT: no broadcast option set; server should default to room-scoped broadcast
    const server = startWsServer({
      port: 0,
      initialState: initialState as any,
    });

    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);

    await Promise.all([wsOpen(ws1), wsOpen(ws2)]);

    // welcome on connect
    expect((await waitForType(next1, "welcome", "ws1")).type).toBe("welcome");
    expect((await waitForType(next2, "welcome", "ws2")).type).toBe("welcome");

    // hello identities
    ws1.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    ws2.send(JSON.stringify({ type: "hello", clientId: "p1" }));

    expect((await waitForType(next1, "welcome", "ws1 welcomeEcho")).type).toBe("welcome");
    expect((await waitForType(next2, "welcome", "ws2 welcomeEcho")).type).toBe("welcome");

    // ws1 creates room
    ws1.send(JSON.stringify({ type: "joinRoom" }));
    const j1 = await waitForType(next1, "roomJoined", "ws1 roomJoined");
    const roomCode = j1.roomCode as string;

    // ws2 joins same room
    ws2.send(JSON.stringify({ type: "joinRoom", roomCode }));
    const j2 = await waitForType(next2, "roomJoined", "ws2 roomJoined");
    expect(j2.roomCode).toBe(roomCode);

    // Each should see lobbySync at least once
    await waitForType(next1, "lobbySync", "ws1 lobbySync initial");
    await waitForType(next2, "lobbySync", "ws2 lobbySync initial");

    // Ready both
    ws1.send(JSON.stringify({ type: "setReady", ready: true }));
    ws2.send(JSON.stringify({ type: "setReady", ready: true }));

    await waitForType(next1, "lobbySync", "ws1 lobbySync after ready");
    await waitForType(next2, "lobbySync", "ws2 lobbySync after ready");

    // Start game (playerCount=2)
    ws1.send(JSON.stringify({ type: "startGame", playerCount: 2 }));

    const l1Active = await waitForLobbyPhase(next1, "active", "ws1 after start");
    expect(l1Active.lobby.phase).toBe("active");

    const l2Active = await waitForLobbyPhase(next2, "active", "ws2 after start");
    expect(l2Active.lobby.phase).toBe("active");

    const s1 = await waitForType(next1, "stateSync", "ws1 stateSync");
    expect(s1.roomCode).toBe(roomCode);

    const s2 = await waitForType(next2, "stateSync", "ws2 stateSync");
    expect(s2.roomCode).toBe(roomCode);

    // Gameplay: p0 roll + getLegalMoves + move
    const die = 1;

    ws1.send(JSON.stringify({ type: "roll", actorId: "p0", die }));
    ws1.send(JSON.stringify({ type: "getLegalMoves", actorId: "p0", die }));

    // Wait for legalMoves on ws1 (ignore other message types)
    let lm1: any = null;
    for (let i = 0; i < 20; i++) {
      const m = JSON.parse(await nextWithTimeout(next1, `ws1 wait legalMoves #${i}`));
      if (m.type === "legalMoves") {
        lm1 = m;
        break;
      }
    }
    expect(lm1?.type).toBe("legalMoves");

    const moves = legalMoves(initialState as any, pid0, [die] as const);
    const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
    expect(move).toBeTruthy();

    ws1.send(JSON.stringify({ type: "move", actorId: "p0", dice: [die], move }));

    // BOTH should receive moveResult (default broadcast)
    const mr1 = await waitForType(next1, "moveResult", "ws1 moveResult");
    expect(typeof mr1.response?.ok).toBe("boolean");

    const mr2 = await waitForType(next2, "moveResult", "ws2 moveResult");
    expect(typeof mr2.response?.ok).toBe("boolean");

    ws1.close();
    ws2.close();
    await server.close();
  });
});
