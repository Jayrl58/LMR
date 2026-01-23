import { startWsServer } from "./wsServer";
import { startHttpConsole } from "./httpConsole";
import { makeState } from "../engine/makeState";

function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v == null) return defaultValue;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function envInt(name: string, defaultValue: number): number {
  const v = process.env[name];
  if (v == null) return defaultValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

const wsPort = envInt("LMR_WS_PORT", 8787);
const httpPort = envInt("LMR_HTTP_PORT", 8788);

// Dev defaults
const playerCount = envInt("LMR_PLAYER_COUNT", 2);
const doubleDice = envFlag("LMR_DOUBLE_DICE", true);
const teamPlay = envFlag("LMR_TEAM_PLAY", false);

const initialState = makeState({
  playerCount: playerCount as any,
  doubleDice,
  teamPlay,
});

const ws = startWsServer({
  port: wsPort,
  initialState,
});

const http = startHttpConsole({
  port: httpPort,
  defaultWsUrl: `ws://localhost:${wsPort}`,
});

console.log("WS server running on port", ws.port);
console.log("HTTP console running on port", http.port);
console.log(`Open: http://localhost:${http.port}`);
console.log(
  "Dev options:",
  JSON.stringify(
    {
      playerCount,
      doubleDice,
      teamPlay,
      wsPort: ws.port,
      httpPort: http.port,
    },
    null,
    2
  )
);
