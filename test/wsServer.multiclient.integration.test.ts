import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { legalMoves } from "../src/engine";
import { makeState, P, setPeg, makeTrack } from "./helpers";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";


function parseStateSyncState(msg: any): any {
  const raw = msg?.state;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}


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


async function nextStateSyncWithPhase(
  queue: ReturnType<typeof makeQueue>,
  label: string,
  msTotal: number,
  wantPhase: "lobby" | "active" | "ended"
) {
  const deadline = Date.now() + msTotal;
  while (Date.now() < deadline) {
    const budget = deadline - Date.now();
    const waitMs = Math.min(1500, Math.max(500, budget)); // allow catching 1s timer ticks, but don't stall past deadline
    try {
      const raw = await nextWithTimeout(queue, label, waitMs);
      const msg = JSON.parse(raw);
      if (msg.type !== "stateSync") continue;
      const st = parseStateSyncState(msg);
      if (st?.phase === wantPhase) return msg;
    } catch (e: any) {
      // If this particular wait timed out, keep looping until overall deadline.
      // nextWithTimeout throws an Error with "Timeout waiting for message" in the message.
      const s = String(e?.message ?? e);
      if (s.includes("Timeout waiting for message")) continue;
      throw e;
    }
  }
  throw new Error(`Timeout waiting for message (stateSync phase=${wantPhase} ${label}) after ${msTotal}ms`);
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


  it("contract: unanimous rematch resets to PRE_GAME (phase=lobby) and increments gameSeq", async () => {
    // Force an initial state that is already ended, so we test endgame→rematch transition directly.
    let initialState: any = makeState({ playerCount: 2 }) as any;
    initialState.phase = "ended";
    initialState.outcome = initialState.outcome ?? { kind: "individual", winnerPlayerId: "p0" };

    const server = startWsServer({ port: 0, initialState });

    const ws1 = new WebSocket(`ws://localhost:${server.port}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}`);
    const next1 = makeQueue(ws1);
    const next2 = makeQueue(ws2);

    await Promise.all([wsOpen(ws1), wsOpen(ws2)]);

    await waitForType(next1, "welcome", "ws1 welcome");
    await waitForType(next2, "welcome", "ws2 welcome");

    ws1.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    ws2.send(JSON.stringify({ type: "hello", clientId: "p1" }));
    await waitForType(next1, "welcome", "ws1 welcomeEcho");
    await waitForType(next2, "welcome", "ws2 welcomeEcho");

    // ws1 creates room
    ws1.send(JSON.stringify({ type: "joinRoom" }));
    const j1 = await waitForType(next1, "roomJoined", "ws1 roomJoined");
    const roomCode = j1.roomCode as string;

    // ws2 joins same room
    ws2.send(JSON.stringify({ type: "joinRoom", roomCode }));
    await waitForType(next2, "roomJoined", "ws2 roomJoined");

    await waitForType(next1, "lobbySync", "ws1 lobbySync initial");
    await waitForType(next2, "lobbySync", "ws2 lobbySync initial");

    // Ready both, then startGame=2
    ws1.send(JSON.stringify({ type: "setReady", ready: true }));
    ws2.send(JSON.stringify({ type: "setReady", ready: true }));
    await waitForType(next1, "lobbySync", "ws1 lobbySync after ready");
    await waitForType(next2, "lobbySync", "ws2 lobbySync after ready");

    ws1.send(JSON.stringify({ type: "startGame", playerCount: 2 }));
    await waitForLobbyPhase(next1, "active", "ws1 after start");
    await waitForLobbyPhase(next2, "active", "ws2 after start");

    const s1 = await waitForType(next1, "stateSync", "ws1 stateSync ended");
    const s2 = await waitForType(next2, "stateSync", "ws2 stateSync ended");

    const st1 = parseStateSyncState(s1);
    const st2 = parseStateSyncState(s2);
    expect(st1.phase).toBe("ended");
    expect(st2.phase).toBe("ended");

    // New contract for Rematch rules: stateSync carries a monotonically increasing gameSeq.
    expect(typeof (s1 as any).gameSeq).toBe("number");
    const gameSeq0 = (s1 as any).gameSeq as number;

    // Client → server: consent to rematch (unanimous).
    ws1.send(JSON.stringify({ type: "rematchConsent", consent: true }));
    ws2.send(JSON.stringify({ type: "rematchConsent", consent: true }));

    // Contract: no special "rematchApproved" message (model B). Instead we should observe state reset via stateSync.
    const r1 = await nextStateSyncWithPhase(next1, "ws1 after rematch", 2500, "lobby");
    const r2 = await nextStateSyncWithPhase(next2, "ws2 after rematch", 2500, "lobby");
    expect(r1.type).toBe("stateSync");
    expect(r2.type).toBe("stateSync");

    const rst1 = parseStateSyncState(r1);
    const rst2 = parseStateSyncState(r2);

    expect(rst1.phase).toBe("lobby");
    expect(rst2.phase).toBe("lobby");

    expect((r1 as any).gameSeq).toBe(gameSeq0 + 1);
    expect((r2 as any).gameSeq).toBe(gameSeq0 + 1);

    ws1.close();
    ws2.close();
    await server.close();
  });

});
