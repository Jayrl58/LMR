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

describe("wsServer integration", () => {
  it("joinRoom -> ready -> startGame -> roll -> legalMoves -> move -> moveResult", async () => {
    const pid = P("p0");
    let initialState = makeState({ playerCount: 2 });

    // Put a peg somewhere safe so die=1 yields an advance
    const len = getTrackLen(initialState);
    const homeEntry = getHomeEntryTrackIndex(initialState, pid);
    let start = mod(homeEntry + 8, len);
    if (start === homeEntry) start = mod(homeEntry + 12, len);
    initialState = setPeg(initialState, pid, 0, makeTrack(start));

    const server = startWsServer({
      port: 0,
      initialState: initialState as any,
      broadcast: false,
    });

    const ws = new WebSocket(`ws://localhost:${server.port}`);
    const nextMsg = makeQueue(ws);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (e) => reject(e));
    });

    // 1) welcome on connect
    const m0 = JSON.parse(await nextWithTimeout(nextMsg, "welcome"));
    expect(m0.type).toBe("welcome");

    // 2) hello (use clientId "p0" so playerId matches engine player)
    ws.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    const m1 = JSON.parse(await nextWithTimeout(nextMsg, "welcomeEcho"));
    expect(m1.type).toBe("welcome");

    // 3) joinRoom (create)
    ws.send(JSON.stringify({ type: "joinRoom" }));
    const m2 = JSON.parse(await nextWithTimeout(nextMsg, "roomJoined"));
    expect(m2.type).toBe("roomJoined");
    const roomCode = m2.roomCode as string;

    // 4) lobbySync
    const m3 = JSON.parse(await nextWithTimeout(nextMsg, "lobbySync"));
    expect(m3.type).toBe("lobbySync");
    expect(m3.lobby.roomCode).toBe(roomCode);
    expect(m3.lobby.phase).toBe("lobby");

    // NOTE: this test uses playerCount=2 but only one websocket client.
    // So we start with playerCount=1 for this integration test.
    ws.send(JSON.stringify({ type: "setReady", ready: true }));
    const m4 = JSON.parse(await nextWithTimeout(nextMsg, "lobbySync after ready"));
    expect(m4.type).toBe("lobbySync");

    ws.send(JSON.stringify({ type: "startGame", playerCount: 1 }));
    const m5 = JSON.parse(await nextWithTimeout(nextMsg, "lobbySync after start"));
    expect(m5.type).toBe("lobbySync");
    expect(m5.lobby.phase).toBe("active");

    const m6 = JSON.parse(await nextWithTimeout(nextMsg, "stateSync after start"));
    expect(m6.type).toBe("stateSync");
    expect(m6.roomCode).toBe(roomCode);

    // Now gameplay
    const die = 1;

    ws.send(JSON.stringify({ type: "roll", actorId: "p0", die }));
    const r0 = JSON.parse(await nextWithTimeout(nextMsg, "after roll"));
    // server may emit legalMoves immediately or after getLegalMoves depending on handler;
    // accept either and proceed.
    if (r0.type === "legalMoves") {
      // ok
    } else if (r0.type === "error") {
      throw new Error(`Unexpected error after roll: ${JSON.stringify(r0)}`);
    }

    // request legal moves explicitly to be safe
    ws.send(JSON.stringify({ type: "getLegalMoves", actorId: "p0", die }));
    const lm = JSON.parse(await nextWithTimeout(nextMsg, "legalMoves"));
    expect(lm.type).toBe("legalMoves");

    // Choose a legal move using engine helper against our known initialState
    const moves = legalMoves(initialState as any, pid, [die] as const);
    const move = moves.find((m: any) => m.kind === "advance" && m.pegIndex === 0);
    expect(move).toBeTruthy();

    ws.send(JSON.stringify({ type: "move", actorId: "p0", dice: [die], move }));
    const mr = JSON.parse(await nextWithTimeout(nextMsg, "moveResult"));
    expect(mr.type).toBe("moveResult");
    expect(typeof mr.response?.ok).toBe("boolean");

    ws.close();
    await server.close();
  });
});
