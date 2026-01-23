// src/ui/index.ts

import { initialUiModel, UiModel } from "./uiState.js";

// UI Loop v0 entry point.
// Applies server messages to the UI model (no rendering/framework yet).

type WelcomeMsg = {
  type: "welcome";
  clientId?: string;
  serverVersion?: string;
};

type RoomJoinedMsg = {
  type: "roomJoined";
  roomCode: string;
  clientId: string;
  playerId: string;
};

type LobbySyncMsg = {
  type: "lobbySync";
  lobby: {
    roomCode: string;
    phase: "lobby" | "active";
    expectedPlayerCount?: number;
    players: Array<{
      playerId: string;
      clientId: string;
      seat: number;
      ready: boolean;
    }>;
  };
};

type StateSyncMsg = {
  type: "stateSync";
  roomCode: string;
  state: unknown;
  stateHash: string;
  turn: {
    nextActorId: string;
    dicePolicy: "external";
    awaitingDice: boolean;
  };
};

// UPDATED: Accept either legacy {die:number} or multi-dice {dice:number[]}
type LegalMovesMsg = {
  type: "legalMoves";
  roomCode: string;
  actorId: string;
  die?: number; // legacy
  dice?: number[]; // preferred
  moves: readonly unknown[];
};

type MoveResultMsg = {
  type: "moveResult";
  roomCode: string;
  response: {
    ok: boolean;
    result?: {
      nextState?: unknown;
      afterHash?: string;
    };
    error?: { code: string; message: string };
    turn?: {
      nextActorId: string;
      dicePolicy: "external";
      awaitingDice: boolean;
    };
  };
};

type ErrorMsg = {
  type: "error";
  code: string;
  message: string;
  reqId?: string;
};

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function parseJsonIfString(x: unknown): unknown {
  if (typeof x !== "string") return x;
  try {
    return JSON.parse(x);
  } catch {
    return x;
  }
}

function extractPlayersFromState(state: unknown): Array<{ playerId: string; seat: number }> {
  if (!isObject(state)) return [];
  const players = state["players"];
  if (!isObject(players)) return [];

  const out: Array<{ playerId: string; seat: number }> = [];
  for (const key of Object.keys(players)) {
    const p = (players as Record<string, unknown>)[key];
    if (!isObject(p)) continue;
    const playerId = p["playerId"];
    const seat = p["seat"];
    if (typeof playerId === "string" && typeof seat === "number") {
      out.push({ playerId, seat });
    }
  }
  return out;
}

function normalizeSelectedDice(lm: LegalMovesMsg): number[] | undefined {
  if (Array.isArray(lm.dice) && lm.dice.every((n) => typeof n === "number")) {
    return lm.dice.slice();
  }
  if (typeof lm.die === "number") {
    return [lm.die];
  }
  return undefined;
}

export class UiController {
  private model: UiModel;

  constructor() {
    this.model = initialUiModel;
  }

  getState(): UiModel {
    return this.model;
  }

  applyServerMessage(msg: unknown): void {
    if (!isObject(msg)) return;
    const type = msg["type"];
    if (typeof type !== "string") return;

    if (type === "welcome") {
      const w = msg as WelcomeMsg;
      this.model = {
        ...this.model,
        connection: {
          ...this.model.connection,
          connected: true,
          clientId: typeof w.clientId === "string" ? w.clientId : this.model.connection.clientId,
        },
      };
      return;
    }

    if (type === "roomJoined") {
      const j = msg as RoomJoinedMsg;
      this.model = {
        ...this.model,
        connection: {
          ...this.model.connection,
          roomCode: j.roomCode,
          clientId: j.clientId,
        },
        localActorId: j.playerId,
      };
      return;
    }

    if (type === "lobbySync") {
      const l = msg as LobbySyncMsg;
      this.model = {
        ...this.model,
        lobby: {
          phase: l.lobby.phase,
          expectedPlayerCount: l.lobby.expectedPlayerCount,
          players: l.lobby.players.map((p) => ({
            playerId: p.playerId,
            clientId: p.clientId,
            seat: p.seat,
            ready: p.ready,
          })),
        },
      };
      return;
    }

    if (type === "stateSync") {
      const s = msg as StateSyncMsg;
      const parsedState = parseJsonIfString(s.state);

      const players = extractPlayersFromState(parsedState);
      // Derive localSeat (if possible) by matching localActorId to players list.
      const localActorId = this.model.localActorId;
      const found = localActorId ? players.find((p) => p.playerId === localActorId) : undefined;

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
        localSeat: found?.seat ?? this.model.localSeat,
        turnInteraction: { ...this.model.turnInteraction, lastError: undefined },
      };
      return;
    }

    if (type === "legalMoves") {
      const lm = msg as LegalMovesMsg;
      if (!Array.isArray(lm.moves)) return;

      const selectedDice = normalizeSelectedDice(lm);
      if (!selectedDice) return;

      this.model = {
        ...this.model,
        turnInteraction: {
          ...this.model.turnInteraction,
          selectedDice,
          legalMoves: lm.moves,
          lastError: undefined,
        },
      };
      return;
    }

    if (type === "moveResult") {
      const mr = msg as MoveResultMsg;
      const resp = mr.response;
      if (!resp || typeof resp.ok !== "boolean") return;

      if (resp.ok && resp.result && resp.result.nextState !== undefined) {
        const parsedNext = parseJsonIfString(resp.result.nextState);

        this.model = {
          ...this.model,
          game: {
            ...this.model.game,
            gameState: parsedNext,
            stateHash:
              typeof resp.result.afterHash === "string" ? resp.result.afterHash : this.model.game.stateHash,
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
            selectedDice: undefined,
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
      return;
    }

    if (type === "error") {
      const e = msg as ErrorMsg;
      if (typeof e.code !== "string" || typeof e.message !== "string") return;
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
