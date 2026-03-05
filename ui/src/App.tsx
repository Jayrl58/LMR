import React, { useMemo, useRef, useState } from "react";

type LogEntry = { dir: "SEND" | "RECV" | "INFO"; msg: any };
type TurnState = {
  nextActorId?: string;
  awaitingDice?: boolean;
  dicePolicy?: string;
  bankedDice?: number;
  [k: string]: any;
} | null;

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);

  const [wsUrl, setWsUrl] = useState("ws://127.0.0.1:8787");
  const [connected, setConnected] = useState(false);

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [clientId, setClientId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("p0");
  const [actorId, setActorId] = useState<string>("p0");

  const [dieValue, setDieValue] = useState<number>(1);
  const [lastDice, setLastDice] = useState<number[] | null>(null);

  const [turn, setTurn] = useState<TurnState>(null);
  const [moves, setMoves] = useState<any[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastMsg, setLastMsg] = useState<any>(null);

  function extractTurn(msg: any): TurnState {
    return (
      msg?.turn ??
      msg?.response?.turn ??
      msg?.response?.result?.turn ??
      null
    );
  }

  function log(dir: LogEntry["dir"], msg: any) {
    setLogs((prev) => [...prev, { dir, msg }]);
    setLastMsg(msg);

    const extractedTurn = extractTurn(msg);
    if (extractedTurn) {
      setTurn(extractedTurn);
    }

    if (msg?.type === "welcome" && typeof msg?.clientId === "string") {
      setClientId(msg.clientId);
    }

    if (msg?.type === "roomJoined") {
      if (typeof msg?.roomCode === "string") {
        setRoomCode(msg.roomCode);
        setRoomCodeInput(msg.roomCode);
      }
      if (typeof msg?.playerId === "string") {
        setPlayerId(msg.playerId);
        setActorId(msg.playerId);
      }
    }

    if (msg?.type === "lobbySync" && typeof msg?.lobby?.roomCode === "string") {
      setRoomCode(msg.lobby.roomCode);
      if (!roomCodeInput) setRoomCodeInput(msg.lobby.roomCode);
    }

    if (msg?.type === "stateSync" && typeof msg?.roomCode === "string") {
      setRoomCode(msg.roomCode);
      if (!roomCodeInput) setRoomCodeInput(msg.roomCode);
    }

    if (msg?.type === "legalMoves") {
      setMoves(Array.isArray(msg?.moves) ? msg.moves : []);
      if (Array.isArray(msg?.dice)) {
        setLastDice(msg.dice);
      }
    }

    if (msg?.type === "moveResult") {
      setMoves([]);
    }
  }

  function safeSend(msg: any) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log("INFO", { message: "cannot send; ws not open", attempted: msg, wsUrl });
      return;
    }
    ws.send(JSON.stringify(msg));
    log("SEND", msg);
  }

  function connect() {
    try {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        log("INFO", { message: "connected", wsUrl });
      };

      ws.onclose = () => {
        setConnected(false);
        log("INFO", { message: "disconnected", wsUrl });
      };

      ws.onerror = () => {
        log("INFO", { message: "ws error", wsUrl });
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          log("RECV", msg);
        } catch {
          log("RECV", { type: "nonJsonMessage", data: String(ev.data) });
        }
      };
    } catch (e: any) {
      log("INFO", { message: "connect failed", wsUrl, error: String(e?.message ?? e) });
    }
  }

  function disconnect() {
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
  }

  function hello() {
    safeSend({ type: "hello", clientId: "ui-dev" });
  }

  function joinRoom() {
    safeSend({
      type: "joinRoom",
      roomCode: roomCodeInput.trim(),
      claimPlayerId: "p0"
    });
  }

  function startGame() {
    safeSend({
      type: "startGame",
      playerCount: 2,
      options: {
        doubleDice: true,
        killRoll: false
      }
    });
  }

  function roll() {
    const dice = [Number.isFinite(dieValue) ? dieValue : 1];
    setLastDice(dice);
    safeSend({
      type: "roll",
      actorId,
      dice
    });
  }

  function getLegalMoves() {
    const dice = lastDice ?? [Number.isFinite(dieValue) ? dieValue : 1];
    setLastDice(dice);
    safeSend({
      type: "getLegalMoves",
      actorId,
      dice
    });
  }

  function forfeitPendingDie() {
    safeSend({
      type: "forfeitPendingDie",
      actorId
    });
  }

  function sendMove(move: any) {
    const dice = lastDice ?? [Number.isFinite(dieValue) ? dieValue : 1];
    setLastDice(dice);
    safeSend({
      type: "move",
      actorId,
      dice,
      move
    });
  }

  const awaitingDice = turn?.awaitingDice === true;
  const bankedDice = typeof turn?.bankedDice === "number" ? turn.bankedDice : undefined;

  const statusLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Connected: ${connected ? "true" : "false"}`);
    parts.push(`clientId: ${clientId || "(none)"}`);
    parts.push(`room: ${roomCode || "(none)"}`);
    parts.push(`playerId: ${playerId || "(none)"}`);
    return parts.join(" | ");
  }, [connected, clientId, roomCode, playerId]);

  return (
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h2>LMR Minimal Debug UI</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          WS URL:
          <input
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            style={{ width: 280 }}
            spellCheck={false}
          />
        </label>
        <button onClick={connect} disabled={connected}>Connect</button>
        <button onClick={disconnect} disabled={!connected}>Disconnect</button>
        <div style={{ opacity: 0.85 }}>{statusLine}</div>
      </div>

      <hr />

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          ActorId:
          <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="p0">p0</option>
            <option value="p1">p1</option>
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Dice:
          <input
            value={String(dieValue)}
            onChange={(e) => setDieValue(parseInt(e.target.value || "1", 10) || 1)}
            style={{ width: 60 }}
          />
        </label>

        <div style={{ opacity: 0.85 }}>
          LastDice: {lastDice ? JSON.stringify(lastDice) : "null"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={hello} disabled={!connected}>Hello</button>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Room Code:
          <input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="(blank=new)"
            style={{ width: 180 }}
            spellCheck={false}
          />
        </label>

        <button onClick={joinRoom} disabled={!connected}>Join Room</button>
        <button onClick={startGame} disabled={!connected}>Start Game</button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={roll} disabled={!connected || !awaitingDice}>Roll</button>
        <button onClick={getLegalMoves} disabled={!connected || awaitingDice}>Get Legal Moves</button>
        <button onClick={forfeitPendingDie} disabled={!connected || awaitingDice}>Forfeit Pending Die</button>
        <span style={{ opacity: 0.85 }}>
          (awaitingDice: {awaitingDice ? "true" : "false"}{bankedDice !== undefined ? `, bankedDice: ${bankedDice}` : ""})
        </span>
      </div>

      <h3>Turn</h3>
      <pre>{JSON.stringify(turn, null, 2)}</pre>

      <h3>Moves</h3>
      {moves.length === 0 ? (
        <div>(none)</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {moves.map((m, idx) => (
            <button
              key={m?.id ?? idx}
              onClick={() => sendMove(m)}
              disabled={!connected}
              style={{ textAlign: "left" }}
            >
              {m?.id ?? JSON.stringify(m)}
            </button>
          ))}
        </div>
      )}

      <h3>Raw Last Message</h3>
      <pre>{JSON.stringify(lastMsg, null, 2)}</pre>

      <h3>Message Log</h3>
      <pre style={{ maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap" }}>
        {logs.map((l) => `[${l.dir}] ${JSON.stringify(l.msg)}\n`)}
      </pre>
    </div>
  );
}
