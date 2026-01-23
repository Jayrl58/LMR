import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { makeState } from "./helpers";

function makeMessageQueue(ws: WebSocket) {
  const queue: string[] = [];
  let resolver: ((v: string) => void) | null = null;

  ws.on("message", (data) => {
    const msg = typeof data === "string" ? data : data.toString("utf8");
    if (resolver) {
      const r = resolver;
      resolver = null;
      r(msg);
    } else {
      queue.push(msg);
    }
  });

  return async () => {
    if (queue.length > 0) return queue.shift()!;
    return await new Promise<string>((resolve) => (resolver = resolve));
  };
}

async function readUntil(
  nextMsg: () => Promise<string>,
  predicate: (m: any) => boolean,
  max = 20
) {
  for (let i = 0; i < max; i++) {
    const m = JSON.parse(await nextMsg());
    if (predicate(m)) return m;
  }
  throw new Error("Did not receive expected message within limit.");
}

describe("wsServer invalid message handling", () => {
  it("returns BAD_MESSAGE for non-conforming client messages", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState, broadcast: false });

    const ws = new WebSocket(`ws://localhost:${server.port}`);
    const nextMsg = makeMessageQueue(ws);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (e) => reject(e));
    });

    // Send invalid immediately; server may also send welcome or other messages first.
    ws.send(JSON.stringify({ type: "nope" }));

    const err = await readUntil(nextMsg, (m) => m.type === "error");
    expect(err.type).toBe("error");
    expect(err.code).toBe("BAD_MESSAGE");

    ws.close();
    await server.close();
  });
});
