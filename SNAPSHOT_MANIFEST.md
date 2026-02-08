# SNAPSHOT MANIFEST
LMR Project — Restart-Complete Snapshot

Snapshot Version: v2.9  
Snapshot Date: 2026-02-08  
Snapshot Type: Team Play Lobby Hardening + leaveRoom + startGame Phase Guard + Handoff Contract

---

## Summary of Changes Since Prior Snapshot (v2.8)

### Lobby: leaveRoom (client message) + server cleanup/persistence
- Added client → server message: `leaveRoom`.
- On leave, server now:
  - removes the socket from the room
  - persists the room (when enabled)
  - emits `lobbySync` so roster/team state stays consistent across clients

### Lobby: Team Play contract hardening
- Strengthened Team Play lobby behavior to match the contract tests:
  - deterministic partition on enable (no random reshuffle surprises)
  - join assignment uses smaller-team rule (tie → Team A)
  - `setTeam` is self-only and rejected when:
    - not in lobby phase (room active)
    - teams are locked
    - invalid team target
    - client not joined to a room

### startGame: handoff invariants + phase guard
- Added a dedicated contract test suite for “startGame handoff invariants”.
- startGame is now phase-guarded:
  - once room is `active`, subsequent `startGame` requests do **not** reinitialize lobby/game state.
- Lobby-only configuration messages are rejected once started.

### Team lock gating regression fix (playerCount-gated)
- Ensured Team Play teams are present pre-lock in lobby state.
- Preserved lock gating rules:
  - lock requires roster completion (connected == configured playerCount)
  - requires even playerCount for 2-team split
  - lock triggers on first `ready=true` after gating conditions are met

---

## Files of Note

### Protocol / Server
- `src/server/protocol.ts`
  - adds `leaveRoom` message type
- `src/server/wsServer.ts`
  - implements `leaveRoom`
  - ensures lobbySync on leave
  - startGame phase-guard
  - Team Play pre-lock + lock gating consistency

### Tests
- `test/lobby.teams.contract.test.ts`
  - hardened Team Play contract coverage (assign/swap/leave/reconnect/rejections)
- `test/wsServer.startGame.handoff.contract.test.ts`
  - startGame transition + post-start rejection/ignore invariants

---

## Snapshot Integrity Notes
- Rules Authority unchanged and remains authoritative.
- Server remains authoritative; UI does not invent rules.
- Snapshot is restart-complete and engine-safe.
- All tests passing at time of snapshot.

---

## Explicit Non-Changes
- No changes to Rules Authority text.
- No changes to board geometry.
- No new gameplay variants introduced (team play remains 2 teams only).
- No lobby UI implemented yet (server + tests only).
