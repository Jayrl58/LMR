// src/ui/wsTextClient.ts
//
// Text UI driver for UI Loop v0.
// Uses runtime require('ws') so TypeScript does not need ws type declarations.
import { createRequire } from "node:module";
import { createUiController } from "./index.js";
const require = createRequire(import.meta.url);
const wsPkg = require("ws");
const WebSocketCtor = wsPkg.default ?? wsPkg;
function send(ws, msg) {
    ws.send(JSON.stringify(msg));
}
function nowReqId(prefix) {
    return `${prefix}-${Date.now()}`;
}
function render(model) {
    const connected = !!model?.connection?.connected;
    const clientId = model?.connection?.clientId;
    const roomCode = model?.connection?.roomCode;
    const phase = model?.lobby?.phase;
    const expected = model?.lobby?.expectedPlayerCount;
    const localSeat = model?.localSeat;
    const localActorId = model?.localActorId;
    const turn = model?.game?.turn;
    const nextActorId = turn?.nextActorId;
    const awaitingDice = turn?.awaitingDice;
    const selectedDie = model?.turnInteraction?.selectedDie;
    const moves = model?.turnInteraction?.legalMoves;
    const moveCount = Array.isArray(moves) ? moves.length : 0;
    const lastErr = model?.turnInteraction?.lastError;
    const lastMoveOk = model?.turnInteraction?.lastMoveResult?.ok;
    console.log("\n--- UI STATE ---");
    console.log("connected:", connected, "clientId:", clientId, "room:", roomCode);
    console.log("lobby:", phase, "expected:", expected, "localSeat:", localSeat, "localActorId:", localActorId);
    console.log("turn:", "nextActorId:", nextActorId, "awaitingDice:", awaitingDice);
    console.log("die:", selectedDie, "legalMoves:", moveCount, "lastMoveOk:", lastMoveOk);
    if (lastErr)
        console.log("ERROR:", lastErr.code, "-", lastErr.message);
    if (moveCount > 0) {
        console.log("moves:");
        for (let i = 0; i < Math.min(moveCount, 10); i++) {
            const m = moves[i];
            const id = m?.id ?? "(no id)";
            const kind = m?.kind ?? "(no kind)";
            const captures = Array.isArray(m?.captures) ? m.captures.length : 0;
            console.log(`  [${i}] ${id} kind=${kind} captures=${captures}`);
        }
        if (moveCount > 10)
            console.log(`  ... (${moveCount - 10} more)`);
    }
}
function promptOnce(question) {
    return new Promise((resolve) => {
        process.stdout.write(question);
        process.stdin.resume();
        process.stdin.once("data", (d) => resolve(String(d).trim()));
    });
}
async function main() {
    const WS_URL = process.env.LMR_WS_URL ?? "ws://127.0.0.1:8787";
    const CLIENT_ID = process.env.LMR_CLIENT_ID ?? `ui-text-${Math.floor(Math.random() * 10000)}`;
    const ui = createUiController();
    const ws = new WebSocketCtor(WS_URL);
    ws.on("open", () => {
        console.log("CONNECTED to", WS_URL);
        send(ws, { type: "hello", clientId: CLIENT_ID, reqId: nowReqId("hello") });
        send(ws, { type: "joinRoom", reqId: nowReqId("join") });
        send(ws, { type: "setReady", ready: true, reqId: nowReqId("ready") });
        send(ws, { type: "startGame", playerCount: 1, reqId: nowReqId("start") });
    });
    ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        ui.handleServerMessage(msg);
        render(ui.getState());
        const model = ui.getState();
        const localActorId = model?.localActorId;
        const turn = model?.game?.turn;
        if (turn?.awaitingDice && localActorId && turn?.nextActorId === localActorId) {
            const raw = await promptOnce("Enter die (1-6), or 'q' to quit: ");
            if (raw.toLowerCase() === "q")
                return ws.close();
            const die = Number(raw);
            if (!Number.isFinite(die) || die < 1 || die > 6) {
                console.log("Invalid die. Enter 1-6.");
                return;
            }
            send(ws, { type: "roll", actorId: localActorId, die, reqId: nowReqId("roll") });
            send(ws, { type: "getLegalMoves", actorId: localActorId, die, reqId: nowReqId("moves") });
            return;
        }
        const moves = model?.turnInteraction?.legalMoves;
        if (localActorId && Array.isArray(moves) && moves.length > 0) {
            const raw = await promptOnce(`Choose move index (0-${moves.length - 1}), or 'c' to cancel: `);
            if (raw.toLowerCase() === "c")
                return;
            const idx = Number(raw);
            if (!Number.isFinite(idx) || idx < 0 || idx >= moves.length) {
                console.log("Invalid index.");
                return;
            }
            const chosen = moves[idx];
            const die = model?.turnInteraction?.selectedDie;
            send(ws, { type: "move", actorId: localActorId, dice: [die], move: chosen, reqId: nowReqId("move") });
            return;
        }
    });
    ws.on("close", () => console.log("CLOSED"));
    ws.on("error", (e) => console.error("WS ERROR:", e?.message ?? e));
}
main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
});
