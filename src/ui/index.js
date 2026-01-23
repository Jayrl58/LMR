// src/ui/index.ts
import { initialUiModel } from "./uiState.js";
function isObject(x) {
    return !!x && typeof x === "object";
}
function parseJsonIfString(x) {
    if (typeof x !== "string")
        return x;
    try {
        return JSON.parse(x);
    }
    catch {
        return x;
    }
}
function extractPlayersFromState(state) {
    if (!isObject(state))
        return [];
    const players = state["players"];
    if (!isObject(players))
        return [];
    const out = [];
    for (const key of Object.keys(players)) {
        const p = players[key];
        if (!isObject(p))
            continue;
        const playerId = p["playerId"];
        const seat = p["seat"];
        if (typeof playerId === "string" && typeof seat === "number") {
            out.push({ playerId, seat });
        }
    }
    return out;
}
export class UiController {
    model;
    constructor() {
        this.model = initialUiModel;
    }
    getState() {
        return this.model;
    }
    handleServerMessage(msg) {
        if (!isObject(msg))
            return;
        const type = msg["type"];
        if (type === "welcome") {
            const w = msg;
            this.model = {
                ...this.model,
                connection: {
                    ...this.model.connection,
                    connected: true,
                    clientId: typeof w.clientId === "string" ? w.clientId : this.model.connection.clientId,
                },
                turnInteraction: { ...this.model.turnInteraction, lastError: undefined },
            };
            return;
        }
        if (type === "roomJoined") {
            const r = msg;
            if (typeof r.roomCode !== "string")
                return;
            this.model = {
                ...this.model,
                connection: {
                    ...this.model.connection,
                    roomCode: r.roomCode,
                    clientId: typeof r.clientId === "string" ? r.clientId : this.model.connection.clientId,
                },
                turnInteraction: {},
                localSeat: undefined,
                localActorId: undefined,
            };
            return;
        }
        if (type === "lobbySync") {
            const l = msg;
            if (!l.lobby || typeof l.lobby.phase !== "string")
                return;
            const players = Array.isArray(l.lobby.players) ? l.lobby.players : [];
            const mappedPlayers = players
                .filter((p) => p &&
                typeof p.playerId === "string" &&
                typeof p.clientId === "string" &&
                typeof p.seat === "number" &&
                typeof p.ready === "boolean")
                .map((p) => ({
                playerId: p.playerId,
                clientId: p.clientId,
                seat: p.seat,
                ready: p.ready,
            }));
            const localClientId = this.model.connection.clientId;
            const localSeat = typeof localClientId === "string"
                ? mappedPlayers.find((p) => p.clientId === localClientId)?.seat
                : undefined;
            this.model = {
                ...this.model,
                lobby: {
                    phase: l.lobby.phase,
                    players: mappedPlayers,
                    expectedPlayerCount: typeof l.lobby.expectedPlayerCount === "number" ? l.lobby.expectedPlayerCount : undefined,
                },
                localSeat: typeof localSeat === "number" ? localSeat : this.model.localSeat,
            };
            return;
        }
        if (type === "stateSync") {
            const s = msg;
            if (typeof s.stateHash !== "string" || !s.turn)
                return;
            const parsedState = parseJsonIfString(s.state);
            let localActorId = this.model.localActorId;
            if (typeof this.model.localSeat === "number") {
                const ps = extractPlayersFromState(parsedState);
                const match = ps.find((p) => p.seat === this.model.localSeat);
                if (match)
                    localActorId = match.playerId;
            }
            this.model = {
                ...this.model,
                game: {
                    ...this.model.game,
                    gameState: parsedState,
                    stateHash: s.stateHash,
                    turn: {
                        nextActorId: s.turn.nextActorId,
                        dicePolicy: s.turn.dicePolicy,
                        awaitingDice: s.turn.awaitingDice,
                    },
                },
                localActorId,
                turnInteraction: { ...this.model.turnInteraction, lastError: undefined },
            };
            return;
        }
        if (type === "legalMoves") {
            const lm = msg;
            if (typeof lm.die !== "number" || !Array.isArray(lm.moves))
                return;
            this.model = {
                ...this.model,
                turnInteraction: {
                    ...this.model.turnInteraction,
                    selectedDie: lm.die,
                    legalMoves: lm.moves,
                    lastError: undefined,
                },
            };
            return;
        }
        if (type === "moveResult") {
            const mr = msg;
            const resp = mr.response;
            if (!resp || typeof resp.ok !== "boolean")
                return;
            if (resp.ok && resp.result && resp.result.nextState !== undefined) {
                const parsedNext = parseJsonIfString(resp.result.nextState);
                this.model = {
                    ...this.model,
                    game: {
                        ...this.model.game,
                        gameState: parsedNext,
                        stateHash: typeof resp.result.afterHash === "string" ? resp.result.afterHash : this.model.game.stateHash,
                        turn: resp.turn
                            ? {
                                nextActorId: resp.turn.nextActorId,
                                dicePolicy: resp.turn.dicePolicy,
                                awaitingDice: resp.turn.awaitingDice,
                            }
                            : this.model.game.turn,
                    },
                    turnInteraction: {
                        ...this.model.turnInteraction,
                        lastMoveResult: resp,
                        lastError: undefined,
                        legalMoves: undefined,
                        selectedDie: undefined,
                    },
                };
                return;
            }
            if (!resp.ok && resp.error) {
                this.model = {
                    ...this.model,
                    turnInteraction: {
                        ...this.model.turnInteraction,
                        lastMoveResult: resp,
                        lastError: { code: resp.error.code, message: resp.error.message },
                    },
                };
                return;
            }
            this.model = {
                ...this.model,
                turnInteraction: { ...this.model.turnInteraction, lastMoveResult: resp },
            };
            return;
        }
        if (type === "error") {
            const e = msg;
            if (typeof e.code !== "string" || typeof e.message !== "string")
                return;
            this.model = {
                ...this.model,
                turnInteraction: {
                    ...this.model.turnInteraction,
                    lastError: { code: e.code, message: e.message },
                },
            };
            return;
        }
    }
}
export function createUiController() {
    return new UiController();
}
