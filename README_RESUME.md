# LMR Project — README_RESUME

## Snapshot Status
- **Branch:** master
- **State:** GREEN (all tests passing)
- **Tests:** 115/115 passing (54 files)
- **Scope:** Lobby Team Play (2 teams), startGame handoff invariants, room leave semantics

> Note: Update the **Last Commit** line after you commit any remaining staged/untracked files.

- **Last Commit:** (fill in from `git log -1 --oneline`)

---

## What Was Completed (Latest Session)

### Lobby: leaveRoom + persistence + lobbySync hygiene
- Added explicit client message: `leaveRoom`
- Server behavior on leave:
  - removes the client socket from the room
  - persists the room (when persistence enabled)
  - emits `lobbySync` reflecting the updated roster / teams

### Lobby: Team Play contract hardening (assignment + self-only swap + reconnect/leave)
- Team Play stays a **lobby-level contract** (no engine/gameplay coupling).
- Hardened invariants verified by contract tests:
  - enabling Team Play backfills teams deterministically
  - join assigns to smaller team (tie → A)
  - `setTeam` is **self-only** and rejects when:
    - not in lobby phase
    - teams are locked
    - invalid team id
    - not joined to a room

### startGame: phase/transition invariants (“handoff”)
- startGame transitions lobby → active and emits state to clients.
- startGame is now **phase-guarded**:
  - once room is `active`, subsequent `startGame` is rejected/ignored (no re-init side effects)
- Lobby-only messages are rejected after startGame.

### Team lock gating regression fix (playerCount-gated lock)
- Restored/confirmed Team Play lock gating expectations:
  - teams exist while in lobby (even before lock)
  - teams lock only when roster is complete, rules permit lock (even count), and first `ready=true` occurs
- Fixed server-side pre-lock teams representation to satisfy integration + contract expectations.

---

## Files Added / Modified (Latest Session)
- **Modified**
  - `src/server/wsServer.ts` — leaveRoom handling; team pre-lock + lock gating; startGame phase guard
  - `src/server/protocol.ts` — leaveRoom message (plus prior lobby/team message types)
  - `test/lobby.teams.contract.test.ts` — hardened Team Play contract coverage
- **Added**
  - `test/wsServer.startGame.handoff.contract.test.ts` — startGame handoff invariants (contract)

---

## How to Resume Work

### 1) Confirm clean + green
```powershell
git status
npm test
```

### 2) If you need to commit new work
Run these **one at a time** (separate copy blocks):

```powershell
git add src/server/protocol.ts
```

```powershell
git add src/server/wsServer.ts
```

```powershell
git add test/lobby.teams.contract.test.ts
```

```powershell
git add test/wsServer.startGame.handoff.contract.test.ts
```

```powershell
git commit -m "Lobby leaveRoom + Team Play hardening + startGame phase-guard"
```

### 3) Next subsystem candidate
- “StartGame → engine config transfer” (authoritative config source-of-truth):
  - ensure lobby `gameConfig` → started game config is copied once, immutable after start
  - ensure options like `teamPlay/teamCount/doubleDice/killRoll` flow through consistently
