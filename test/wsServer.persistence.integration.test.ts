import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

describe("wsServer persistence integration (rooms)", () => {
  it("persists a room session and restores it on restart when joining same roomCode", async () => {
    const persistenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "lmr-rooms-"));
    const initialState = makeState({ playerCount: 2 }) as any;

    // Server 1
    const server1 = startWsServer({
      port: 0,
      initialState,
      broadcast: false,
      persistenceDir,
    });

    const ws1 = new WebSocket(`ws://localhost:${server1.port}`);
    const next1 = makeQueue(ws1);

    await new Promise<void>((resolve, reject) => {
      ws1.on("open", () => resolve());
      ws1.on("error", (e) => reject(e));
    });

    // welcome
    JSON.parse(await nextWithTimeout(next1, "welcome#1"));

    // hello as p0
    ws1.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    JSON.parse(await nextWithTimeout(next1, "welcomeEcho#1"));

    // joinRoom create
    ws1.send(JSON.stringify({ type: "joinRoom" }));
    const j1 = JSON.parse(await nextWithTimeout(next1, "roomJoined#1"));
    expect(j1.type).toBe("roomJoined");
    const roomCode = j1.roomCode as string;

    // lobbySync
    JSON.parse(await nextWithTimeout(next1, "lobbySync#1"));

    // ready + startGame with playerCount=1 (single client in this test)
    ws1.send(JSON.stringify({ type: "setReady", ready: true }));
    JSON.parse(await nextWithTimeout(next1, "lobbySync after ready#1"));

    ws1.send(JSON.stringify({ type: "startGame", playerCount: 1 }));
    JSON.parse(await nextWithTimeout(next1, "lobbySync after start#1"));
    const s1 = JSON.parse(await nextWithTimeout(next1, "stateSync#1"));
    expect(s1.type).toBe("stateSync");
    const savedHash1 = s1.stateHash as string;

    ws1.close();
    await server1.close();

    // Server 2 (restart)
    const server2 = startWsServer({
      port: 0,
      initialState,
      broadcast: false,
      persistenceDir,
    });

    const ws2 = new WebSocket(`ws://localhost:${server2.port}`);
    const next2 = makeQueue(ws2);

    await new Promise<void>((resolve, reject) => {
      ws2.on("open", () => resolve());
      ws2.on("error", (e) => reject(e));
    });

    // welcome
    JSON.parse(await nextWithTimeout(next2, "welcome#2"));

    // hello as p0 again
    ws2.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    JSON.parse(await nextWithTimeout(next2, "welcomeEcho#2"));

    // join same roomCode
    ws2.send(JSON.stringify({ type: "joinRoom", roomCode }));
    const j2 = JSON.parse(await nextWithTimeout(next2, "roomJoined#2"));
    expect(j2.type).toBe("roomJoined");
    expect(j2.roomCode).toBe(roomCode);

    // lobbySync (should show active)
    const l2 = JSON.parse(await nextWithTimeout(next2, "lobbySync#2"));
    expect(l2.type).toBe("lobbySync");
    expect(l2.lobby.phase).toBe("active");

    // stateSync (should match)
    const s2 = JSON.parse(await nextWithTimeout(next2, "stateSync#2"));
    expect(s2.type).toBe("stateSync");
    expect(s2.roomCode).toBe(roomCode);
    expect(s2.stateHash).toBe(savedHash1);

    ws2.close();
    await server2.close();
  });
});
