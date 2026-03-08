import React, { useEffect, useMemo, useRef, useState } from "react";

type LogEntry = { dir: "SEND" | "RECV" | "INFO"; msg: any };

type PendingDieInfo =
  | number
  | {
      value?: number;
      controllerId?: string | null;
      [k: string]: any;
    };

type PendingDieUI = {
  value: number;
  controllerId: string | null;
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

  const [rollInputs, setRollInputs] = useState<string[]>(["", ""]);
  const [lastDice, setLastDice] = useState<number[] | null>(null);

  const [turn, setTurn] = useState<TurnState>(null);
  const [moves, setMoves] = useState<any[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastMsg, setLastMsg] = useState<any>(null);

  const [selectedPendingIdx, setSelectedPendingIdx] = useState<number>(0);

  const [debugRollCountOverrideEnabled, setDebugRollCountOverrideEnabled] = useState(false);
  const [debugRollCountOverrideValue, setDebugRollCountOverrideValue] = useState<string>("3");

  function extractTurn(msg: any): TurnState {
    return msg?.turn ?? msg?.response?.turn ?? msg?.response?.result?.turn ?? null;
  }

  function detectActorId(t: any): string | null {
    if (!t) return null;
    if (typeof t.actorId === "string") return t.actorId;
    if (typeof t.nextActorId === "string") return t.nextActorId;
    if (typeof t.currentPlayerId === "string") return t.currentPlayerId;
    return null;
  }

  function normalizePendingDice(raw: any): PendingDieUI[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((pd) => {
        if (typeof pd === "number" && Number.isFinite(pd)) {
          return { value: pd, controllerId: null };
        }
        if (typeof pd?.value === "number" && Number.isFinite(pd.value)) {
          return {
            value: pd.value,
            controllerId: typeof pd?.controllerId === "string" ? pd.controllerId : null,
          };
        }
        return null;
      })
      .filter((v): v is PendingDieUI => v != null);
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
        const dice = msg.dice.filter((d: any) => typeof d === "number" && Number.isFinite(d));
        setLastDice(dice.length > 0 ? dice : null);
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
      claimPlayerId: "p0",
    });
  }

  function startGame() {
    safeSend({
      type: "startGame",
      playerCount: 2,
      options: {
        doubleDice: true,
        killRoll: false,
      },
    });
  }

  const pendingDiceUI = useMemo(() => {
    if (!turn) return [];
    if (turn.awaitingDice === true) return [];
    return normalizePendingDice(turn.pendingDice);
  }, [turn]);

  const awaitingDice = turn?.awaitingDice === true;
  const bankedDice = typeof turn?.bankedDice === "number" ? turn.bankedDice : undefined;
  const realEligibleRollCount = bankedDice && bankedDice > 0 ? bankedDice : 2;

  const debugOverrideCount = useMemo(() => {
    const parsed = parseInt(debugRollCountOverrideValue.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
  }, [debugRollCountOverrideValue]);

  const effectiveEligibleRollCount =
    debugRollCountOverrideEnabled && debugOverrideCount != null
      ? debugOverrideCount
      : realEligibleRollCount;

  const isUsingDebugRollOverride =
    debugRollCountOverrideEnabled && debugOverrideCount != null && debugOverrideCount !== realEligibleRollCount;

  useEffect(() => {
    if (!awaitingDice) return;
    setRollInputs((prev) => Array.from({ length: effectiveEligibleRollCount }, (_, idx) => prev[idx] ?? ""));
  }, [awaitingDice, effectiveEligibleRollCount]);

  function buildDiceFromInputs(): number[] {
    const trimmed = rollInputs.map((v) => v.trim());

    if (isUsingDebugRollOverride) {
      if (trimmed.length !== effectiveEligibleRollCount) return [];
      const parsed = trimmed.map((v) => parseInt(v, 10));
      if (parsed.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) return [];
      return parsed;
    }

    if (bankedDice && bankedDice > 0) {
      if (trimmed.length !== bankedDice) return [];
      const parsed = trimmed.map((v) => parseInt(v, 10));
      if (parsed.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) return [];
      return parsed;
    }

    const firstDieRaw = trimmed[0] ?? "";
    if (firstDieRaw === "") return [];

    const firstDie = parseInt(firstDieRaw, 10);
    if (!Number.isInteger(firstDie) || firstDie < 1 || firstDie > 6) {
      return [];
    }

    const secondRaw = trimmed[1] ?? "";
    if (secondRaw === "") return [firstDie];

    const secondDie = parseInt(secondRaw, 10);
    if (!Number.isInteger(secondDie) || secondDie < 1 || secondDie > 6) {
      return [];
    }

    return [firstDie, secondDie];
  }

  const rollPreview = useMemo(
    () => buildDiceFromInputs(),
    [rollInputs, bankedDice, isUsingDebugRollOverride, effectiveEligibleRollCount]
  );

  const canSubmitRoll =
    awaitingDice &&
    rollPreview.length > 0 &&
    rollPreview.length === effectiveEligibleRollCount;

  const selectedPending =
    pendingDiceUI.length > 0 && selectedPendingIdx >= 0 && selectedPendingIdx < pendingDiceUI.length
      ? pendingDiceUI[selectedPendingIdx]
      : null;

  const selectedPendingDie = selectedPending?.value ?? null;
  const selectedPendingActorId = selectedPending?.controllerId ?? turn?.nextActorId ?? actorId;

  useEffect(() => {
    if (pendingDiceUI.length === 0) {
      setSelectedPendingIdx(0);
      return;
    }
    if (selectedPendingIdx < 0 || selectedPendingIdx >= pendingDiceUI.length) {
      setSelectedPendingIdx(0);
    }
  }, [pendingDiceUI, selectedPendingIdx]);

  useEffect(() => {
    if (awaitingDice || pendingDiceUI.length === 0 || selectedPendingDie == null) {
      setMoves([]);
    }
  }, [awaitingDice, pendingDiceUI.length, selectedPendingDie]);

  function roll() {
    const dice = buildDiceFromInputs();
    if (dice.length === 0) return;

    setLastDice(dice);
    setMoves([]);
    safeSend({
      type: "roll",
      actorId,
      dice,
    });

    setRollInputs(Array.from({ length: effectiveEligibleRollCount }, () => ""));
  }

  function selectPendingDie(idx: number) {
    const pd = pendingDiceUI[idx];
    setSelectedPendingIdx(idx);
    setMoves([]);

    if (!pd) return;

    const nextActorId = pd.controllerId ?? turn?.nextActorId ?? actorId;
    setLastDice([pd.value]);

    safeSend({
      type: "getLegalMoves",
      actorId: nextActorId,
      dice: [pd.value],
    });
  }

  function getLegalMoves() {
    if (pendingDiceUI.length > 0 && selectedPendingDie != null) {
      const dice = [selectedPendingDie];
      setLastDice(dice);
      safeSend({
        type: "getLegalMoves",
        actorId: selectedPendingActorId,
        dice,
      });
      return;
    }

    const dice = lastDice ?? buildDiceFromInputs();
    setLastDice(dice);
    safeSend({
      type: "getLegalMoves",
      actorId,
      dice,
    });
  }

  function forfeitPendingDie() {
    safeSend({
      type: "forfeitPendingDie",
      actorId,
    });
  }

  function sendMove(move: any) {
    const dice =
      pendingDiceUI.length > 0 && selectedPendingDie != null
        ? [selectedPendingDie]
        : lastDice ?? buildDiceFromInputs();

    const moveActorId =
      pendingDiceUI.length > 0 && selectedPendingDie != null
        ? selectedPendingActorId
        : actorId;

    setLastDice(dice);
    safeSend({
      type: "move",
      actorId: moveActorId,
      dice,
      move,
    });
  }

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
    minWidth: 0,
  };

  const gameplayGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 1fr) minmax(340px, 1fr)",
    gap: 12,
    alignItems: "start",
  };

  const diagGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 1fr) minmax(340px, 1fr)",
    gap: 12,
    alignItems: "start",
    marginTop: 12,
  };

  const preStyle: React.CSSProperties = {
    margin: 0,
    maxHeight: 320,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 16 }}>
      <h2>LMR Minimal Debug UI</h2>

      <div style={gameplayGridStyle}>
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Turn Status</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>Connected: {connected ? "true" : "false"}</div>
            <div>Room: {roomCode || "(none)"}</div>
            <div>ClientId: {clientId || "(none)"}</div>
            <div>PlayerId: {playerId || "(none)"}</div>
            <div>ActorId: {actorId || "(none)"}</div>
            <div>awaitingDice: {awaitingDice ? "true" : "false"}</div>
            <div>bankedDice: {bankedDice === undefined ? "(none)" : String(bankedDice)}</div>
            <div>eligibleRollCount: {awaitingDice ? String(effectiveEligibleRollCount) : "(n/a)"}</div>
            <div>LastDice: {lastDice ? JSON.stringify(lastDice) : "null"}</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Room / Session Controls</h3>
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

            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>ActorId:</span>
              <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
                <option value="p0">p0</option>
                <option value="p1">p1</option>
              </select>
            </label>

            <div style={{ opacity: 0.85 }}>{statusLine}</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Roll Panel</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {awaitingDice ? (
              <>
                <div style={{ opacity: 0.85 }}>
                  {isUsingDebugRollOverride
                    ? `Debug override active: showing ${effectiveEligibleRollCount} dice inputs.`
                    : bankedDice && bankedDice > 0
                      ? `Roll exactly ${bankedDice} banked dice.`
                      : `Roll up to ${effectiveEligibleRollCount} dice.`}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {rollInputs.map((value, idx) => (
                    <label key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>Die {idx + 1}:</span>
                      <input
                        value={value}
                        onChange={(e) => {
                          const next = rollInputs.slice();
                          next[idx] = e.target.value;
                          setRollInputs(next);
                        }}
                        placeholder={
                          isUsingDebugRollOverride || (bankedDice && bankedDice > 0)
                            ? "required"
                            : idx === 0
                              ? "required"
                              : "optional"
                        }
                        style={{ width: 80 }}
                      />
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={roll} disabled={!connected || !canSubmitRoll}>Roll</button>
                </div>

                <div style={{ opacity: 0.85 }}>
                  RollPreview: {rollPreview.length > 0 ? JSON.stringify(rollPreview) : "(invalid)"}
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.85 }}>Roll inputs hidden while resolving dice.</div>
            )}
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Pending Dice Panel</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <strong>Pending Dice:</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {pendingDiceUI.length === 0 ? (
                  <span>(none)</span>
                ) : (
                  pendingDiceUI.map((pd, idx) => (
                    <button
                      key={`${pd.value}-${idx}`}
                      onClick={() => selectPendingDie(idx)}
                      disabled={!connected}
                      style={{
                        fontWeight: selectedPendingIdx === idx ? "bold" : "normal",
                        textDecoration: selectedPendingIdx === idx ? "underline" : "none",
                      }}
                    >
                      {String(pd.value)}
                      {pd.controllerId ? ` (${pd.controllerId})` : ""}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>Selected Pending Die: {selectedPendingDie == null ? "(none)" : String(selectedPendingDie)}</div>
            <div>
              Selected Pending Controller:{" "}
              {selectedPending == null ? "(none)" : (selectedPending.controllerId ?? turn?.nextActorId ?? "(none)")}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={forfeitPendingDie} disabled={!connected || awaitingDice}>Forfeit Pending Die</button>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Move Options</h3>
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
          <h3 style={{ marginTop: 0 }}>Debug Tools</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="checkbox"
                checked={debugRollCountOverrideEnabled}
                onChange={(e) => setDebugRollCountOverrideEnabled(e.target.checked)}
              />
              <span>Override eligible roll count</span>
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>Override count:</span>
              <input
                value={debugRollCountOverrideValue}
                onChange={(e) => setDebugRollCountOverrideValue(e.target.value)}
                disabled={!debugRollCountOverrideEnabled}
                style={{ width: 80 }}
              />
            </label>

            <div style={{ opacity: 0.85 }}>
              Real eligible count: {realEligibleRollCount}
              {isUsingDebugRollOverride ? ` | Effective override count: ${effectiveEligibleRollCount}` : ""}
            </div>

            {isUsingDebugRollOverride ? (
              <div style={{ opacity: 0.85 }}>
                Override affects UI rendering only. The server still enforces the real count.
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={getLegalMoves} disabled={!connected || selectedPendingDie == null}>
                Debug: Get Legal Moves
              </button>
            </div>
          </div>
        </section>
      </div>

      <div style={diagGridStyle}>
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Turn JSON</h3>
          <pre style={preStyle}>{JSON.stringify(turn, null, 2)}</pre>
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
