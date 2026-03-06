// src/ui/simulate.ts
//
// Offline simulator for UI Loop v0.
// Note: uses explicit ".js" import so Node ESM can run the emitted JS.
import { createUiController } from "./index.js";
function log(title, obj) {
    console.log("\n===", title, "===");
    console.log(JSON.stringify(obj, null, 2));
}
const ui = createUiController();
// 1) welcome
ui.handleServerMessage({ type: "welcome", serverVersion: "lmr-ws-0.1.4", clientId: "ui-loop-v0" });
log("after welcome", ui.getState());
// 2) roomJoined
ui.handleServerMessage({
    type: "roomJoined",
    roomCode: "ABCDE1",
    clientId: "ui-loop-v0",
    playerId: "ui-loop-v0",
});
log("after roomJoined", ui.getState());
// 3) lobbySync (lobby)
ui.handleServerMessage({
    type: "lobbySync",
    lobby: {
        roomCode: "ABCDE1",
        phase: "lobby",
        players: [{ playerId: "ui-loop-v0", clientId: "ui-loop-v0", seat: 0, ready: true }],
    },
});
log("after lobbySync lobby", ui.getState());
// 4) lobbySync (active)
ui.handleServerMessage({
    type: "lobbySync",
    lobby: {
        roomCode: "ABCDE1",
        phase: "active",
        expectedPlayerCount: 1,
        players: [{ playerId: "ui-loop-v0", clientId: "ui-loop-v0", seat: 0, ready: true }],
    },
});
log("after lobbySync active", ui.getState());
// 5) stateSync
ui.handleServerMessage({
    type: "stateSync",
    roomCode: "ABCDE1",
    state: JSON.stringify({
        gameId: "g_dev",
        phase: "active",
        players: {
            p0: { playerId: "p0", seat: 0, displayName: "Player 0" },
            p1: { playerId: "p1", seat: 1, displayName: "Player 1" },
        },
        turn: { currentPlayerId: "p0", roll: { status: "idle" } },
    }),
    stateHash: "hash0",
    turn: { nextActorId: "p0", dicePolicy: "external", awaitingDice: true },
});
log("after stateSync", ui.getState());
// 6) legalMoves
ui.handleServerMessage({
    type: "legalMoves",
    roomCode: "ABCDE1",
    actorId: "p0",
    die: 1,
    moves: [{ id: "enter:p0:0:1", kind: "enter" }],
});
log("after legalMoves", ui.getState());
// 7) moveResult (success)
ui.handleServerMessage({
    type: "moveResult",
    roomCode: "ABCDE1",
    response: {
        ok: true,
        result: {
            nextState: JSON.stringify({
                gameId: "g_dev",
                phase: "active",
                players: {
                    p0: { playerId: "p0", seat: 0, displayName: "Player 0" },
                    p1: { playerId: "p1", seat: 1, displayName: "Player 1" },
                },
                pegStates: { p0: [{ pegIndex: 0, position: { zone: "track", index: 0 } }] },
            }),
            afterHash: "hash1",
        },
        turn: { nextActorId: "p0", dicePolicy: "external", awaitingDice: true },
    },
});
log("after moveResult ok", ui.getState());
