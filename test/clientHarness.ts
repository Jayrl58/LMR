import WebSocket from "ws";
import type {
  ClientMessage,
  ServerMessage,
  ServerRoomJoined,
  ServerLegalMoves,
  ServerMoveResult,
  ServerStateSync,
  ServerLobbySync,
} from "../src/server/protocol";
import { deserializeState, legalMoves } from "../src/engine";

/**
 * Minimal WS client harness:
 * hello -> joinRoom(create) -> setReady -> startGame(1) -> roll -> legalMoves -> move
 *
 * Notes:
 * - reqId is used on every request.
 * - We print every incoming message.
 * - We "await response by reqId" for the steps where the UI would normally block.
 */

let seq = 0;
function rid(label: string) {
  seq += 1;
  return `${label}-${seq}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Pending = { resolve: (m: ServerMessage) => void; reject: (e: any) => void; timer: any };
const pendingByReqId = new Map<string, Pending>();

function waitForReq(ws: WebSocket, reqId: string, timeoutMs = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingByReqId.delete(reqId);
      reject(new Error(`Timeout waiting for reqId=${reqId}`));
    }, timeoutMs);

    pendingByReqId.set(reqId, { resolve, reject, timer });
  });
}

function send(ws: WebSocket, msg: ClientMessage) {
  ws.send(JSON.stringify(msg));
}

function logMsg(m: any) {
  const t = m?.type ?? "???";
  const r = m?.reqId ? ` reqId=${m.reqId}` : "";
  console.log(`[in] ${t}${r}`, JSON.stringify(m));
}

async function main() {
  const port = Number(process.env.PORT ?? "8787");
  const url = `ws://localhost:${port}`;

  const ws = new WebSocket(url);

  ws.on("message", (data) => {
    const raw = typeof data === "string" ? data : data.toString("utf8");
    const msg = JSON.parse(raw) as ServerMessage;

    logMsg(msg);

    const reqId = (msg as any).reqId as string | undefined;
    if (reqId && pendingByReqId.has(reqId)) {
      const p = pendingByReqId.get(reqId)!;
      clearTimeout(p.timer);
      pendingByReqId.delete(reqId);
      p.resolve(msg);
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });

  // 0) (unsolicited) welcome arrives on connect
  // Give it a moment to print.
  await sleep(50);

  // 1) hello
  const helloReq = rid("hello");
  send(ws, { type: "hello", clientId: "c0", reqId: helloReq });
  await waitForReq(ws, helloReq);

  // 2) joinRoom (create)
  const joinReq = rid("join");
  send(ws, { type: "joinRoom", reqId: joinReq });
  const joinRes = (await waitForReq(ws, joinReq)) as ServerRoomJoined;
  const roomCode = joinRes.roomCode;
  const playerId = joinRes.playerId;

  // lobbySync will arrive (broadcast). We don't have to await it by reqId,
  // but for UI-loop we *can*, because server includes reqId on lobbySync from joinRoom.
  // Wait briefly so it prints.
  await sleep(50);

  // 3) setReady true
  const readyReq = rid("ready");
  send(ws, { type: "setReady", ready: true, reqId: readyReq });
  await waitForReq(ws, readyReq); // lobbySync with same reqId

  // 4) startGame (1 player local room)
  const startReq = rid("start");
  send(ws, { type: "startGame", playerCount: 1, reqId: startReq });

  // Two messages may carry this reqId: lobbySync then stateSync.
  // We await both by waiting twice.
  const s1 = await waitForReq(ws, startReq);
  if (s1.type !== "lobbySync") {
    throw new Error(`Expected lobbySync for startGame first; got ${s1.type}`);
  }
  const s2 = await waitForReq(ws, startReq);
  if (s2.type !== "stateSync") {
    throw new Error(`Expected stateSync for startGame second; got ${s2.type}`);
  }
  const stateSync = s2 as ServerStateSync;

  // 5) roll
  // We need an actorId; in Option C, the server turn.nextActorId is authoritative.
  const nextActorId = stateSync.turn.nextActorId;

  // Pick a die that likely yields a move; 1 is usually safe in your tests.
  const die = 1;

  const rollReq = rid("roll");
  send(ws, { type: "roll", actorId: nextActorId, die, reqId: rollReq });

  // Roll returns legalMoves (preferred) or stateSync (if none).
  const rollRes = await waitForReq(ws, rollReq);
  if (rollRes.type === "stateSync") {
    console.log("[harness] roll produced no legal moves; stopping.");
    ws.close();
    return;
  }
  if (rollRes.type !== "legalMoves") {
    throw new Error(`Expected legalMoves; got ${rollRes.type}`);
  }
  const lm = rollRes as ServerLegalMoves;

  // 6) choose a move
  const move = lm.moves[0];
  if (!move) throw new Error("No moves returned.");

  // 7) send move
  const moveReq = rid("move");
  send(ws, {
    type: "move",
    actorId: nextActorId,
    dice: [die],
    move,
    reqId: moveReq,
  });

  const moveRes = await waitForReq(ws, moveReq);
  if (moveRes.type !== "moveResult") {
    throw new Error(`Expected moveResult; got ${moveRes.type}`);
  }
  const mr = moveRes as ServerMoveResult;

  console.log("[harness] moveResult.ok =", mr.response.ok);
  console.log("[harness] done. roomCode =", roomCode, "playerId =", playerId);

  ws.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
