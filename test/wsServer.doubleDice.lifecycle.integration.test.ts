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

async function nextWithTimeout(next: () => Promise<string>, label: string, ms = 2000) {
  return await Promise.race([
    next(),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for message (${label}) after ${ms}ms`)), ms)
    ),
  ]);
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${String(e)}\nRAW:\n${s}`);
  }
}

function getAwaitingDiceFromMoveResult(mr: any): boolean | undefined {
  const v =
    mr?.response?.result?.turn?.awaitingDice ??
    mr?.response?.turn?.awaitingDice ??
    mr?.turn?.awaitingDice;
  return typeof v === "boolean" ? v : undefined;
}

describe("wsServer doubleDice lifecycle integration", () => {
  it("after resolving one die from [6,1], remaining die must still be resolvable (awaitingDice stays false)", async () => {
    const initialState = makeState({ playerCount: 2 });

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

    // 1) hello -> welcome
    ws.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    const m1 = safeJsonParse(await nextWithTimeout(nextMsg, "welcome"));
    expect(m1.type).toBe("welcome");

    // 2) joinRoom (create)
    ws.send(JSON.stringify({ type: "joinRoom" }));
    const m2 = safeJsonParse(await nextWithTimeout(nextMsg, "roomJoined"));
    expect(m2.type).toBe("roomJoined");
    const roomCode = m2.roomCode as string;

    // 3) lobbySync
    const m3 = safeJsonParse(await nextWithTimeout(nextMsg, "lobbySync"));
    expect(m3.type).toBe("lobbySync");
    expect(m3.lobby.roomCode).toBe(roomCode);
    expect(m3.lobby.phase).toBe("lobby");

    // ready + startGame with doubleDice enabled
    ws.send(JSON.stringify({ type: "setReady", ready: true }));
    const m4 = safeJsonParse(await nextWithTimeout(nextMsg, "lobbySync after ready"));
    expect(m4.type).toBe("lobbySync");

    // Like wsServer.integration.test.ts, start with playerCount=1 (single ws client)
    ws.send(JSON.stringify({ type: "startGame", playerCount: 1, options: { doubleDice: true } }));
    const m5 = safeJsonParse(await nextWithTimeout(nextMsg, "lobbySync after start"));
    expect(m5.type).toBe("lobbySync");
    expect(m5.lobby.phase).toBe("active");

    const m6 = safeJsonParse(await nextWithTimeout(nextMsg, "stateSync after start"));
    expect(m6.type).toBe("stateSync");
    expect(m6.roomCode).toBe(roomCode);

    // ---- Double dice interaction: request legal moves for dice [6,1] ----
    ws.send(JSON.stringify({ type: "getLegalMoves", actorId: "p0", dice: [6, 1] }));

    const lm0 = safeJsonParse(await nextWithTimeout(nextMsg, "legalMoves for [6,1]"));
    if (lm0.type === "error") {
      throw new Error(`Unexpected error on getLegalMoves([6,1]): ${JSON.stringify(lm0)}`);
    }
    expect(lm0.type).toBe("legalMoves");
    expect(lm0.actorId).toBe("p0");
    expect(Array.isArray(lm0.dice)).toBe(true);
    expect(lm0.dice.length).toBe(2);
    expect(lm0.dice[0]).toBe(6);
    expect(lm0.dice[1]).toBe(1);

    // choose an enter-on-six move (same heuristic as console)
    const enterOnSix = (lm0.moves as any[]).find((m) => String(m?.id ?? "").startsWith("enter:p0:"))?.id;
    expect(typeof enterOnSix).toBe("string");

    // resolve first die by applying the move using dice [6,1]
    ws.send(JSON.stringify({ type: "move", actorId: "p0", dice: [6, 1], move: enterOnSix }));
    const mr = safeJsonParse(await nextWithTimeout(nextMsg, "moveResult after enter"));
    expect(mr.type).toBe("moveResult");
    expect(mr.response?.ok).toBe(true);

    // After applying one die, we expect awaitingDice to remain false (still have [1] pending)
    const awaiting = getAwaitingDiceFromMoveResult(mr);
    expect(awaiting).toBe(false);

    // Now request remaining die moves with dice [1]
    ws.send(JSON.stringify({ type: "getLegalMoves", actorId: "p0", dice: [1] }));
    const lm1 = safeJsonParse(await nextWithTimeout(nextMsg, "legalMoves for remaining die=1"));
    if (lm1.type === "error") {
      throw new Error(`Unexpected error on getLegalMoves([1]) after first resolution: ${JSON.stringify(lm1)}`);
    }
    expect(lm1.type).toBe("legalMoves");
    expect(lm1.actorId).toBe("p0");
    expect(Array.isArray(lm1.dice)).toBe(true);
    expect(lm1.dice.length).toBe(1);
    expect(lm1.dice[0]).toBe(1);

    try {
      ws.close();
    } catch {}
    try {
      await server.close();
    } catch {}
  });
});
