import type { ReplayFile } from "./replayFormat";
import { validateReplayFile } from "./replayValidate";

/**
 * Serialize a replay file to JSON.
 */
export function serializeReplay(replay: ReplayFile): string {
  return JSON.stringify(replay);
}

/**
 * Deserialize JSON into a replay file and validate it.
 */
export function deserializeReplay(json: string): ReplayFile {
  const replay = JSON.parse(json) as ReplayFile;
  validateReplayFile(replay);
  return replay;
}
