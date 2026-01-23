// Public engine surface (LOCKED)

export { applyMove } from "./applyMove";

// Contract name: legalMoves
export { legalMoves } from "./publicApi";

export { isTeamFinished, teamFinishOrder } from "./teams";

// Contract name: chooseRollRecipient
export { chooseRollRecipient } from "./publicApi";

// State serialization (LOCKED)
export { serializeState, deserializeState } from "./serialization";

// Deterministic state hash (LOCKED)
export { hashState } from "./stateHash";

// Replay log (LOCKED)
export { applyAndRecord } from "./replayApply";

// Replay file format + IO (LOCKED)
export { REPLAY_FORMAT_VERSION } from "./replayFormat";
export { serializeReplay, deserializeReplay } from "./replayIO";

// Replay validation (LOCKED)
export { validateReplayFile } from "./replayValidate";

// Sync primitive (LOCKED)
export { applyMoveWithSync } from "./sync";

// Server envelope + try-apply (LOCKED)
export type { MoveResponse, EngineError, EngineErrorCode } from "./serverEnvelope";
export { tryApplyMoveWithResponse } from "./tryApply";
