import type { GameState } from "../types";
import type {
  ClientMessage,
  ServerMessage,
  TurnInfo,
  LobbyPlayer,
  LobbyState,
  LobbyGameConfig,
  GameStartOptions,
} from "./protocol";
import { handleClientMessage, type SessionState } from "./handleMessage";
import { serializeState, hashState } from "../engine";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, type WebSocket } from "ws";

export type WsServerOptions = {
  port: number;
  initialState: GameState;
  persistenceDir?: string;
  broadcast?: boolean;
};

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getReqId(x: unknown): string | undefined {
  if (!x || typeof x !== "object") return undefined;
  const v = (x as any).reqId;
  return typeof v === "string" ? v : undefined;
}

function withReqId<T extends ServerMessage>(msg: T, reqId?: string): T {
  if (!reqId) return msg;
  return { ...(msg as any), reqId } as T;
}

function isPlainObject(x: unknown): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * Accept numeric dice values as either numbers or numeric strings.
 */
function coerceDie(n: any): number | null {
  if (Number.isInteger(n)) return n;
  if (typeof n === "string" && n.trim() !== "") {
    const parsed = Number(n);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function isValidDie(n: any): boolean {
  const v = coerceDie(n);
  return v !== null && v >= 1 && v <= 6;
}

function isValidDiceArray(xs: any): boolean {
  return Array.isArray(xs) && xs.length > 0 && xs.every(isValidDie);
}

function isClientMessage(x: any): x is ClientMessage {
  if (!x || typeof x !== "object") return false;
  if (typeof x.type !== "string") return false;

  switch (x.type) {
    case "hello":
      // keep permissive; clientId optional
      return !("clientId" in x) || typeof x.clientId === "string";

    case "joinRoom":
      return (
        (!("roomCode" in x) || typeof x.roomCode === "string") &&
        (!("claimPlayerId" in x) || typeof x.claimPlayerId === "string")
      );

    case "setReady":
      return typeof x.ready === "boolean";

    case "startGame":
      return typeof x.playerCount === "number" && (!("options" in x) || isPlainObject(x.options));

    case "roll": {
      if (typeof x.actorId !== "string") return false;
      const hasDice = "dice" in x;
      const hasDie = "die" in x;
      if (hasDice) return isValidDiceArray((x as any).dice);
      if (hasDie) return isValidDie((x as any).die);
      return false;
    }

    case "getLegalMoves": {
      if (typeof x.actorId !== "string") return false;
      const hasDice = "dice" in x;
      const hasDie = "die" in x;
      if (hasDice) return isValidDiceArray((x as any).dice);
      if (hasDie) return isValidDie((x as any).die);
      return false;
    }

    case "move":
      return typeof x.actorId === "string" && isValidDiceArray((x as any).dice) && "move" in x;

    default:
      return false;
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  ws.send(JSON.stringify(msg));
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function roomFilePath(persistenceDir: string, roomCode: string) {
  return path.join(persistenceDir, `${roomCode}.json`);
}

type PersistedRoom = {
  session: SessionState;
  clientToPlayer: Record<string, string>;
  readyByPlayer: Record<string, boolean>;
  expectedPlayerCount?: number;
  phase: "lobby" | "active";
  gameConfig?: LobbyGameConfig;
};

type Room = {
  code: string;
  session: SessionState;
  clientToPlayer: Map<string, string>;
  readyByPlayer: Map<string, boolean>;
  expectedPlayerCount?: number;
  phase: "lobby" | "active";
  gameConfig?: LobbyGameConfig;
  sockets: Set<WebSocket>;
};

function loadRoomFromDisk(persistenceDir: string, roomCode: string): Room | null {
  try {
    const fp = roomFilePath(persistenceDir, roomCode);
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = JSON.parse(raw) as PersistedRoom;

    if (!parsed || !parsed.session || !(parsed.session as any).game || !(parsed.session as any).turn)
      return null;

    const room: Room = {
      code: roomCode,
      session: parsed.session,
      clientToPlayer: new Map(Object.entries(parsed.clientToPlayer ?? {})),
      readyByPlayer: new Map(Object.entries(parsed.readyByPlayer ?? {}).map(([k, v]) => [k, !!v])),
      expectedPlayerCount: parsed.expectedPlayerCount,
      phase: parsed.phase,
      gameConfig: parsed.gameConfig,
      sockets: new Set(),
    };

    return room;
  } catch {
    return null;
  }
}

function persist(room: Room) {
  if (!roomPersistenceDir) return;
  try {
    const data: PersistedRoom = {
      session: room.session,
      clientToPlayer: Object.fromEntries(room.clientToPlayer.entries()),
      readyByPlayer: Object.fromEntries(room.readyByPlayer.entries()),
      expectedPlayerCount: room.expectedPlayerCount,
      phase: room.phase,
      gameConfig: room.gameConfig,
    };
    fs.mkdirSync(roomPersistenceDir, { recursive: true });
    fs.writeFileSync(roomFilePath(roomPersistenceDir, room.code), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // ignore
  }
}

let roomPersistenceDir: string | undefined;

function computeLobby(room: Room): LobbyState {
  const players: LobbyPlayer[] = [];
  for (const [clientId, playerId] of room.clientToPlayer.entries()) {
    const seat = Number(playerId.replace(/^p/, ""));
    players.push({
      playerId,
      clientId,
      seat: Number.isFinite(seat) ? seat : players.length,
      ready: room.readyByPlayer.get(playerId) ?? false,
    });
  }
  players.sort((a, b) => a.seat - b.seat);

  const lobby: LobbyState = {
    roomCode: room.code,
    phase: room.phase,
    expectedPlayerCount: room.expectedPlayerCount,
    players,
    gameConfig: room.gameConfig,
  };
  return lobby;
}

function computeTurn(room: Room): TurnInfo {
  return room.session.turn;
}

function emitLobbySync(room: Room, reqId?: string) {
  const lobby = computeLobby(room);
  for (const ws of room.sockets) {
    send(ws, withReqId({ type: "lobbySync", lobby } as any, reqId));
  }
}

function emitStateSync(room: Room, reqId?: string) {
  const turn = computeTurn(room);
  const msg = withReqId(
    {
      type: "stateSync",
      roomCode: room.code,
      state: serializeState(room.session.game),
      stateHash: hashState(room.session.game),
      turn,
    } as any,
    reqId
  );
  for (const ws of room.sockets) send(ws, msg);
}

function makeError(code: any, message: string, reqId?: string): ServerMessage {
  return withReqId({ type: "error", code, message } as any, reqId);
}

function ensureRoom(roomCode: string, initialState: GameState): Room {
  const session: SessionState = {
    game: initialState,
    turn: {
      nextActorId: "p0",
      awaitingDice: true,
      dicePolicy: "external",
    } as any,
  };

  return {
    code: roomCode,
    session,
    clientToPlayer: new Map(),
    readyByPlayer: new Map(),
    expectedPlayerCount: undefined,
    phase: "lobby",
    gameConfig: undefined,
    sockets: new Set(),
  };
}

function pickNextAvailablePlayerId(room: Room): string {
  const used = new Set(room.clientToPlayer.values());
  for (let i = 0; i < 16; i++) {
    const pid = `p${i}`;
    if (!used.has(pid)) return pid;
  }
  return `p${Math.floor(Math.random() * 10000)}`;
}

export function startWsServer(opts: WsServerOptions) {
  const wss = new WebSocketServer({ port: opts.port });
  roomPersistenceDir = opts.persistenceDir;

  const rooms = new Map<string, Room>();
  const wsClientId = new Map<WebSocket, string>();
  const wsRoom = new Map<WebSocket, string>();

  if (roomPersistenceDir) {
    try {
      fs.mkdirSync(roomPersistenceDir, { recursive: true });
      const files = fs.readdirSync(roomPersistenceDir);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        const roomCode = f.replace(/\.json$/, "");
        const room = loadRoomFromDisk(roomPersistenceDir, roomCode);
        if (room) rooms.set(roomCode, room);
      }
    } catch {
      // ignore
    }
  }

  wss.on("connection", (ws) => {
    // welcome-on-connect (tests expect this)
    send(ws, { type: "welcome", serverVersion: "lmr-ws-0.1.4", clientId: "anon" } as any);

    ws.on("message", (data) => {
      const raw = typeof data === "string" ? data : data.toString("utf8");
      const parsed = safeParseJson(raw);

      if (!parsed) {
        send(ws, makeError("BAD_MESSAGE", "Invalid JSON."));
        return;
      }

      const reqId = getReqId(parsed);

      // ---- LENIENT HELLO HANDSHAKE ----
      // Do NOT run the strict validator before hello; respond if it looks like a hello.
      if (parsed && typeof parsed === "object" && (parsed as any).type === "hello") {
        const cid = typeof (parsed as any).clientId === "string" ? (parsed as any).clientId : "anon";
        wsClientId.set(ws, cid);
        send(
          ws,
          withReqId({ type: "welcome", serverVersion: "lmr-ws-0.1.4", clientId: cid } as any, reqId)
        );
        return;
      }

      // ---- STRICT VALIDATION FOR ALL OTHER MESSAGES ----
      if (!isClientMessage(parsed)) {
        const t = (parsed as any)?.type;
        const suffix = ` type=${String(t)} typeof=${typeof t}`;
        send(ws, makeError("BAD_MESSAGE", `Invalid client message shape.${suffix}`, reqId));
        return;
      }

      const msg = parsed as ClientMessage;

      const cid = wsClientId.get(ws) ?? "anon";

      if (msg.type === "joinRoom") {
        const roomCode =
          typeof (msg as any).roomCode === "string" && (msg as any).roomCode.trim()
            ? String((msg as any).roomCode).trim()
            : makeRoomCode();

        let room = rooms.get(roomCode);
        if (!room) {
          room = ensureRoom(roomCode, opts.initialState);
          rooms.set(roomCode, room);
          persist(room);
        }

        room.sockets.add(ws);
        wsRoom.set(ws, roomCode);

        const claim =
          typeof (msg as any).claimPlayerId === "string" ? String((msg as any).claimPlayerId) : undefined;

        // Preserve existing mapping for this clientId (reconnect behavior)
        const existing = room.clientToPlayer.get(cid);
        const playerId = existing ?? claim ?? pickNextAvailablePlayerId(room);

        room.clientToPlayer.set(cid, playerId);
        if (!room.readyByPlayer.has(playerId)) room.readyByPlayer.set(playerId, false);

        persist(room);

        send(ws, withReqId({ type: "roomJoined", roomCode: roomCode, actorId: playerId } as any, reqId));
        emitLobbySync(room, reqId);

        // IMPORTANT: If the room is already active (including after persistence restore),
        // immediately deliver stateSync so joiners can render current game state.
        if (room.phase === "active") {
          emitStateSync(room, reqId);
        }

        return;
      }

      const roomCode = wsRoom.get(ws);
      if (!roomCode) {
        send(ws, makeError("BAD_MESSAGE", "Not in a room. Send joinRoom first.", reqId));
        return;
      }

      const room = rooms.get(roomCode) ?? ensureRoom(roomCode, opts.initialState);
      rooms.set(roomCode, room);
      room.sockets.add(ws);

      const playerId = room.clientToPlayer.get(cid) ?? pickNextAvailablePlayerId(room);

      if (msg.type === "setReady") {
        room.readyByPlayer.set(playerId, !!(msg as any).ready);
        persist(room);
        emitLobbySync(room, reqId);
        return;
      }

      if (msg.type === "startGame") {
        const pc = Number((msg as any).playerCount);
        const options = (msg as any).options as GameStartOptions | undefined;

        room.expectedPlayerCount = pc;
        room.gameConfig = { playerCount: pc, options: options ?? {} };
        room.phase = "active";

        (room.session.game as any).config = {
          playerCount: pc,
          options: options ?? {},
        };

        room.session.turn = {
          nextActorId: "p0",
          awaitingDice: true,
          dicePolicy: "external",
        } as any;

        persist(room);
        emitLobbySync(room, reqId);
        emitStateSync(room, reqId);
        return;
      }

      const result = handleClientMessage(roomCode, room.session, msg as any);

      room.session = result.nextState;
      persist(room);

      send(ws, result.serverMessage);

      // Broadcast moveResult to other room members (default behavior)
      if ((result.serverMessage as any)?.type === "moveResult") {
        for (const other of room.sockets) {
          if (other !== ws) send(other, result.serverMessage);
        }
      }

      // Optional extra broadcast stateSync (legacy flag); keep as-is
      if (opts.broadcast) {
        emitStateSync(room, (msg as any).reqId);
      }
    });

    ws.on("close", () => {
      const roomCode = wsRoom.get(ws);

      wsClientId.delete(ws);
      wsRoom.delete(ws);

      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      room.sockets.delete(ws);
      persist(room);
    });

    ws.on("error", () => {
      // ignore
    });
  });

  return {
    port: (wss.address() as any).port as number,
    close: async () => {
      for (const room of rooms.values()) {
        for (const ws of room.sockets) {
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
