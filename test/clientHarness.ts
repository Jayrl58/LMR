/* eslint-disable no-console */
/**
 * 2P WS client harness for detecting turn-owner desync.
 *
 * Goal:
 * - Create room with client c0 (p0)
 * - Join room with client c1 (p1)
 * - Ready both
 * - Start game with playerCount=2
 * - Drive a small deterministic sequence (roll -> move) and validate:
 *     session turn.nextActorId === engine turn.currentPlayerId
 *   and surface any NOT_YOUR_TURN/errors with surrounding state.
 *
 * Run (PowerShell):
 *   $env:PORT=8787
 *   npx tsx test/clientHarness.ts
 *
 * Env:
 *   PORT=8787 (default)
 */

import WebSocket from "ws";

type AnyMsg = any;
type WaitPred = (m: AnyMsg) => boolean;

class MsgQueue {
  private q: AnyMsg[] = [];
  private waiters: Array<{
    pred: WaitPred;
    resolve: (m: AnyMsg) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  push(m: AnyMsg) {
    // Try satisfy waiters first
    for (let i = 0; i < this.waiters.length; i++) {
      const w = this.waiters[i];
      if (w.pred(m)) {
        clearTimeout(w.timer);
        this.waiters.splice(i, 1);
        w.resolve(m);
        return;
      }
    }
    this.q.push(m);
  }

  wait(pred: WaitPred, label: string, ms = 5000): Promise<AnyMsg> {
    // Drain queued first
    for (let i = 0; i < this.q.length; i++) {
      const m = this.q[i];
      if (pred(m)) {
        this.q.splice(i, 1);
        return Promise.resolve(m);
      }
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout waiting for message (${label}) after ${ms}ms`)),
        ms,
      );
      this.waiters.push({ pred, resolve, reject, timer });
    });
  }
}

function wsUrl(port: number) {
  return `ws://127.0.0.1:${port}`;
}

function send(ws: WebSocket, msg: AnyMsg) {
  ws.send(JSON.stringify(msg));
}

function rid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function safeParseJson(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getEngineTurnOwnerFromStateSync(m: AnyMsg): string | null {
  const stateStr = typeof m?.state === "string" ? m.state : null;
  if (!stateStr) return null;
  const st = safeParseJson(stateStr);
  const id = st?.turn?.currentPlayerId;
  return typeof id === "string" ? id : null;
}

function getSessionTurnOwnerFromStateSync(m: AnyMsg): string | null {
  const id = m?.turn?.nextActorId;
  return typeof id === "string" ? id : null;
}

function describeTurn(m: AnyMsg) {
  const eng = getEngineTurnOwnerFromStateSync(m);
  const sess = getSessionTurnOwnerFromStateSync(m);
  return {
    engine: eng,
    session: sess,
    awaitingDice: m?.turn?.awaitingDice,
    bankedDice: m?.turn?.bankedDice,
    dicePolicy: m?.turn?.dicePolicy,
  };
}

async function connectClient(port: number, clientId: string) {
  const ws = new WebSocket(wsUrl(port));
  const q = new MsgQueue();

  ws.on("message", (data) => {
    const txt = String(data);
    const m = safeParseJson(txt) ?? { _raw: txt };
    // Inbound logging (critical for diagnosing missing moveResult/reqId)
    console.log(`[${clientId} in]`, m);
    q.push(m);
  });

  ws.on("error", (e) => {
    console.error(`[${clientId} ws.error]`, e);
  });

  await q.wait((m) => m?.type === "welcome", `${clientId} welcome (server)`);

  const helloReq = rid("hello");
  send(ws, { type: "hello", clientId, reqId: helloReq });
  await q.wait((m) => m?.type === "welcome" && m?.reqId === helloReq, `${clientId} welcome (req)`);

  return { ws, q, clientId };
}

async function joinCreate(ws: WebSocket, q: MsgQueue) {
  const joinReq = rid("join");
  send(ws, { type: "joinRoom", reqId: joinReq });
  const joined = await q.wait((m) => m?.type === "roomJoined" && m?.reqId === joinReq, "roomJoined(create)");
  await q.wait((m) => m?.type === "lobbySync" && m?.reqId === joinReq, "lobbySync(create)");
  return { roomCode: joined.roomCode as string, playerId: joined.playerId as string };
}

async function joinExisting(ws: WebSocket, q: MsgQueue, roomCode: string) {
  const joinReq = rid("join");
  send(ws, { type: "joinRoom", roomCode, reqId: joinReq });
  const joined = await q.wait((m) => m?.type === "roomJoined" && m?.reqId === joinReq, "roomJoined(join)");
  await q.wait((m) => m?.type === "lobbySync" && m?.reqId === joinReq, "lobbySync(join)");
  return { playerId: joined.playerId as string };
}

async function setReady(ws: WebSocket, q: MsgQueue, ready: boolean) {
  const reqId = rid("ready");
  send(ws, { type: "setReady", ready, reqId });
  await q.wait((m) => m?.type === "lobbySync" && m?.reqId === reqId, "lobbySync(ready)");
}

async function startGame(ws: WebSocket, q: MsgQueue, playerCount: number) {
  const reqId = rid("start");
  send(ws, { type: "startGame", playerCount, reqId });
  const s1 = await q.wait((m) => m?.reqId === reqId, "startGame first");
  if (s1?.type !== "lobbySync") throw new Error(`Expected lobbySync for startGame first; got ${s1?.type}`);
  const s2 = await q.wait((m) => m?.reqId === reqId, "startGame second");
  if (s2?.type !== "stateSync") throw new Error(`Expected stateSync for startGame second; got ${s2?.type}`);
  return s2;
}

async function waitAnyStateSync(q0: MsgQueue, q1: MsgQueue, label: string) {
  return Promise.race([
    q0.wait((m) => m?.type === "stateSync", `${label} (c0)`),
    q1.wait((m) => m?.type === "stateSync", `${label} (c1)`),
  ]);
}

async function waitLegalMoves(q: MsgQueue, reqId: string) {
  return q.wait((m) => m?.type === "legalMoves" && m?.reqId === reqId, `legalMoves(${reqId})`);
}

function assertTurnAligned(stateSync: AnyMsg, context: string) {
  const t = describeTurn(stateSync);
  if (t.engine && t.session && t.engine !== t.session) {
    console.error(`[DESYNC] ${context}: engine=${t.engine} session=${t.session}`);
    console.error(`[DESYNC] stateSync.turn=`, stateSync.turn);
    throw new Error(`TURN_OWNER_DESYNC ${context}`);
  }
}

async function main() {
  const port = Number(process.env.PORT ?? "8787");

  const c0 = await connectClient(port, "c0");
  const c1 = await connectClient(port, "c1");

  const created = await joinCreate(c0.ws, c0.q);
  const joined = await joinExisting(c1.ws, c1.q, created.roomCode);

  console.log(`[harness] roomCode=${created.roomCode} p0=${created.playerId} p1=${joined.playerId}`);

  await setReady(c0.ws, c0.q, true);
  await setReady(c1.ws, c1.q, true);

  // Only c0 starts the game
  const starterState = await startGame(c0.ws, c0.q, 2);
  assertTurnAligned(starterState, "after startGame (starter)");

  // Consume a stateSync on c1 if it arrives
  try {
    const otherState = await c1.q.wait((m) => m?.type === "stateSync", "after startGame (other)", 1500);
    assertTurnAligned(otherState, "after startGame (other)");
  } catch {
    // ok
  }

  let lastState: AnyMsg = starterState;
  const pidToClient: Record<string, { ws: WebSocket; q: MsgQueue; clientId: string }> = {
    [created.playerId]: c0,
    [joined.playerId]: c1,
  };

  for (let step = 0; step < 12; step++) {
    // keep state fresh if broadcasts exist
    try {
      const s = await waitAnyStateSync(c0.q, c1.q, `stateSync step=${step}`);
      lastState = s;
    } catch {
      // ignore
    }

    if (lastState?.type !== "stateSync") continue;

    assertTurnAligned(lastState, `loop step=${step}`);

    const turnOwner =
      getSessionTurnOwnerFromStateSync(lastState) ?? getEngineTurnOwnerFromStateSync(lastState);
    if (!turnOwner) throw new Error("Could not determine turn owner from stateSync");

    const client = pidToClient[turnOwner];
    if (!client) throw new Error(`No client mapped for turn owner ${turnOwner}`);

    // Roll a 1
    const rollReq = rid("roll");
    send(client.ws, { type: "roll", actorId: turnOwner, die: 1, reqId: rollReq });

    const lm = await waitLegalMoves(client.q, rollReq);
    const moves = Array.isArray(lm?.moves) ? lm.moves : [];
    if (moves.length === 0) {
      console.log(`[harness] no legal moves for ${turnOwner} at step=${step}; stopping.`);
      break;
    }

    const move = moves[0];
    const dice = Array.isArray(lm?.dice) ? lm.dice : [1];
    const moveReq = rid("move");
    // Protocol expects: type=move, actorId, dice array, and full move object.
    send(client.ws, { type: "move", actorId: turnOwner, dice, move, reqId: moveReq });

    // Wait for moveResult OR error OR stateSync (some servers may not emit moveResult)
    const mr = await client.q.wait(
      (m) =>
        (m?.type === "moveResult" && m?.reqId === moveReq) ||
        (m?.type === "error") ||
        (m?.type === "stateSync"),
      `moveResult/maybe stateSync(${moveReq})`,
      6000,
    );

    if (mr?.type === "error") {
      console.error(`[harness] error after move.`, mr);
      throw new Error(`SERVER_ERROR ${(mr?.code ?? mr?.error?.code ?? "").toString()}`);
    }

    if (mr?.type === "moveResult") {
      const ok = !!mr?.response?.ok;
      console.log(`[harness] step=${step} actor=${turnOwner} roll=1 move=${move.id} ok=${ok}`);
      if (!ok) {
        const errCode = mr?.response?.error?.code ?? "(unknown)";
        console.error(`[harness] moveResult not ok. code=${errCode}`);
        break;
      }
    } else if (mr?.type === "stateSync") {
      // If server only stateSyncs, treat as success path and re-check alignment
      lastState = mr;
      assertTurnAligned(lastState, `post-move stateSync step=${step}`);
      console.log(`[harness] step=${step} actor=${turnOwner} roll=1 move=${move.id} ok=(stateSync)`);
    }
  }

  console.log("[harness] done.");
  c0.ws.close();
  c1.ws.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
