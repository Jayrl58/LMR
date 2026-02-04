import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { startWsServer } from "../src/server/wsServer";
import { makeState, P, setPeg, makeTrack } from "./helpers";
import { getHomeEntryTrackIndex } from "../src/engine/homeMapping";

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

function getTrackLen(state: unknown): number {
  const s: any = state as any;
  return s?.board?.trackLength ?? s?.board?.trackLen ?? s?.trackLength ?? s?.trackLen ?? 56;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

describe("wsServer killRoll lifecycle integration", () => {
  it("capture with killRoll=true banks exactly +1 extra die; bank cashout roll must be exactly 1 die", async () => {
    const p0 = P("p0");
    const p1 = P("p1");

    // --- Create a guaranteed capture-on-landing using the same shape as killOnLanding.scenario ---
    let initialState = makeState({ playerCount: 2 });

    const len = getTrackLen(initialState);
    const homeEntry = getHomeEntryTrackIndex(initialState, p0);

    // Choose indices away from homeEntry (avoid home entry/forced rules)
    let start = mod(homeEntry + 5, len);
    let target = mod(start + 2, len);

    if (start === homeEntry || target === homeEntry) {
      start = mod(homeEntry + 9, len);
      target = mod(start + 2, len);
    }

    initialState = setPeg(initialState, p0, 0, makeTrack(start));
    initialState = setPeg(initialState, p1, 0, makeTrack(target));

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

    // 0) welcome-on-connect
    const w0 = safeJsonParse(await nextWithTimeout(nextMsg, "welcome#0"));
    expect(w0.type).toBe("welcome");

    // 1) hello -> welcome
    ws.send(JSON.stringify({ type: "hello", clientId: "p0" }));
    const w1 = safeJsonParse(await nextWithTimeout(nextMsg, "welcome#1"));
    expect(w1.type).toBe("welcome");

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

    // ready + startGame with killRoll enabled
    ws.send(JSON.stringify({ type: "setReady", ready: true }));
    const m4 = safeJsonParse(await nextWithTimeout(nextMsg, "lobbySync after ready"));
    expect(m4.type).toBe("lobbySync");

    ws.send(JSON.stringify({ type: "startGame", playerCount: 2, options: { killRoll: true } }));
    const m5 = safeJsonParse(await nextWithTimeout(nextMsg, "lobbySync after start"));
    expect(m5.type).toBe("lobbySync");
    expect(m5.lobby.phase).toBe("active");

    const m6 = safeJsonParse(await nextWithTimeout(nextMsg, "stateSync after start"));
    expect(m6.type).toBe("stateSync");
    expect(m6.roomCode).toBe(roomCode);

    // ---- Roll a single die [2] and perform the capture ----
    ws.send(JSON.stringify({ type: "roll", actorId: "p0", dice: [2] }));

    const lm0 = safeJsonParse(await nextWithTimeout(nextMsg, "legalMoves after roll([2])"));
    if (lm0.type === "error") {
      throw new Error(`Unexpected error after roll([2]): ${JSON.stringify(lm0)}`);
    }
    expect(lm0.type).toBe("legalMoves");
    expect(lm0.actorId).toBe("p0");
    expect(Array.isArray(lm0.dice)).toBe(true);
    expect(lm0.dice).toEqual([2]);

    const moves = Array.isArray(lm0.moves) ? (lm0.moves as any[]) : [];
    expect(moves.length).toBeGreaterThan(0);

    const killMove =
      moves.find(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.kind === "advance" || String(m.kind ?? "") === "advance") &&
          (m.pegIndex === 0 || m.pegId === 0 || m.peg === 0) &&
          (m.steps === 2 || m.distance === 2)
      ) ??
      null;

    expect(killMove).toBeTruthy();

    ws.send(JSON.stringify({ type: "move", actorId: "p0", dice: [2], move: killMove }));
    const mr0 = safeJsonParse(await nextWithTimeout(nextMsg, "moveResult after capture"));
    expect(mr0.type).toBe("moveResult");

    if (mr0.response?.ok !== true) {
      throw new Error(`Move failed; moveResult payload:\n${JSON.stringify(mr0, null, 2)}`);
    }

    // Bank rule: roller keeps the turn to cash out banked extra die
    expect(mr0.response?.turn?.nextActorId).toBe("p0");
    expect(mr0.response?.turn?.awaitingDice).toBe(true);

    // ---- Prove the banked extra die exists via roll enforcement ----
    // If exactly 1 banked die exists, rolling 2 dice must be rejected with BAD_ROLL.
    ws.send(JSON.stringify({ type: "roll", actorId: "p0", dice: [1, 1] }));
    const err0 = safeJsonParse(await nextWithTimeout(nextMsg, "BAD_ROLL when banked=1"));
    expect(err0.type).toBe("error");
    expect(err0.code).toBe("BAD_ROLL");
    expect(String(err0.message)).toContain("roll exactly");

    // Correct cashout roll with exactly 1 die should be allowed (may legalMoves or stateSync if no moves)
    ws.send(JSON.stringify({ type: "roll", actorId: "p0", dice: [3] }));
    const afterCashout = safeJsonParse(await nextWithTimeout(nextMsg, "cashout roll([3])"));
    expect(["legalMoves", "stateSync"].includes(afterCashout.type)).toBe(true);
    if (afterCashout.type === "error") {
      throw new Error(`Unexpected error after cashout roll([3]): ${JSON.stringify(afterCashout)}`);
    }

    try {
      ws.close();
    } catch {}
    try {
      await server.close();
    } catch {}
  });
});
