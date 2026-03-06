// src/ui/wsTextClient.ts
// FULL FILE REPLACEMENT
//
// Protocol-aligned text client (per src/server/protocol.ts).
// Fixes: "flashing cursor" / unclear input by always showing a prompt.
// Supports: hello, joinRoom, lobbySync/stateSync display,
// roll/getLegalMoves/move using the real ClientMessage shapes.
//
// Usage (interactive):
//   help
//   join [ROOMCODE]
//   start <playerCount> [doubleDice true|false] [teamPlay true|false]
//   ready on|off
//   roll <1-6>
//   moves <1-6>
//   move <index> [diceList like 3,5]
//   q
//
// Env:
//   LMR_WS_URL=ws://localhost:8787
//   LMR_ROOM_CODE=ABCDEF  (optional)

import WebSocket from "ws";
import readline from "readline";

type AnyMsg = any;

const WS_URL = process.env.LMR_WS_URL ?? "ws://localhost:8787";
const DEFAULT_ROOM = process.env.LMR_ROOM_CODE; // optional

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt(line: string) {
  rl.setPrompt(line);
  rl.prompt();
}

function log(title: string, obj?: any) {
  console.log(`\n--- ${title} ---`);
  if (obj !== undefined) console.dir(obj, { depth: null });
}

function usage() {
  console.log(
    "\nCommands:\n" +
      "  help\n" +
      "  join [ROOMCODE]\n" +
      "  ready on|off\n" +
      "  start <playerCount> [doubleDice true|false] [teamPlay true|false]\n" +
      "  roll <1-6>\n" +
      "  moves <1-6>\n" +
      "  move <index> [diceList like 3,5]\n" +
      "  q\n"
  );
}

let ws: WebSocket;

let clientId: string | undefined;
let roomCode: string | undefined;
let actorId: string | undefined;

let lastDie: number | undefined;
let lastMoves: any[] = [];

function send(msg: any) {
  ws.send(JSON.stringify(msg));
}

function ensureActor(): string {
  if (!actorId) throw new Error("No actorId yet. Wait for roomJoined (or run: join).");
  return actorId;
}

function parseBool(s: string | undefined): boolean | undefined {
  if (!s) return undefined;
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

function parseDiceList(s: string | undefined): number[] | undefined {
  if (!s) return undefined;
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const nums = parts.map((p) => Number(p)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
  if (nums.length !== parts.length) return undefined;
  return nums;
}

function handleServerMessage(msg: AnyMsg) {
  switch (msg.type) {
    case "welcome": {
      clientId = msg.clientId ?? clientId;
      log("WELCOME", msg);

      // Send hello (protocol supports optional clientId)
      send({ type: "hello", clientId });

      // Auto-join if env provided
      if (DEFAULT_ROOM) {
        send({ type: "joinRoom", roomCode: DEFAULT_ROOM });
      } else {
        console.log("Type 'join' to create/join a room (or set LMR_ROOM_CODE).");
      }

      prompt("> ");
      return;
    }

    case "roomJoined": {
      roomCode = msg.roomCode;
      clientId = msg.clientId ?? clientId;
      actorId = msg.playerId ?? actorId;

      log("ROOM JOINED", {
        roomCode,
        clientId,
        actorId,
        reconnected: msg.reconnected,
      });

      prompt("> ");
      return;
    }

    case "lobbySync": {
      log("LOBBY", msg.lobby);
      prompt("> ");
      return;
    }

    case "stateSync": {
      // TurnInfo lives under msg.turn (per protocol)
      const turn = msg.turn ?? {};
      log("STATE", {
        roomCode: msg.roomCode,
        stateHash: msg.stateHash,
        turn,
      });
      prompt("> ");
      return;
    }

    case "legalMoves": {
      lastDie = msg.die;
      lastMoves = Array.isArray(msg.moves) ? msg.moves : [];

      log(
        "LEGAL MOVES",
        lastMoves.map((m, i) => ({ index: i, move: m }))
      );

      console.log(`(die=${lastDie}) Use: move <index> [diceList like 3,5]`);
      prompt("> ");
      return;
    }

    case "moveResult": {
      log("MOVE RESULT", msg.response);
      prompt("> ");
      return;
    }

    case "error": {
      log("ERROR", msg);
      prompt("> ");
      return;
    }

    default: {
      log("SERVER MESSAGE", msg);
      prompt("> ");
      return;
    }
  }
}

function connect() {
  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log(`connected: true url=${WS_URL}`);
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw)) as AnyMsg;
    handleServerMessage(msg);
  });

  ws.on("close", () => {
    console.log("disconnected");
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("ws error:", err);
  });
}

rl.on("line", (line) => {
  const input = line.trim();
  if (!input) return prompt("> ");

  if (input === "q") process.exit(0);
  if (input === "help") {
    usage();
    return prompt("> ");
  }

  const parts = input.split(/\s+/);
  const cmd = parts[0];

  try {
    if (cmd === "join") {
      const rc = parts[1];
      // roomCode is optional per protocol; if omitted, server may create one.
      send({ type: "joinRoom", roomCode: rc });
      return prompt("> ");
    }

    if (cmd === "ready") {
      const onoff = parts[1];
      if (onoff !== "on" && onoff !== "off") {
        console.log("Usage: ready on|off");
        return prompt("> ");
      }
      send({ type: "setReady", ready: onoff === "on" });
      return prompt("> ");
    }

    if (cmd === "start") {
      const pc = Number(parts[1]);
      if (!Number.isInteger(pc) || pc < 2 || pc > 8) {
        console.log("Usage: start <playerCount 2..8> [doubleDice true|false] [teamPlay true|false]");
        return prompt("> ");
      }
      const dd = parseBool(parts[2]);
      const tp = parseBool(parts[3]);

      const options: any = {};
      if (dd !== undefined) options.doubleDice = dd;
      if (tp !== undefined) options.teamPlay = tp;

      send({ type: "startGame", playerCount: pc, options: Object.keys(options).length ? options : undefined });
      return prompt("> ");
    }

    if (cmd === "roll") {
      const die = Number(parts[1]);
      if (!Number.isInteger(die) || die < 1 || die > 6) {
        console.log("Usage: roll <1-6>");
        return prompt("> ");
      }
      send({ type: "roll", actorId: ensureActor(), die });
      return prompt("> ");
    }

    if (cmd === "moves" || cmd === "getLegalMoves") {
      const die = Number(parts[1]);
      if (!Number.isInteger(die) || die < 1 || die > 6) {
        console.log("Usage: moves <1-6>");
        return prompt("> ");
      }
      send({ type: "getLegalMoves", actorId: ensureActor(), die });
      return prompt("> ");
    }

    if (cmd === "move") {
      const idx = Number(parts[1]);
      if (!Number.isInteger(idx) || idx < 0 || idx >= lastMoves.length) {
        console.log("Usage: move <index> [diceList like 3,5]");
        return prompt("> ");
      }

      const diceList = parseDiceList(parts[2]) ?? (lastDie ? [lastDie] : undefined);
      if (!diceList) {
        console.log("No die known. Use: moves <1-6> first, or provide diceList.");
        return prompt("> ");
      }

      send({
        type: "move",
        actorId: ensureActor(),
        dice: diceList,
        move: lastMoves[idx],
      });
      return prompt("> ");
    }

    console.log("Unknown command. Type: help");
    return prompt("> ");
  } catch (e: any) {
    console.log(`ERROR: ${e?.message ?? String(e)}`);
    return prompt("> ");
  }
});

connect();
prompt("> ");
