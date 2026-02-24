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


const ENDGAME_RESULTS_SECONDS = 180;



// NOTE: Some environments enable room persistence to disk. The core server should not crash
// if persistence is disabled or the helper is omitted. This is a no-op unless a persistence
// dir is provided and a concrete implementation is added later.
function persistRoomIfEnabled(_room: any, _roomPersistenceDir?: string) {
  // Intentionally a no-op for now.
  void _room;
  void _roomPersistenceDir;
}

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


    case "leaveRoom":
      return !("reqId" in x) || typeof x.reqId === "string";

    case "setReady":
      return typeof x.ready === "boolean";

    case "setLobbyGameConfig":
      return isPlainObject(x.gameConfig) && typeof (x.gameConfig as any).playerCount === "number";


    case "setTeam":
      return (
        (x.team === "A" || x.team === "B") &&
        (!("reqId" in x) || typeof x.reqId === "string")
      );
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

    
    case "rematchConsent":
      return typeof x.consent === "boolean";
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
function hashStringToUint32(s: string): number {
  // Simple FNV-1a 32-bit hash (deterministic)
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeXorShift32(seed: number) {
  let x = seed >>> 0;
  if (x === 0) x = 0x6d2b79f5; // non-zero default seed
  return function nextFloat(): number {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // Convert to [0,1)
    return ((x >>> 0) / 0x100000000);
  };
}

function shuffleDeterministic<T>(arr: T[], seedStr: string): T[] {
  const out = arr.slice();
  const rand = makeXorShift32(hashStringToUint32(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}


function anyPlayerReady(room: Room): boolean {
  for (const v of room.readyByPlayer.values()) {
    if (v) return true;
  }
  return false;
}

function computeExpectedTeamsByPlayerId(playerIds: string[]) {
  // Hybrid Option 4 deterministic algorithm locked by contract tests:
  // - order by playerId ascending
  // - assign to smaller-count team, tie -> A
  const ordered = [...playerIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const teamA: string[] = [];
  const teamB: string[] = [];
  for (const id of ordered) {
    if (teamA.length < teamB.length) teamA.push(id);
    else if (teamB.length < teamA.length) teamB.push(id);
    else teamA.push(id);
  }
  return { teamA, teamB };
}

function ensureTeamsObject(room: Room) {
  const gc = room.gameConfig ?? ({} as any);
  const existing = (gc as any).teams;
  if (existing && Array.isArray(existing.teamA) && Array.isArray(existing.teamB)) return existing;
  const created = { teamA: [] as string[], teamB: [] as string[], isLocked: false };
  room.gameConfig = { ...gc, teams: created } as any;
  return created;
}

function backfillTeamsDeterministically(room: Room) {
  if (room.phase !== "lobby") return;
  const gc = room.gameConfig;
  if (!gc?.teamPlay) return;
  // Only 2-team scope for now
  const teams = ensureTeamsObject(room);
  if (teams.isLocked) return;
  const playerIds = Array.from(new Set(Array.from(room.clientToPlayer.values())));
  const expected = computeExpectedTeamsByPlayerId(playerIds);
  teams.teamA = expected.teamA;
  teams.teamB = expected.teamB;
  teams.isLocked = false;
  room.gameConfig = { ...gc, teams };
}

function assignPlayerOnJoin(room: Room, playerId: string) {
  if (room.phase !== "lobby") return;
  const gc = room.gameConfig;
  if (!gc?.teamPlay) return;
  const teams = ensureTeamsObject(room);
  if (teams.isLocked) return;
  if (teams.teamA.includes(playerId) || teams.teamB.includes(playerId)) return;
  // smaller team; tie -> A
  if (teams.teamA.length <= teams.teamB.length) teams.teamA.push(playerId);
  else teams.teamB.push(playerId);
  room.gameConfig = { ...gc, teams };
}

function moveSelfToTeam(room: Room, playerId: string, team: "A" | "B") {
  const gc = room.gameConfig;
  if (!gc?.teamPlay) return;
  const teams = ensureTeamsObject(room);
  if (teams.isLocked) return;
  teams.teamA = teams.teamA.filter((id) => id !== playerId);
  teams.teamB = teams.teamB.filter((id) => id !== playerId);
  if (team === "A") teams.teamA.push(playerId);
  else teams.teamB.push(playerId);
  room.gameConfig = { ...gc, teams };
}

function ensureTeamLockIfEligible(room: Room) {
  if (room.phase !== "lobby") return;

  const gc = room.gameConfig;
  if (!gc?.teamPlay) return;

  const pc = gc.playerCount;
  if (!Number.isFinite(pc) || !pc) return;

  // Only lock once the roster is complete (playerCount gate).
  if (room.clientToPlayer.size !== pc) return;

  if (pc % 2 !== 0) return; // two teams require even playerCount

  // Ensure teams exist + partition before locking (contract requires no unassigned).
  backfillTeamsDeterministically(room);

  const teams = ensureTeamsObject(room);
  if (teams.isLocked) return;

  room.gameConfig = { ...gc, teams: { ...teams, isLocked: true } } as any;
}

function ensureTeamsExist(room: Room) {
  const gc = room.gameConfig ?? {};
  if (!gc.teamPlay || gc.teamCount !== 2) return;

  const existing = gc.teams as any | undefined;
  if (existing && Array.isArray(existing.teamA) && Array.isArray(existing.teamB)) {
    // keep existing arrays; ensure all current players are represented (unless locked)
    if (existing.isLocked) return;
    const present = new Set<string>([...existing.teamA, ...existing.teamB]);
    const players = (room.players ?? []).map((p: any) => p.playerId).filter(Boolean) as string[];
    for (const pid of players) {
      if (!present.has(pid)) {
        // assign missing players by smaller-team rule
        if ((existing.teamA?.length ?? 0) <= (existing.teamB?.length ?? 0)) existing.teamA.push(pid);
        else existing.teamB.push(pid);
      }
    }
    return;
  }

  const teams = { isLocked: false, teamA: [] as string[], teamB: [] as string[] };
  const players = (room.players ?? []).map((p: any) => p.playerId).filter(Boolean) as string[];
  players.sort();
  for (const pid of players) {
    if (teams.teamA.length <= teams.teamB.length) teams.teamA.push(pid);
    else teams.teamB.push(pid);
  }

  room.gameConfig = { ...gc, teams };
}

function removeFromTeams(room: Room, playerId: string) {
  const gc: any = room.gameConfig ?? {};
  const t: any = gc.teams;
  if (!t || (!Array.isArray(t.teamA) && !Array.isArray(t.teamB))) return;
  if (Array.isArray(t.teamA)) t.teamA = t.teamA.filter((x: string) => x !== playerId);
  if (Array.isArray(t.teamB)) t.teamB = t.teamB.filter((x: string) => x !== playerId);
  room.gameConfig = { ...gc, teams: t };
}

function assignToSmallerTeam(room: Room, playerId: string) {
  ensureTeamsExist(room);
  const gc: any = room.gameConfig ?? {};
  const t: any = gc.teams;
  if (!t || t.isLocked) return;
  const inA = Array.isArray(t.teamA) && t.teamA.includes(playerId);
  const inB = Array.isArray(t.teamB) && t.teamB.includes(playerId);
  if (inA || inB) return;

  const aLen = Array.isArray(t.teamA) ? t.teamA.length : 0;
  const bLen = Array.isArray(t.teamB) ? t.teamB.length : 0;
  if (aLen <= bLen) (t.teamA ??= []).push(playerId);
  else (t.teamB ??= []).push(playerId);

  room.gameConfig = { ...gc, teams: t };
}

function isLobbyPhase(room: Room) {
  return room.phase === "lobby";
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

  // Connection + seat identity
  clientToPlayer: Map<string, string>;
  readyByPlayer: Map<string, boolean>;
  expectedPlayerCount?: number;

  // Room lifecycle (UI: lobby -> active; game.phase may be "ended" while room.phase remains "active")
  phase: "lobby" | "active";
  gameConfig?: LobbyGameConfig;

  // Rematch / endgame flow (Rules Authority v1.7.5)
  gameSeq: number; // monotonically increasing per reset-to-lobby (rematch or auto-reset)
  startingActorId: string; // used by startGame to choose who acts first

  // Endgame Results timer (T=180s) starts when game.phase becomes "ended"
  endgameTimer?: {
    startedAtMs: number;
    interval: NodeJS.Timeout;
    secondsTotal: number;
  };

  // Rematch consent tracking while in ENDED_GAME
  rematchConsents?: Map<string, boolean>; // playerId -> true/false

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

      gameSeq: typeof (parsed as any).gameSeq === "number" ? (parsed as any).gameSeq : 0,
      startingActorId: (parsed as any).startingActorId ?? "p0",
      rematchConsents: new Map(Object.entries((parsed as any).rematchConsents ?? {}).map(([k, v]) => [k, !!v])),

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

function stopEndgameTimer(room: Room) {
  if (room.endgameTimer) {
    clearInterval(room.endgameTimer.interval);
    room.endgameTimer = undefined;
  }
}

function emitEndgameTimer(room: Room, secondsRemaining: number) {
  const msg = JSON.stringify({
    type: "endgameTimer",
    roomCode: room.code,
    remaining: secondsRemaining,
    total: ENDGAME_RESULTS_SECONDS,
    gameSeq: room.gameSeq,
    secondsRemaining,
    secondsTotal: ENDGAME_RESULTS_SECONDS,
  });
  for (const ws of room.sockets) ws.send(msg);
}

function startEndgameTimer(room: Room) {
  // Idempotent
  if (room.endgameTimer) return;

  const secondsTotal = 180;
  const startedAtMs = Date.now();

  // Emit immediately at full value.
  emitEndgameTimer(room, secondsTotal);

  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
    const remaining = Math.max(0, secondsTotal - elapsed);
    emitEndgameTimer(room, remaining);

    if (remaining <= 0) {
      // Offer window closed: auto-reset to lobby (new game flow).
      stopEndgameTimer(room);
      room.gameSeq += 1;
      room.startingActorId = "p0";
      room.rematchConsents = new Map();
      resetGameToLobby(room, { startingActorId: room.startingActorId, clearOutcome: false });
      emitLobbySync(room);
      emitStateSync(room);
    }
  }, 1000);

  room.endgameTimer = { startedAtMs, interval, secondsTotal };
}

function computeRematchStartingActorId(game: GameState): string {
  const outcome: any = (game as any).outcome;
  if (outcome?.kind === "individual" && typeof outcome.winnerPlayerId === "string") {
    return outcome.winnerPlayerId;
  }
  if (outcome?.kind === "team") {
    const arr = outcome.winnerTeamPlayersInFinishOrder;
    if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  }
  // Fallback: seat 0
  return "p0";
}

function resetGameToLobby(
  room: Room,
  opts: { startingActorId: string; clearOutcome: boolean }
) {
  const g = room.session.game;

  // Preserve config, seats, teams, player ids.
  const players: Record<string, PlayerState> = {};
  const pegStates: Record<string, PegState[]> = {};

  for (const [pid, p] of Object.entries(g.players)) {
    players[pid] = { ...p, isReady: false, hasFinished: false };
    pegStates[pid] = [0, 1, 2, 3].map(() => ({
      loc: { kind: "base", playerId: pid },
      isFinished: false,
    }));
  }

  const nextGame: GameState = {
    ...g,
    phase: "lobby",
    players,
    pegStates,
    finishedOrder: [],
    turn: { ...g.turn, currentPlayerId: opts.startingActorId },
  } as any;

  if (opts.clearOutcome) delete (nextGame as any).outcome;

  room.session = {
    ...room.session,
    game: nextGame,
    turn: { nextActorId: opts.startingActorId, awaitingDice: false },
    pendingMoves: [],
    lastLegalMoves: undefined,
    awaitingRollRecipient: undefined,
    awaitingRollRecipientDieId: undefined,
  };

  room.phase = "lobby";
}

function handleRematchConsent(room: Room, playerId: string, consent: boolean) {
  if (room.session.game.phase !== "ended") return;

  if (!room.rematchConsents) room.rematchConsents = new Map();
  room.rematchConsents.set(playerId, consent);

  // Any "no" immediately cancels and auto-resets to lobby (new game flow).
  if (consent === false) {
    stopEndgameTimer(room);
    room.gameSeq += 1;
    room.startingActorId = "p0";
    room.rematchConsents = new Map();
    resetGameToLobby(room, { startingActorId: room.startingActorId, clearOutcome: false });
    emitLobbySync(room);
    emitStateSync(room);
    return;
  }

  // Check unanimous "yes" among all players currently in the game state.
  const allPlayerIds = Object.keys(room.session.game.players);
  const allYes = allPlayerIds.every((pid) => room.rematchConsents?.get(pid) === true);

  if (!allYes) return;

  stopEndgameTimer(room);

  const startingActorId = computeRematchStartingActorId(room.session.game);
  room.startingActorId = startingActorId;
  room.gameSeq += 1;
  room.rematchConsents = new Map();

  // Clear outcome/finished info on rematch reset.
  resetGameToLobby(room, { startingActorId, clearOutcome: true });

  emitLobbySync(room);
  emitStateSync(room);
}

function emitStateSync(room: Room, reqId?: string) {
  const turn = computeTurn(room);
  const msg = withReqId(
    {
      type: "stateSync",
      roomCode: room.code,
      gameSeq: room.gameSeq,
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

    gameSeq: 0,
    startingActorId: "p0",
    rematchConsents: new Map(),

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

        // Team Play: assign on join when enabled (Hybrid Option 4, tie -> A)
        assignPlayerOnJoin(room, playerId);

        persist(room);

        send(ws, withReqId({ type: "roomJoined", roomCode: roomCode, clientId: cid, playerId, reconnected: !!existing } as any, reqId));
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

      if (msg.type === "rematchConsent") {
        // Only seated players may consent.
        if (!room.clientToPlayer.get(cid)) {
          send(ws, makeError("BAD_MESSAGE", "Must be seated to consent to rematch.", reqId));
          return;
        }
        handleRematchConsent(room, playerId, (msg as any).consent);
        return;
      }

      if (msg.type === "leaveRoom") {
        if (room.phase !== "lobby") {
          send(ws, makeError("BAD_MESSAGE", "Cannot leave after game start.", reqId));
          return;
        }

        const leavingPlayerId = room.clientToPlayer.get(cid);
        if (leavingPlayerId) {
          // Remove from roster mapping for this clientId
          room.clientToPlayer.delete(cid);

          // Remove ready flag
          room.readyByPlayer.delete(leavingPlayerId);

          // Remove from teams (if enabled)
          const gc0 = room.gameConfig;
          if (gc0?.teamPlay) {
            const teams = ensureTeamsObject(room);
            teams.teamA = teams.teamA.filter((p) => p !== leavingPlayerId);
            teams.teamB = teams.teamB.filter((p) => p !== leavingPlayerId);

            // If roster is no longer eligible for lock, unlock.
            const pc = gc0.playerCount;
            const eligible =
              Number.isFinite(pc) &&
              !!pc &&
              room.clientToPlayer.size === pc &&
              pc % 2 === 0;

            if (!eligible) teams.isLocked = false;

            room.gameConfig = { ...gc0, teams };
          }
        }

        // Detach this socket from the room; client may join another room later.
        room.sockets.delete(ws);
        wsRoom.delete(ws);

        persistRoomIfEnabled(room, opts.roomPersistenceDir);

        emitLobbySync(room, reqId);
        return;
      }


      
      if (msg.type === "setLobbyGameConfig") {
        if (room.phase !== "lobby") {
          send(ws, makeError("BAD_MESSAGE", "Cannot set lobby gameConfig after game start.", reqId));
          return;
        }

        const gc = (msg as any).gameConfig as LobbyGameConfig;
        const prevTeamPlay = !!room.gameConfig?.teamPlay;
        room.gameConfig = { ...(room.gameConfig ?? {}), ...(gc ?? {}) };
        const nowTeamPlay = !!room.gameConfig?.teamPlay;

        // Team Play contract: enabling Team Play must immediately backfill teams for current players.
        if (nowTeamPlay && !prevTeamPlay) {
          backfillTeamsDeterministically(room);
        } else if (nowTeamPlay && !room.gameConfig?.teams) {
          backfillTeamsDeterministically(room);
        }
        // Keep expectedPlayerCount aligned when configured in-lobby.
        room.expectedPlayerCount = room.gameConfig.playerCount;

        // Behavior fix: if config is applied after players have already readied,
        // and the roster is complete, immediately lock teams (Team Play).
        if (anyPlayerReady(room)) {
          ensureTeamLockIfEligible(room);
        }

        persist(room);
        emitLobbySync(room, reqId);
        return;
      }


      if (msg.type === "setTeam") {
        if (room.phase !== "lobby") {
          send(ws, makeError("BAD_MESSAGE", "Cannot change teams after game start.", reqId));
          return;
        }

        const gc = room.gameConfig;
        if (!gc?.teamPlay) {
          send(ws, makeError("BAD_MESSAGE", "Team Play is not enabled.", reqId));
          return;
        }

        const teams = ensureTeamsObject(room);
        if (teams.isLocked) {
          send(ws, makeError("LOBBY_LOCKED", "Teams are locked.", reqId));
          return;
        }

        const team = (msg as any).team as "A" | "B";
        if (team !== "A" && team !== "B") {
          send(ws, makeError("BAD_MESSAGE", "Invalid team.", reqId));
          return;
        }

        moveSelfToTeam(room, playerId, team);
        persist(room);
        emitLobbySync(room, reqId);
        return;
      }
if (msg.type === "setReady") {
        const ready = !!(msg as any).ready;

        // Record readiness first so the "first ready=true" can trigger team lock correctly.
        room.readyByPlayer.set(playerId, ready);

        // Team Play: lock teams on the first ready=true, but only once the lobby roster is complete
        // (playerCount gate) so we can scale cleanly to 4/6/8 player team sizes.
        if (ready) {
          ensureTeamLockIfEligible(room);
        }

        persist(room);
        emitLobbySync(room, reqId);
        return;
      }

      if (msg.type === "startGame") {
        if (room.phase === "active") {
          // Already started: reject (idempotent clients should treat this as a no-op).
          send(ws, makeError("BAD_MESSAGE", "startGame is not allowed once game has started.", reqId));
          return;
        }
        const pc = Number((msg as any).playerCount);
        const options = (msg as any).options as GameStartOptions | undefined;

        room.expectedPlayerCount = pc;
        const prevGc = room.gameConfig ?? {};
        room.gameConfig = {
          ...prevGc,
          playerCount: pc,
          teamPlay: options?.teamPlay ?? prevGc.teamPlay,
          teamCount: options?.teamCount ?? prevGc.teamCount,
          boardArmCount: (options as any)?.boardOverride ?? prevGc.boardArmCount,
          doubleDice: options?.doubleDice ?? prevGc.doubleDice,
          killRoll: options?.killRoll ?? prevGc.killRoll,
          teams: prevGc.teams,
        };

        // If teamPlay is enabled, ensure teams structure exists even before lock.
        ensureTeamsExist(room);

        room.phase = "active";

        (room.session.game as any).config = {
          playerCount: pc,
          options: options ?? {},
        };

        room.session.turn = {
          nextActorId: room.startingActorId ?? "p0",
          awaitingDice: true,
          dicePolicy: "external",
        } as any;

        persist(room);
        emitLobbySync(room, reqId);
        emitStateSync(room, reqId);

        // If the game is already ended at startGame time, treat this as entering ENDED_GAME and start timer.
        if (room.session.game.phase === "ended") {
          startEndgameTimer(room);
        }
        return;
      }      const prevGamePhase = room.session.game.phase;

      // Guard: gameplay is forbidden once the game is ended (Rematch flow only).
      if (room.session.game.phase === "ended") {
        if (msg.type === "roll" || msg.type === "legalMoves" || msg.type === "move") {
          send(ws, makeError("ENDED_GAME", "Game is over. Waiting for rematch/new game.", reqId));
          return;
        }
      }

      const result = handleClientMessage(roomCode, room.session, msg as any);

      room.session = result.nextState;
      persist(room);

      send(ws, result.serverMessage);

      // If we just entered ENDED_GAME, start the Endgame Results timer (T=180s).
      if (room.phase === "active" && prevGamePhase !== "ended" && room.session.game.phase === "ended") {
        startEndgameTimer(room);
      }

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