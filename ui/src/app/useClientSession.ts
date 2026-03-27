import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type { GameState } from "../../../src/types";
import {
  computeExpectedRollCountForUi,
  isGameState,
  parseBankedDice,
  parseDiceList,
  parseJsonIfString,
  parseLegalMoveOptions,
  parseLobbyState,
  parsePendingDice,
  parsePendingDiceFromTurn,
  resizeRollValues,
} from "./parsers";

const WS_URL = "ws://127.0.0.1:8787";
const CLIENT_ID_STORAGE_KEY = "lmr_client_id_v1";
const ROOM_CODE_STORAGE_KEY = "lmr_room_code_v1";

export function sendMessage(ws: WebSocket | null, payload: Record<string, unknown>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "client-server-render";

  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing && existing.trim()) return existing;

  let generated = "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    generated = crypto.randomUUID();
  } else {
    generated =
      "client-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36);
  }

  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

export function getStoredRoomCode(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ROOM_CODE_STORAGE_KEY) ?? "";
}

export function setStoredRoomCode(roomCode: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, roomCode);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function mergeTurnIntoGameState(gameState: GameState, turnOverride: unknown): GameState {
  if (!isObject(turnOverride)) return gameState;
  return {
    ...gameState,
    turn: {
      ...(isObject(gameState.turn) ? gameState.turn : {}),
      ...turnOverride,
    },
  };
}

export type GameOverResult =
  | {
      mode: "solo";
      winner: {
        playerId: string;
        name: string;
        color: string;
      };
    }
  | {
      mode: "team";
      winners: Array<{
        playerId: string;
        name: string;
        color: string;
      }>;
    };

export type PendingDieView = {
  value: number;
  controllerId: string | null;
};

export type LegalMoveOption = {
  label: string;
  value: string;
  dice: number[];
};

export type RawLegalMove = unknown;

type SessionParams = {
  getColorForSeat: (seat: number) => string;
  gameState: GameState | null;
  playerId: string;
  setPlayerId: Dispatch<SetStateAction<string>>;
  setPhase: Dispatch<SetStateAction<string>>;
  setRoomCode: Dispatch<SetStateAction<string>>;
  setRoomCodeInput: Dispatch<SetStateAction<string>>;
  setJoinedRoom: Dispatch<SetStateAction<boolean>>;
  setLobby: Dispatch<SetStateAction<any>>;
  setGameState: Dispatch<SetStateAction<GameState | null>>;
  setGameOverResult: Dispatch<SetStateAction<GameOverResult | null>>;
  setSelectedDie: Dispatch<SetStateAction<string>>;
  setPendingDice: Dispatch<SetStateAction<PendingDieView[]>>;
  setBankedDice: Dispatch<SetStateAction<number>>;
  setExpectedRollCount: Dispatch<SetStateAction<number>>;
  setRollValues: Dispatch<SetStateAction<string[]>>;
  setLocalRolledDice: Dispatch<SetStateAction<number[]>>;
  setLegalMoveOptions: Dispatch<SetStateAction<LegalMoveOption[]>>;
  setRawLegalMoves: Dispatch<SetStateAction<RawLegalMove[]>>;
  setSelectedPegId: Dispatch<SetStateAction<string | null>>;
  setLatestMessageType: Dispatch<SetStateAction<string>>;
  setLatestStatusText: Dispatch<SetStateAction<string>>;
};

export function useClientSession(params: SessionParams): {
  wsRef: MutableRefObject<WebSocket | null>;
  connected: boolean;
} {
  const {
    getColorForSeat,
    gameState,
    playerId,
    setPlayerId,
    setPhase,
    setRoomCode,
    setRoomCodeInput,
    setJoinedRoom,
    setLobby,
    setGameState,
    setGameOverResult,
    setSelectedDie,
    setPendingDice,
    setBankedDice,
    setExpectedRollCount,
    setRollValues,
    setLocalRolledDice,
    setLegalMoveOptions,
    setRawLegalMoves,
    setSelectedPegId,
    setLatestMessageType,
    setLatestStatusText,
  } = params;

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const clientId = getOrCreateClientId();
      sendMessage(ws, { type: "hello", clientId });
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setLatestMessageType(typeof message.type === "string" ? message.type : "");

      if (message.type === "roomJoined") {
        if (typeof message.playerId === "string") setPlayerId(message.playerId);
        if (typeof message.roomCode === "string") {
          setRoomCode(message.roomCode);
          setRoomCodeInput(message.roomCode);
          setStoredRoomCode(message.roomCode);
        }
        setJoinedRoom(true);
        setGameOverResult(null);
        setLatestStatusText(`Joined room ${typeof message.roomCode === "string" ? message.roomCode : ""}`.trim());
      }

      if (message.type === "lobbySync") {
        const parsedLobby = parseLobbyState(message.lobby);
        if (parsedLobby) {
          setLobby(parsedLobby);
          setPhase(parsedLobby.phase);
          if (parsedLobby.roomCode) {
            setRoomCode(parsedLobby.roomCode);
            setRoomCodeInput(parsedLobby.roomCode);
            setStoredRoomCode(parsedLobby.roomCode);
          }
        }
        setGameOverResult(null);
        setLatestStatusText("Lobby synchronized");
      }

      if (message.type === "stateSync") {
        const parsedState = parseJsonIfString(message.state);
        if (isGameState(parsedState)) {
          const turnEnvelope = isObject(message.turn) ? message.turn : (parsedState.turn as unknown);
          const mergedState = mergeTurnIntoGameState(parsedState, turnEnvelope);

          setGameState(mergedState);
          setPhase(mergedState.phase);
          setPendingDice(parsePendingDiceFromTurn(turnEnvelope));
          setBankedDice(parseBankedDice(turnEnvelope));
          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setLocalRolledDice([]);
          setSelectedDie("");
          setSelectedPegId(null);

          const nextExpectedRollCount =
            typeof message.expectedRollCount === "number" && Number.isInteger(message.expectedRollCount)
              ? message.expectedRollCount
              : computeExpectedRollCountForUi(mergedState, turnEnvelope);
          setExpectedRollCount(nextExpectedRollCount);
          setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));
        } else {
          setPendingDice([]);
          setBankedDice(0);
          setExpectedRollCount(0);
          setRollValues([]);
          setLocalRolledDice([]);
        }

        setLatestStatusText("Game state synchronized");
      }

      if (message.type === "gameOver") {
        const result = message.result;
        if (isObject(result) && result.mode === "solo" && isObject(result.winner)) {
          const winner = result.winner;
          if (
            typeof winner.playerId === "string" &&
            typeof winner.name === "string"
          ) {
            const fallbackSeat = Number(String(winner.playerId).replace(/^p/, ""));
            const fallbackColor =
              Number.isInteger(fallbackSeat) && fallbackSeat >= 0
                ? getColorForSeat(fallbackSeat)
                : getColorForSeat(0);

            setGameOverResult({
              mode: "solo",
              winner: {
                playerId: winner.playerId,
                name: winner.name,
                color: typeof winner.color === "string" && winner.color.trim() ? winner.color : fallbackColor,
              },
            });
          }
        } else if (isObject(result) && result.mode === "team" && Array.isArray(result.winners)) {
          const winners = result.winners
            .map((winner) => {
              if (!isObject(winner)) return null;
              if (
                typeof winner.playerId !== "string" ||
                typeof winner.name !== "string"
              ) {
                return null;
              }

              const fallbackSeat = Number(String(winner.playerId).replace(/^p/, ""));
              const fallbackColor =
                Number.isInteger(fallbackSeat) && fallbackSeat >= 0
                  ? getColorForSeat(fallbackSeat)
                  : getColorForSeat(0);

              return {
                playerId: winner.playerId,
                name: winner.name,
                color:
                  typeof winner.color === "string" && winner.color.trim() ? winner.color : fallbackColor,
              };
            })
            .filter((winner): winner is { playerId: string; name: string; color: string } => !!winner);

          setGameOverResult({
            mode: "team",
            winners,
          });
        }
        setLatestStatusText("Game Over");
      }

      if (message.type === "legalMoves") {
        const rawMoves = Array.isArray(message.moves)
          ? message.moves
          : Array.isArray(message.legalMoves)
            ? message.legalMoves
            : [];
        setRawLegalMoves(rawMoves);
        setLegalMoveOptions(parseLegalMoveOptions(rawMoves));

        const turnEnvelope = isObject(message.turn) ? message.turn : null;
        if (turnEnvelope) {
          setPendingDice(parsePendingDiceFromTurn(turnEnvelope));
          setBankedDice(parseBankedDice(turnEnvelope));

          if (
            typeof message.expectedRollCount === "number" &&
            Number.isInteger(message.expectedRollCount)
          ) {
            setExpectedRollCount(message.expectedRollCount);
            setRollValues((current) =>
              resizeRollValues(current, message.expectedRollCount)
            );
          } else if (gameState) {
            const nextExpectedRollCount = computeExpectedRollCountForUi(gameState, turnEnvelope);
            setExpectedRollCount(nextExpectedRollCount);
            setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));
          }
        } else {
          const dice = parseDiceList(message.dice);
          if (dice.length > 0) {
            setPendingDice((current) =>
              current.length === 0 ? dice.map((die) => ({ value: die, controllerId: null })) : current
            );
          }
        }

        setLocalRolledDice([]);

        setLatestStatusText(
          Array.isArray(rawMoves) && rawMoves.length > 0
            ? `Received ${rawMoves.length} legal moves`
            : "No legal moves returned"
        );
      }

      if (message.type === "moveResult") {
        const response = message.response;

        const nextStateCandidate = response?.result?.nextState ?? response?.nextState ?? null;

        if (isGameState(nextStateCandidate)) {
          const nextTurn = response?.turn ?? response?.result?.turn ?? null;
          const mergedState = mergeTurnIntoGameState(nextStateCandidate, nextTurn);

          setGameState(mergedState);
          setPhase(mergedState.phase);

          if (nextTurn && typeof nextTurn === "object" && Array.isArray((nextTurn as any).pendingDice)) {
            setBankedDice(parseBankedDice(nextTurn));
            const rawPending = (nextTurn as any).pendingDice as Array<any>;
            setPendingDice(
              rawPending
                .map((pd) => {
                  if (typeof pd === "number") {
                    return { value: pd, controllerId: null };
                  }
                  if (!pd || typeof pd !== "object") return null;
                  if (!Number.isInteger((pd as any).value)) return null;
                  return {
                    value: (pd as any).value,
                    controllerId:
                      typeof (pd as any).controllerId === "string" ? (pd as any).controllerId : null,
                  };
                })
                .filter(Boolean) as PendingDieView[]
            );
          } else {
            setPendingDice(parsePendingDice(mergedState));
            setBankedDice(parseBankedDice(mergedState.turn as unknown));
          }

          const nextExpectedRollCount = computeExpectedRollCountForUi(mergedState, nextTurn);
          setExpectedRollCount(nextExpectedRollCount);
          setRollValues((current) => resizeRollValues(current, nextExpectedRollCount));

          setLegalMoveOptions([]);
          setRawLegalMoves([]);
          setSelectedDie("");
          setSelectedPegId(null);
        }

        setLatestStatusText("Move applied");
      }

      if (message.type === "error") {
        setLocalRolledDice([]);
        setLatestStatusText(typeof message.message === "string" ? message.message : "Server error");
      }

      if (typeof message.message === "string" && message.type !== "error") {
        setLatestStatusText(message.message);
      }
    };

    return () => ws.close();
  }, []);

  return { wsRef, connected };
}
