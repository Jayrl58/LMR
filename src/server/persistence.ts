import fs from "node:fs";
import path from "node:path";
import type { SessionState } from "./handleMessage";
import type { TurnInfo } from "./protocol";
import {
  serializeState,
  deserializeState,
  hashState,
} from "../engine";

export type PersistedSessionV1 = {
  version: 1;
  savedAt: string; // ISO
  gameState: unknown; // SerializedState (kept unknown at protocol boundary)
  stateHash: string;
  turn: TurnInfo;
  pendingDie?: number;
};

export type PersistenceOptions = {
  /** Full path to the JSON file used for persistence. */
  filePath: string;
};

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function saveSession(session: SessionState, opts: PersistenceOptions): void {
  const gameState = serializeState(session.game);
  const stateHash = hashState(session.game);

  const payload: PersistedSessionV1 = {
    version: 1,
    savedAt: new Date().toISOString(),
    gameState,
    stateHash,
    turn: session.turn,
    pendingDie: session.pendingDie,
  };

  ensureDirForFile(opts.filePath);
  fs.writeFileSync(opts.filePath, JSON.stringify(payload, null, 2), "utf8");
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function loadSession(opts: PersistenceOptions): SessionState {
  const raw = fs.readFileSync(opts.filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error("Persisted session is not an object.");
  }

  const version = parsed["version"];
  if (version !== 1) {
    throw new Error(`Unsupported persisted session version: ${String(version)}`);
  }

  const savedAt = parsed["savedAt"];
  if (typeof savedAt !== "string") {
    throw new Error("Persisted session missing savedAt string.");
  }

  const gameState = (parsed as any).gameState;
  const stateHash = (parsed as any).stateHash;
  const turn = (parsed as any).turn as TurnInfo | undefined;
  const pendingDie = (parsed as any).pendingDie as number | undefined;

  if (typeof stateHash !== "string") {
    throw new Error("Persisted session missing stateHash string.");
  }

  if (!turn || typeof turn.nextActorId !== "string") {
    throw new Error("Persisted session missing valid turn object.");
  }
  if (turn.dicePolicy !== "external") {
    throw new Error(`Persisted session dicePolicy must be "external".`);
  }
  if (typeof turn.awaitingDice !== "boolean") {
    throw new Error("Persisted session missing awaitingDice boolean.");
  }

  if (pendingDie != null && (!Number.isInteger(pendingDie) || pendingDie < 1 || pendingDie > 6)) {
    throw new Error("Persisted session pendingDie must be an integer 1..6 when present.");
  }

  const game = deserializeState(gameState as any);
  const computedHash = hashState(game);

  if (computedHash !== stateHash) {
    throw new Error(
      `Persisted session hash mismatch. Expected ${stateHash}, computed ${computedHash}.`
    );
  }

  return {
    game,
    turn,
    pendingDie,
  };
}

/**
 * Utility: return true if the persistence file exists.
 */
export function hasPersistedSession(opts: PersistenceOptions): boolean {
  return fs.existsSync(opts.filePath);
}
