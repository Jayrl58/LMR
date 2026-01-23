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

describe("wsServer identity", () => {
  it("reconnect to same room returns same playerId", async () => {
    const persistenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "lmr-id-"));
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

    ws1.send(JSON.stringify({ type: "hello", clientId: "clientA" }));
    JSON.parse(await nextWithTimeout(next1, "welcomeEcho#1"));

    ws1.send(JSON.stringify({ type: "joinRoom" }));
    const joined1 = JSON.parse(await nextWithTimeout(next1, "roomJoined#1"));
    expect(joined1.type).toBe("roomJoined");

    const roomCode = joined1.roomCode as string;
    const playerId1 = joined1.playerId as string;

    // stateSync
    JSON.parse(await nextWithTimeout(next1, "stateSync#1"));

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

    ws2.send(JSON.stringify({ type: "hello", clientId: "clientA" }));
    JSON.parse(await nextWithTimeout(next2, "welcomeEcho#2"));

    ws2.send(JSON.stringify({ type: "joinRoom", roomCode }));
    const joined2 = JSON.parse(await nextWithTimeout(next2, "roomJoined#2"));
    expect(joined2.type).toBe("roomJoined");
    expect(joined2.roomCode).toBe(roomCode);
    expect(joined2.playerId).toBe(playerId1);

    // stateSync
    JSON.parse(await nextWithTimeout(next2, "stateSync#2"));

    ws2.close();
    await server2.close();
  });
});
