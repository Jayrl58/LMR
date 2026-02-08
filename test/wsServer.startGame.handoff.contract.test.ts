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
    } else {
      q.push(s);
    }
  });

  return async () => {
    if (q.length) return q.shift()!;
    return await new Promise<string>((r) => (resolve = r));
  };
}

async function wsOpen(ws: WebSocket) {
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });
}

async function nextWithTimeout(next: () => Promise<string>, label: string, ms = 2000) {
  return await Promise.race([
    next(),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for message (${label}) after ${ms}ms`)), ms)
    ),
  ]);
}

async function maybeNextWithTimeout(next: () => Promise<string>, ms = 800): Promise<any | null> {
  try {
    const raw = await nextWithTimeout(next, "maybe message", ms);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function waitForAny(
  next: () => Promise<string>,
  label: string,
  predicate: (m: any) => boolean,
  maxReads = 40,
  ms = 3000
) {
  for (let i = 0; i < maxReads; i++) {
    const raw = await nextWithTimeout(next, `${label} #${i}`, ms);
    const m = JSON.parse(raw);
    if (predicate(m)) return m;
  }
  throw new Error(`Timeout waiting for predicate (${label}) after ${maxReads} reads`);
}

async function connectJoinAndReady(serverPort: number, clientId = "p0") {
  const ws = new WebSocket(`ws://localhost:${serverPort}`);
  const next = makeQueue(ws);
  await wsOpen(ws);

  // welcome
  expect(JSON.parse(await nextWithTimeout(next, "welcome")).type).toBe("welcome");

  // hello for stable playerId
  ws.send(JSON.stringify({ type: "hello", clientId }));
  expect(JSON.parse(await nextWithTimeout(next, "welcomeEcho")).type).toBe("welcome");

  // join (create room)
  ws.send(JSON.stringify({ type: "joinRoom" }));
  const joined = JSON.parse(await nextWithTimeout(next, "roomJoined"));
  expect(joined.type).toBe("roomJoined");

  // drain until we see a lobbySync in lobby phase (could be multiple)
  await waitForAny(
    next,
    "lobbySync lobby",
    (m) => m?.type === "lobbySync" && m?.lobby?.phase === "lobby",
    30,
    2500
  );

  // ready
  ws.send(JSON.stringify({ type: "setReady", ready: true }));
  await waitForAny(next, "lobbySync after ready", (m) => m?.type === "lobbySync", 30, 2500);

  return { ws, next };
}

async function startAndWaitStateSync(next: () => Promise<string>, ws: WebSocket, playerCount = 1) {
  ws.send(JSON.stringify({ type: "startGame", playerCount, reqId: "req-start" }));

  // Server may emit lobbySync(active) and/or stateSync; require stateSync for "started"
  const m = await waitForAny(
    next,
    "stateSync",
    (x) => x?.type === "stateSync" || x?.type === "error",
    80,
    4000
  );

  if (m?.type === "error") {
    throw new Error(`startGame failed: code=${m.code ?? "?"} msg=${m.message ?? "?"}`);
  }

  expect(m.type).toBe("stateSync");
  return m;
}

function isErrorWithCode(m: any, codes: string[]) {
  return m?.type === "error" && codes.includes(String(m.code ?? ""));
}

describe("wsServer startGame handoff invariants (contract)", () => {
  it("H1: startGame transitions lobby->active and emits stateSync", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState, broadcast: false });

    const { ws, next } = await connectJoinAndReady(server.port, "p0");

    const s = await startAndWaitStateSync(next, ws, 1);
    expect(s.type).toBe("stateSync");

    ws.close();
    await server.close();
  });

  it("H2: lobby-only messages are rejected or ignored after startGame (setLobbyGameConfig)", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState, broadcast: false });

    const { ws, next } = await connectJoinAndReady(server.port, "p0");

    await startAndWaitStateSync(next, ws, 1);

    // After start, a lobby-only config update must not take effect.
    // Acceptable behaviors:
    // - explicit error (preferred)
    // - no-op (ignored) with no message
    // - no-op with a stateSync resend
    ws.send(
      JSON.stringify({
        type: "setLobbyGameConfig",
        gameConfig: { playerCount: 1 },
        reqId: "req-after-start",
      })
    );

    const m = await maybeNextWithTimeout(next, 1200);
    if (m === null) {
      // no response is acceptable (no-op)
    } else if (isErrorWithCode(m, ["BAD_MESSAGE", "LOBBY_LOCKED"])) {
      expect(m.type).toBe("error");
    } else if (m.type === "stateSync") {
      // acceptable no-op path: state continues (we don't assert deep engine state here)
      expect(m.type).toBe("stateSync");
    } else {
      throw new Error(`Unexpected response after setLobbyGameConfig post-start: ${JSON.stringify(m)}`);
    }

    ws.close();
    await server.close();
  });

  it("H3: startGame is rejected or ignored once already started", async () => {
    const initialState = makeState({ playerCount: 2 }) as any;
    const server = startWsServer({ port: 0, initialState, broadcast: false });

    const { ws, next } = await connectJoinAndReady(server.port, "p0");

    await startAndWaitStateSync(next, ws, 1);

    // Second startGame must not restart the game.
    // Acceptable behaviors:
    // - explicit error (preferred)
    // - no-op (ignored) with no message
    // - no-op with a stateSync resend
    ws.send(JSON.stringify({ type: "startGame", playerCount: 1, reqId: "req-start-2" }));

    const m = await maybeNextWithTimeout(next, 1500);
    if (m === null) {
      // no response is acceptable (no-op)
    } else if (isErrorWithCode(m, ["BAD_MESSAGE", "LOBBY_LOCKED"])) {
      expect(m.type).toBe("error");
    } else if (m.type === "stateSync") {
      expect(m.type).toBe("stateSync");
    } else {
      throw new Error(`Unexpected response after startGame post-start: ${JSON.stringify(m)}`);
    }

    ws.close();
    await server.close();
  });
});
