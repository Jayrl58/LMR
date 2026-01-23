import WebSocket from "ws";
import readline from "node:readline";

const url = process.argv[2] ?? "ws://127.0.0.1:8787";

const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("OPEN", url);
  console.log("Type JSON and press Enter. Ctrl+C to exit.");
});

ws.on("message", (data) => {
  const raw = typeof data === "string" ? data : data.toString("utf8");
  console.log("IN", raw);
});

ws.on("close", () => console.log("CLOSED"));
ws.on("error", (e) => console.error("WS ERROR", e));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  ws.send(trimmed);
  console.log("OUT", trimmed);
});
