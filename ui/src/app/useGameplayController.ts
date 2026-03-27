import { useMemo } from "react";
import type { BoardHolePlacement, DestinationHighlight } from "../components/BoardRenderer";
import type { GameState } from "../../src/types";
import type { PendingDieView, LegalMoveOption, SupportedArms } from "./parsers";
import { sendMessage } from "./useClientSession";

type Params = {
  wsRef: React.MutableRefObject<WebSocket | null>;
  playerId: string;
  gameState: GameState | null;
  gameOverResult: any;
  pendingDice: PendingDieView[];
  selectedDie: string;
  setSelectedDie: (v: string) => void;
  selectedPegId: string | null;
  setSelectedPegId: (v: string | null) => void;
  legalMoveOptions: LegalMoveOption[];
  setLatestStatusText: (v: string) => void;
  normalizeArms: (n: number) => SupportedArms;
  getCurrentTurnPlayerId: (gs: GameState) => string;
  getPendingDieControllerId: (pd: PendingDieView[], v: string) => string | null | undefined;
  parseRollValues: (vals: string[]) => number[];
  resizeRollValues: (prev: string[], next: number) => string[];
  parseMove: (opt: LegalMoveOption) => any;
  findMoveForDestination: (
    opts: LegalMoveOption[],
    die: string,
    pegId: string | null,
    hole: BoardHolePlacement,
    fallback: string,
    arms: SupportedArms
  ) => LegalMoveOption | null;
  buildDestinationHighlights: (
    opts: LegalMoveOption[],
    die: string,
    pegId: string | null,
    fallback: string,
    arms: SupportedArms
  ) => DestinationHighlight[];
};

export function useGameplayController(p: Params) {
  const {
    wsRef,
    playerId,
    gameState,
    gameOverResult,
    pendingDice,
    selectedDie,
    setSelectedDie,
    selectedPegId,
    setSelectedPegId,
    legalMoveOptions,
    setLatestStatusText,
    normalizeArms,
    getCurrentTurnPlayerId,
    getPendingDieControllerId,
    parseRollValues,
    resizeRollValues,
    parseMove,
    findMoveForDestination,
    buildDestinationHighlights,
  } = p;

  const selectedDieControllerId = getPendingDieControllerId(pendingDice, selectedDie);

  const movablePegIds = useMemo(() => {
    if (gameOverResult) return [];
    const selectedDieValue = Number(selectedDie);
    if (!Number.isInteger(selectedDieValue)) return [];
    const ids = new Set<string>();
    legalMoveOptions.forEach((option) => {
      if (option.dice.length > 0 && !option.dice.includes(selectedDieValue)) return;
      const move = parseMove(option);
      if (!move) return;
      const playerId =
        typeof move.playerId === "string"
          ? move.playerId
          : typeof move.actorPlayerId === "string"
            ? move.actorPlayerId
            : typeof move.ownerPlayerId === "string"
              ? move.ownerPlayerId
              : null;
      const pegIndex =
        typeof move.pegIndex === "number" && Number.isInteger(move.pegIndex)
          ? move.pegIndex
          : null;
      if (!playerId || pegIndex === null) return;
      ids.add(`${playerId}-${pegIndex}`);
    });
    return Array.from(ids);
  }, [legalMoveOptions, selectedDie, gameOverResult, parseMove]);

  const destinationHighlights = useMemo(() => {
    if (!gameState) return [];
    if (!selectedPegId) return [];
    if (gameOverResult) return [];
    const fallbackPlayerId = playerId || getCurrentTurnPlayerId(gameState);
    return buildDestinationHighlights(
      legalMoveOptions,
      selectedDie,
      selectedPegId,
      fallbackPlayerId,
      normalizeArms(gameState.config.playerCount)
    );
  }, [gameState, legalMoveOptions, selectedDie, selectedPegId, playerId, gameOverResult, buildDestinationHighlights, normalizeArms, getCurrentTurnPlayerId]);

  const handleSelectDie = (dieValue: string) => {
    if (gameOverResult) return;

    setSelectedDie(dieValue);
    setSelectedPegId(null);

    if (!gameState) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    const dieControllerId = getPendingDieControllerId(pendingDice, dieValue);
    const actingActorId =
      typeof dieControllerId === "string" && dieControllerId
        ? dieControllerId
        : currentTurnPlayerId;

    if (!actingActorId || actingActorId !== playerId) return;

    const parsedDie = Number(dieValue);
    if (!Number.isInteger(parsedDie)) return;

    sendMessage(wsRef.current, {
      type: "getLegalMoves",
      actorId: actingActorId,
      die: parsedDie,
    });
  };

  const handleDestinationClick = (hole: BoardHolePlacement) => {
    if (!gameState || gameOverResult) return;

    const currentTurnPlayerId = getCurrentTurnPlayerId(gameState);
    const actingActorId =
      typeof selectedDieControllerId === "string" && selectedDieControllerId
        ? selectedDieControllerId
        : currentTurnPlayerId;

    if (!actingActorId || actingActorId !== playerId) return;

    if (pendingDice.length > 1 && !selectedDie) {
      setLatestStatusText("Select a die first");
      return;
    }

    if (!selectedPegId) {
      setLatestStatusText("Select a peg first");
      return;
    }

    const chosen = findMoveForDestination(
      legalMoveOptions,
      selectedDie,
      selectedPegId,
      hole,
      playerId || actingActorId,
      normalizeArms(gameState.config.playerCount)
    );

    if (!chosen) {
      setLatestStatusText("Clicked hole is not a legal destination for the selected peg");
      return;
    }

    const parsedMove = parseMove(chosen);
    if (!parsedMove) {
      setLatestStatusText("Could not parse legal move");
      return;
    }

    sendMessage(wsRef.current, {
      type: "move",
      actorId: actingActorId,
      dice: [Number(selectedDie)],
      move: parsedMove,
    });
    setSelectedPegId(null);
  };

  const handlePegClick = (pegId: string) => {
    if (gameOverResult) return;
    setSelectedPegId((current) => (current === pegId ? null : pegId));
  };

  const handleBackgroundClick = () => {
    if (gameOverResult) return;
    setSelectedPegId(null);
  };

  const canForfeitPendingDice =
    !!gameState &&
    !gameOverResult &&
    playerId !== "" &&
    playerId === getCurrentTurnPlayerId(gameState) &&
    pendingDice.length > 0 &&
    selectedDie !== "" &&
    pendingDice.some((die) => String(die.value) === selectedDie) &&
    legalMoveOptions.length === 0;

  return {
    movablePegIds,
    destinationHighlights,
    handleSelectDie,
    handleDestinationClick,
    handlePegClick,
    handleBackgroundClick,
    canForfeitPendingDice,
  };
}
