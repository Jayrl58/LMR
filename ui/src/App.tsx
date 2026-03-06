import React, { useEffect, useMemo, useRef, useState } from "react";

type LogEntry = { dir: "SEND" | "RECV" | "INFO"; msg: any };

type PendingDieInfo =
  | number
  | {
      value?: number;
      controllerId?: string | null;
      [k: string]: any;
    };

type TurnState = {
  nextActorId?: string;
  currentPlayerId?: string;
  actorId?: string;
  awaitingDice?: boolean;
  dicePolicy?: string;
  bankedDice?: number;
  pendingDice?: PendingDieInfo[];
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

  const [dieValue1, setDieValue1] = useState<number>(1);
  const [dieValue2Input, setDieValue2Input] = useState<string>("");
  const [lastDice, setLastDice] = useState<number[] | null>(null);

  const [turn, setTurn] = useState<TurnState>(null);
  const [moves, setMoves] = useState<any[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastMsg, setLastMsg] = useState<any>(null);

  const [pendingDiceUI, setPendingDiceUI] = useState<number[]>([]);
  const [selectedPendingIdx, setSelectedPendingIdx] = useState<number>(0);

  function extractTurn(msg: any): TurnState {
    return (
      msg?.turn ??
      msg?.response?.turn ??
      msg?.response?.result?.turn ??
      null
    );
  }

  function detectActorId(t: any): string | null {
    if (!t) return null;
    if (typeof t.actorId === "string") return t.actorId;
    if (typeof t.nextActorId === "string") return t.nextActorId;
    if (typeof t.currentPlayerId === "string") return t.currentPlayerId;
    return null;
  }

  function normalizePendingDiceArray(raw: any): number[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((pd) => {
        if (typeof pd === "number" && Number.isFinite(pd)) return pd;
        if (typeof pd?.value === "number" && Number.isFinite(pd.value)) return pd.value;
        return null;
      })
      .filter((v): v is number => typeof v === "number");
  }

  function normalizePendingDiceFromTurn(t: any): number[] {
    return normalizePendingDiceArray(t?.pendingDice);
  }

  function normalizePendingDiceFromMoveResult(msg: any): number[] {
    return normalizePendingDiceArray(
      msg?.response?.turn?.pendingDice ??
      msg?.response?.result?.turn?.pendingDice ??
      msg?.response?.result?.nextState?.pendingDice ??
      msg?.nextState?.pendingDice
    );
  }

  function log(dir: LogEntry["dir"], msg: any) {
    setLogs((prev) => [...prev, { dir, msg }]);
    setLastMsg(msg);

    const extractedTurn = extractTurn(msg);
    if (extractedTurn) {
      setTurn(extractedTurn);

      const detected = detectActorId(extractedTurn);
      if (detected) {
        setActorId(detected);
      }

      const serverPending = normalizePendingDiceFromTurn(extractedTurn);
      if (serverPending.length > 0) {
        setPendingDiceUI(serverPending);
      } else if (extractedTurn.awaitingDice === true) {
        setPendingDiceUI([]);
      }
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

        const incomingDice = msg.dice.filter((d: any) => typeof d === "number" && Number.isFinite(d));
        if (incomingDice.length > 0) {
          setPendingDiceUI((prev) => {
            if (prev.length === 0 || incomingDice.length > prev.length) return incomingDice;
            return prev;
          });
        }
      }
    }

    if (msg?.type === "moveResult") {
      setMoves([]);

      const nextPending = normalizePendingDiceFromMoveResult(msg);
      if (nextPending.length > 0) {
        setPendingDiceUI(nextPending);
      } else {
        setPendingDiceUI((prev) => {
          if (prev.length === 0) return prev;
          const idx = Math.max(0, Math.min(selectedPendingIdx, prev.length - 1));
          const next = prev.slice();
          next.splice(idx, 1);
          return next;
        });
      }
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
        } catch {}
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
    } catch {}
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

  function buildDiceFromInputs(): number[] {
    const firstDie = Number.isFinite(dieValue1) ? dieValue1 : 1;
    const secondDieRaw = dieValue2Input.trim();

    if (secondDieRaw === "") {
      return [firstDie];
    }

    const parsedSecondDie = parseInt(secondDieRaw, 10);
    if (!Number.isFinite(parsedSecondDie)) {
      return [firstDie];
    }

    return [firstDie, parsedSecondDie];
  }

  const selectedPendingDie =
    pendingDiceUI.length > 0 && selectedPendingIdx >= 0 && selectedPendingIdx < pendingDiceUI.length
      ? pendingDiceUI[selectedPendingIdx]
      : null;

  useEffect(() => {
    if (pendingDiceUI.length === 0) {
      setSelectedPendingIdx(0);
      return;
    }
    if (selectedPendingIdx < 0 || selectedPendingIdx >= pendingDiceUI.length) {
      setSelectedPendingIdx(0);
    }
  }, [pendingDiceUI, selectedPendingIdx]);

  function roll() {
    const dice = buildDiceFromInputs();
    setLastDice(dice);
    safeSend({
      type: "roll",
      actorId,
      dice
    });
  }

  function getLegalMoves() {
    if (pendingDiceUI.length > 0 && selectedPendingDie != null) {
      const dice = [selectedPendingDie];
      setLastDice(dice);
      safeSend({
        type: "getLegalMoves",
        actorId,
        dice
      });
      return;
    }

    const dice = lastDice ?? buildDiceFromInputs();
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
    const dice =
      pendingDiceUI.length > 0 && selectedPendingDie != null
        ? [selectedPendingDie]
        : lastDice ?? buildDiceFromInputs();

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

  const cardStyle: React.CSSProperties = {
    border: "1px solid #cfcfcf",
    borderRadius: 8,
    padding: 12,
    background: "#f8f8f8",
    minWidth: 0
  };

  const topGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(340px, 1fr))",
    gap: 12,
    alignItems: "start"
  };

  const debugGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(340px, 1fr))",
    gap: 12,
    alignItems: "start",
    marginTop: 12
  };

  const preStyle: React.CSSProperties = {
    margin: 0,
    maxHeight: 320,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere"
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h2>LMR Minimal Debug UI</h2>

      <div style={topGridStyle}>
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Connection / Session</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>WS URL:</span>
              <input
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                style={{ width: 280 }}
                spellCheck={false}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={connect} disabled={connected}>Connect</button>
              <button onClick={disconnect} disabled={!connected}>Disconnect</button>
            </div>

            <div style={{ opacity: 0.85 }}>{statusLine}</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Room / Game Setup</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={hello} disabled={!connected}>Hello</button>
              <button onClick={joinRoom} disabled={!connected}>Join Room</button>
              <button onClick={startGame} disabled={!connected}>Start Game</button>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>Room Code:</span>
              <input
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
                placeholder="(blank=new)"
                style={{ width: 180 }}
                spellCheck={false}
              />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Turn / Dice Controls</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>ActorId:</span>
              <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
                <option value="p0">p0</option>
                <option value="p1">p1</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Die 1:</span>
                <input
                  value={String(dieValue1)}
                  onChange={(e) => setDieValue1(parseInt(e.target.value || "1", 10) || 1)}
                  style={{ width: 60 }}
                />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Die 2:</span>
                <input
                  value={dieValue2Input}
                  onChange={(e) => setDieValue2Input(e.target.value)}
                  placeholder="optional"
                  style={{ width: 80 }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={roll} disabled={!connected || !awaitingDice}>Roll</button>
              <button onClick={getLegalMoves} disabled={!connected || awaitingDice}>Get Legal Moves</button>
              <button onClick={forfeitPendingDie} disabled={!connected || awaitingDice}>Forfeit Pending Die</button>
            </div>

            <div style={{ opacity: 0.85 }}>
              LastDice: {lastDice ? JSON.stringify(lastDice) : "null"}
            </div>

            <div style={{ opacity: 0.85 }}>
              awaitingDice: {awaitingDice ? "true" : "false"}
              {bankedDice !== undefined ? ` | bankedDice: ${bankedDice}` : ""}
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Dice State</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <strong>Pending Dice:</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {pendingDiceUI.length === 0 ? (
                  <span>(none)</span>
                ) : (
                  pendingDiceUI.map((die, idx) => (
                    <button
                      key={`${die}-${idx}`}
                      onClick={() => setSelectedPendingIdx(idx)}
                      disabled={!connected}
                      style={{
                        fontWeight: selectedPendingIdx === idx ? "bold" : "normal",
                        textDecoration: selectedPendingIdx === idx ? "underline" : "none"
                      }}
                    >
                      {String(die)}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <strong>Selected Pending Die:</strong>{" "}
              {selectedPendingDie == null ? "(none)" : String(selectedPendingDie)}
            </div>

            <div>
              <strong>Banked Dice:</strong>{" "}
              {bankedDice === undefined ? "(none)" : String(bankedDice)}
            </div>
          </div>
        </section>
      </div>

      <div style={debugGridStyle}>
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Turn</h3>
          <pre style={preStyle}>{JSON.stringify(turn, null, 2)}</pre>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Moves</h3>
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
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Raw Last Message</h3>
          <pre style={preStyle}>{JSON.stringify(lastMsg, null, 2)}</pre>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Message Log</h3>
          <pre style={preStyle}>
            {logs.map((l) => `[${l.dir}] ${JSON.stringify(l.msg)}\n`)}
          </pre>
        </section>
      </div>
    </div>
  );
}
