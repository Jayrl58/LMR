import { useMemo } from "react";
import type { LobbyGameConfigView, LobbyPlayerView, LobbyViewState } from "./parsers";
import { sendMessage, setStoredRoomCode } from "./useClientSession";

export type LobbySeatRow = {
  seat: number;
  color: string;
  playerId: string;
  ready: boolean;
  occupied: boolean;
};

const MAX_LOBBY_SEATS = 8;

function buildLobbySeatRows(
  lobby: LobbyViewState | null,
  getColorForSeat: (seat: number) => string
): LobbySeatRow[] {
  const playerBySeat = new Map<number, LobbyPlayerView>();
  (lobby?.players ?? []).forEach((player) => {
    playerBySeat.set(player.seat, player);
  });

  return Array.from({ length: MAX_LOBBY_SEATS }, (_, seat) => {
    const player = playerBySeat.get(seat);
    return {
      seat,
      color: getColorForSeat(seat),
      playerId: player?.playerId ?? "",
      ready: player?.ready ?? false,
      occupied: !!player,
    };
  });
}

type Params = {
  wsRef: React.MutableRefObject<WebSocket | null>;
  lobby: LobbyViewState | null;
  roomCodeInput: string;
  setPlayerId: (value: string) => void;
  setPhase: (value: string) => void;
  setRoomCode: (value: string) => void;
  setJoinedRoom: (value: boolean) => void;
  setLobby: (value: LobbyViewState | null) => void;
  setGameState: (value: any) => void;
  setGameOverResult: (value: any) => void;
  setPendingDice: (value: any[]) => void;
  setBankedDice: (value: number) => void;
  setExpectedRollCount: (value: number) => void;
  setRollValues: (value: string[]) => void;
  setLocalRolledDice: (value: number[]) => void;
  setLegalMoveOptions: (value: any[]) => void;
  setRawLegalMoves: (value: any[]) => void;
  setSelectedDie: (value: string) => void;
  setSelectedPegId: (value: string | null) => void;
  getColorForSeat: (seat: number) => string;
};

export function useLobbyController(params: Params) {
  const {
    wsRef,
    lobby,
    roomCodeInput,
    setPlayerId,
    setPhase,
    setRoomCode,
    setJoinedRoom,
    setLobby,
    setGameState,
    setGameOverResult,
    setPendingDice,
    setBankedDice,
    setExpectedRollCount,
    setRollValues,
    setLocalRolledDice,
    setLegalMoveOptions,
    setRawLegalMoves,
    setSelectedDie,
    setSelectedPegId,
    getColorForSeat,
  } = params;

  const seatRows = useMemo(() => buildLobbySeatRows(lobby, getColorForSeat), [lobby, getColorForSeat]);

  const resetClientGameState = () => {
    setPlayerId("");
    setPhase("lobby");
    setRoomCode("");
    setJoinedRoom(false);
    setLobby(null);
    setGameState(null);
    setGameOverResult(null);
    setPendingDice([]);
    setBankedDice(0);
    setExpectedRollCount(0);
    setRollValues([]);
    setLocalRolledDice([]);
    setLegalMoveOptions([]);
    setRawLegalMoves([]);
    setSelectedDie("");
    setSelectedPegId(null);
  };

  const handleCreateRoom = () => {
    resetClientGameState();
    setStoredRoomCode("");
    sendMessage(wsRef.current, { type: "joinRoom" });
  };

  const handleJoinRoom = () => {
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (!trimmed) return;

    resetClientGameState();
    setRoomCode(trimmed);
    setStoredRoomCode(trimmed);
    sendMessage(wsRef.current, { type: "joinRoom", roomCode: trimmed });
  };

  const handleReady = () => {
    sendMessage(wsRef.current, { type: "setReady", ready: true });
  };

  const handleNotReady = () => {
    sendMessage(wsRef.current, { type: "setReady", ready: false });
  };

  const handleStartGame = () => {
    const playerCount =
      lobby?.gameConfig?.playerCount ??
      lobby?.expectedPlayerCount ??
      Math.max(lobby?.players.length ?? 0, 4);

    sendMessage(wsRef.current, { type: "startGame", playerCount });
  };

  const handleUpdateGameConfig = (patch: Partial<LobbyGameConfigView>) => {
    const seatedCount = lobby?.players.length ?? 0;
    const playerCount =
      patch.playerCount ??
      lobby?.gameConfig?.playerCount ??
      lobby?.expectedPlayerCount ??
      Math.max(seatedCount, 4);

    sendMessage(wsRef.current, {
      type: "setLobbyGameConfig",
      gameConfig: {
        playerCount,
        ...(lobby?.gameConfig ?? {}),
        ...patch,
      },
    });
  };

  return {
    seatRows,
    handleCreateRoom,
    handleJoinRoom,
    handleReady,
    handleNotReady,
    handleStartGame,
    handleUpdateGameConfig,
  };
}
