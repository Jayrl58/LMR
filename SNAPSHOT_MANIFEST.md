
# SNAPSHOT MANIFEST
LMR Project — Restart-Complete Snapshot

Snapshot Version: v2.7  
Snapshot Date: 2026-02-04  
Snapshot Type: Engine Dice Lifecycle + Kill-Roll Banking + Team Play Lobby Contract

---

## Summary of Changes Since Prior Snapshot

### Kill-Roll Banking (Server)
- Fixed kill-roll banking detection to use `replayEntry.move.captures`.
- Server now correctly detects captures for kill-roll scenarios.
- Turn does **not** advance until the banked extra die is cashed out.
- Invalid cash-out rolls are rejected with `BAD_ROLL`.
- Behavior enforced server-side; UI is not responsible for banking logic.

### Kill-Roll Lifecycle Verification
- Added wsServer lifecycle integration test:
  - `test/wsServer.killRoll.lifecycle.integration.test.ts`
- Test verifies end-to-end behavior:
  - capture → bank → enforced single-die cash-out
- Full test suite verified **GREEN** after changes.

### Team Play — Lobby Contract Lock
- Team Play remains an option in `LobbyGameConfig`.
- Team membership is tracked in lobby state, not game config.
- One-time random team split when Team Play is enabled.
- **Lock on first ready** prevents automatic reassignment.
- Explicit **swap-only** adjustments allowed after lock.
- Contract defined in `protocol.ts`; no gameplay logic implemented yet.

---

## Files of Note
- `src/server/handleMessage.ts` — kill-roll banking detection fix
- `src/server/protocol.ts` — Team Play lobby contract additions
- `test/wsServer.killRoll.lifecycle.integration.test.ts` — kill-roll lifecycle coverage

---

## Snapshot Integrity Notes
- Rules Authority remains unchanged and authoritative.
- No UI behavior changes included.
- Snapshot is restart-complete and engine-safe.
- All tests passing at time of snapshot.

---

## Explicit Non-Changes
- No changes to Rules Authority text.
- No changes to board geometry.
- No new gameplay variants introduced.
- No lobby UI implemented yet for Team Play.

---
