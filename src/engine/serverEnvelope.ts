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
  awaitingDice: true;
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
