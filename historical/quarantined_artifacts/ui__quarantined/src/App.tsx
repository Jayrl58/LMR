import { useEffect, useRef, useState } from "react";

type WsStatus = "disconnected" | "connecting" | "connected" | "error";

function randId() {
  return `ui-${Math.random().toString(16).slice(2, 8)}`;
}

export default function App() {
  const [wsUrl, setWsUrl] = useState("ws://localhost:8787");
  const [clientId, setClientId] = useState(randId());
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [log, setLog] = useState<string[]>([]);
  const [lastMsg, setLastMsg] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);

  function push(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function connect() {
    setStatus("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      push(`[OK] connected ${wsUrl}`);

      ws.send(
        JSON.stringify({
          type: "hello",
          clientId,
        })
      );
    };

    ws.onmessage = (ev) => {
      const raw = String(ev.data ?? "");
      const parsed = JSON.parse(raw);
      setLastMsg(parsed);

      if (parsed.type === "welcome") {
        push(`[OK] welcome serverVersion=${parsed.serverVersion} clientId=${parsed.clientId}`);
      }

      if (parsed.type === "roomJoined") {
        push(`[OK] roomJoined room=${parsed.roomCode} actorId=${parsed.actorId}`);
      }
    };

    ws.onerror = () => {
      setStatus("error");
      push("[ERR] websocket error");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      push("[OK] disconnected");
    };
  }

  function join() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: "createOrJoinRoom",
        roomCode: roomCode.trim() || undefined,
      })
    );
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      <h2>LMR UI (Vite)</h2>

      <div style={{ marginBottom: 12 }}>
        <div>WS URL</div>
        <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />

        <div>Client ID</div>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} />

        <div>Room Code</div>
        <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />

        <div style={{ marginTop: 8 }}>
          <button onClick={connect}>Connect</button>
          <button onClick={join} disabled={status !== "connected"}>
            Join
          </button>
        </div>
      </div>

      <div>
        <h3>Log</h3>
        <pre>{log.join("\n")}</pre>
      </div>

      <div>
        <h3>Raw (last message)</h3>
        <pre>{lastMsg ? JSON.stringify(lastMsg, null, 2) : "(none)"}</pre>
      </div>
    </div>
  );
}