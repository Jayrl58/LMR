# SNAPSHOT MANIFEST
LMR Project — Restart-Complete Snapshot

Snapshot Version: v2.8  
Snapshot Date: 2026-02-05  
Snapshot Type: Team Play Lobby Implementation + PlayerCount-Gated Lock + Debug Console Auto-Ready Default OFF

---

## Summary of Changes Since Prior Snapshot (v2.7)

### Team Play — Lobby Configuration (Server)
- Implemented **pre-start lobby configuration** via new client → server message: `setLobbyGameConfig`.
- Lobby can now store the intended `playerCount` and `teamPlay` flag **before** `startGame`.

### Team Play — Lock on First Ready (PlayerCount-Gated)
- Implemented **lock-on-first-ready** for Team Play, gated by roster completion:
  - Teams lock only when:
    - `teamPlay === true`
    - `gameConfig.playerCount` is set
    - connected players == `playerCount`
    - first `ready=true` occurs
  - No automatic reassignment after lock.
  - Subsequent `ready=true` events do not reshuffle teams.
- Enforced **even `playerCount` requirement** for two-team splits (balanced teams).

### Team Play — Verification
- Added integration tests covering:
  - no lock before roster completion
  - lock on first `ready=true` once roster is complete
  - no reshuffle after lock
  - no lock for odd `playerCount`
- New test file:
  - `test/lobby.teamPlay.lock.playerCount.integration.test.ts`
- Full test suite verified **GREEN** after implementation.

### Debug Console — Auto-Ready Default OFF
- Kept the debug **auto-ready** toggle, but changed default to **OFF** to prevent accidental team locks on room join.
- File:
  - `src/server/httpConsole.ts`

---

## Carried Forward From v2.7 (No Changes in v2.8)
- Kill-roll banking detection uses `replayEntry.move.captures`.
- Turn is held for kill-roll cash-out; invalid cash-out rolls rejected with `BAD_ROLL`.
- Team Play lobby contract remains as defined; v2.8 implements the server behavior (no lobby UI yet).

---

## Files of Note
- `src/server/protocol.ts` — adds `setLobbyGameConfig` message; protocol-aligned lobby game config fields
- `src/server/wsServer.ts` — implements lobby config handling + Team Play lock gating
- `src/server/httpConsole.ts` — auto-ready default OFF (debug console safety)
- `test/lobby.teamPlay.lock.playerCount.integration.test.ts` — Team Play lock integration coverage

---

## Snapshot Integrity Notes
- Rules Authority remains unchanged and authoritative.
- Server remains authoritative; UI does not invent rules.
- Snapshot is restart-complete and engine-safe.
- All tests passing at time of snapshot.

---

## Explicit Non-Changes
- No changes to Rules Authority text.
- No changes to board geometry.
- No new gameplay variants introduced.
- No lobby UI implemented yet for Team Play (server-only behavior + tests).

---
