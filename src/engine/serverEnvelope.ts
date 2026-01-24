import type { SyncResult } from "./sync";

export type EngineErrorCode =
  | "ILLEGAL_MOVE"
  | "INVALID_INPUT"
  | "WRONG_ACTOR"
  | "GAME_ENDED";

export type EngineError = {
  code: EngineErrorCode;
  message: string;
};

export type DicePolicy = "external";

export type TurnContext = {
  nextActorId: string;
  dicePolicy: DicePolicy;

  /**
   * Authoritative pending dice to resolve, in the order the server considers them.
   * - empty => player must roll (awaitingDice=true)
   * - non-empty => player must resolve exactly one die at a time (awaitingDice=false)
   */
  pendingDice: number[];

  /**
   * Derived invariant:
   * awaitingDice === (pendingDice.length === 0)
   */
  awaitingDice: boolean;
};

export type MoveOk = {
  ok: true;
  result: SyncResult;
  turn: TurnContext;
};

export type MoveErr = {
  ok: false;
  error: EngineError;
};

export type MoveResponse = MoveOk | MoveErr;
