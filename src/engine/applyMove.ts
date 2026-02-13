// src/engine/applyMove.ts
//
// FULL FILE REPLACEMENT
//
// Applies a selected Move to GameState.
// IMPORTANT: Contract is { state: GameState } (matches existing server/engine callers).
//
// Adds center mechanics:
// - enterCenter: from Point on roll=1 into center (captures occupant if other player)
// - exitCenter: from center on roll=1 to any Point (captures occupant if other player)

import type { GameState, Move, PegState, PlayerId, SpotRef, TeamId } from "../types";
import { shallowCloneState, countFinishedPegs } from "./stateUtils";
import { isTeamFinished, teamFinishOrder } from "./teams";
import { validateState } from "./validateState";

function finishTargetIndex(finishedCount: number): 0 | 1 | 2 | 3 {
  const t = 3 - finishedCount;
  return t as 0 | 1 | 2 | 3;
}

function setPegPosition(
  state: GameState,
  playerId: PlayerId,
  pegIndex: number,
  position: SpotRef,
  isFinished: boolean
): void {
  const pegs = state.pegStates[playerId].map((p: PegState) =>
    p.pegIndex === pegIndex ? ({ ...p, position, isFinished } as PegState) : p
  );
  state.pegStates[playerId] = pegs;
}

function applyCaptures(state: GameState, move: Move): void {
  if ((move as any).captures?.length) {
    for (const cap of (move as any).captures as any[]) {
      setPegPosition(
        state,
        cap.victimPlayerId,
        cap.victimPegIndex,
        { zone: "base", playerId: cap.victimPlayerId },
        false
      );
    }
  }
}

export function applyMove(state: GameState, move: Move): { state: GameState } {
  const next = shallowCloneState(state);

  const finalize = (tag: string) => {
    validateState(next, `applyMove:${tag}`);
    return { state: next };
  };

  if (move.kind === "pass") {
    return finalize("pass");
  }

  // Kill is capture-only (no movement)
  if (move.kind === "kill") {
    applyCaptures(next, move);
    return finalize("kill");
  }

  // Apply captures first (victims removed from landing spot)
  applyCaptures(next, move);

  if (move.kind === "enter") {
    setPegPosition(next, move.actorPlayerId, move.pegIndex, move.to, false);
    return finalize("enter");
  }

  if (move.kind === "enterCenter") {
    setPegPosition(next, move.actorPlayerId, move.pegIndex, { zone: "center" }, false);
    return finalize("enterCenter");
  }

  if (move.kind === "exitCenter") {
    setPegPosition(next, move.actorPlayerId, move.pegIndex, move.to, false);
    return finalize("exitCenter");
  }

  if (move.kind === "advance") {
    const actor = move.actorPlayerId;

    let isFinished = false;
    if (move.to.zone === "home") {
      const finishedCount = countFinishedPegs(next, actor);
      const target = finishTargetIndex(finishedCount);
      if (move.to.index === target) {
        isFinished = true;
      }
    }

    setPegPosition(next, actor, move.pegIndex, move.to, isFinished);

    if (isFinished) {
      const nowFinishedCount = countFinishedPegs(next, actor);
      if (nowFinishedCount >= 4) {
        next.players[actor] = { ...next.players[actor], hasFinished: true };

        if (!next.finishedOrder.includes(actor)) {
          next.finishedOrder = [...next.finishedOrder, actor];
        }

        if (next.config.options.teamPlay) {
          const teamId = next.players[actor].teamId as TeamId | undefined;
          if (teamId && isTeamFinished(next, teamId)) {
            next.phase = "ended";
            next.outcome = {
              kind: "team",
              winnerTeamId: teamId,
              winnerTeamPlayersInFinishOrder: teamFinishOrder(next, teamId),
            };
          }
        } else {
          next.phase = "ended";
          next.outcome = { kind: "individual", winnerPlayerId: actor };
        }
      }
    }

    return finalize("advance");
  }

  return finalize("fallback");
}
