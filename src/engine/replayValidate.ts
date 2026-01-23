import type { ReplayFile } from "./replayFormat";
import { REPLAY_FORMAT_VERSION } from "./replayFormat";

function isIsoDateString(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const t = Date.parse(s);
  return Number.isFinite(t) && new Date(t).toISOString() === s;
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

export function validateReplayFile(replay: ReplayFile): void {
  const r: any = replay as any;

  if (r?.formatVersion !== REPLAY_FORMAT_VERSION) {
    throw new Error(`Invalid replay formatVersion: ${String(r?.formatVersion)}`);
  }

  if (!isIsoDateString(r?.createdAt)) {
    throw new Error(`Invalid replay createdAt: ${String(r?.createdAt)}`);
  }

  if (!r?.initialState) {
    throw new Error("Invalid replay initialState");
  }

  if (!Array.isArray(r?.log)) {
    throw new Error("Invalid replay log");
  }

  for (let i = 0; i < r.log.length; i++) {
    const e = r.log[i];
    if (!isString(e?.beforeHash)) {
      throw new Error(`Invalid replay log[${i}].beforeHash`);
    }
    if (!("move" in e)) {
      throw new Error(`Invalid replay log[${i}].move`);
    }
    if (!isString(e?.afterHash)) {
      throw new Error(`Invalid replay log[${i}].afterHash`);
    }
  }
}
