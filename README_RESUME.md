# LMR Project — README_RESUME

## Snapshot Status
- **Branch:** master
- **Last Commit:** 14e59eb
- **State:** GREEN (all tests passing)
- **Engine:** Server dice lifecycle + banking semantics finalized
- **Rules:** Authority v1.7.4 locked; Anchor v1.7.4 locked

---

## What Was Completed in This Session

### Double‑Dice Dead Pending Die Fix (2026‑02‑03)
- Fixed **dead pending die exhaustion**:
  - If remaining pending dice have zero legal moves after a move, they are auto‑exhausted.
  - Turn advances immediately; no lock or forced restart.
- Fixed **extra‑die accounting regression**:
  - Extra dice are awarded **only** for:
    - rolling a **1**
    - rolling a **6**
    - a **kill** (when kill‑roll is enabled)
  - No extra dice are granted on die spend.
  - Prevents erroneous “roll exactly 4 dice” BAD_ROLL states.
- Added regression test:
  - `test/server.doubleDice.deadDieExhaustion.test.ts`
- Manual gameplay verified:
  - Spending smaller die first correctly forfeits larger die when no legal moves remain.
  - Re‑rolling after 1/6 resolution behaves correctly.


### Dice Lifecycle & Banking (v1.7.4)
- Canonicalized **bankedExtraDice** (legacy bankedExtraRolls fully removed).
- Locked **N-dice cashout** semantics:
  - If N Banked Extra Dice exist, the next roll consists of N dice rolled together.
  - Bank is consumed to zero before any new extras are earned.
- Confirmed **one-die-at-a-time resolution** from Pending Dice.
- Enforced **turn advancement invariant**:
  - No turn advance while an Active Die exists, Pending Dice remain, or Banked Extra Dice remain.
- Clarified and tested **auto-pass behavior**:
  - Auto-pass never bypasses Banked Extra Dice.

### Tests
- Updated all server tests to use canonical **bankedExtraDice**.
- Added/adjusted coverage for:
  - Cashout cardinality
  - Auto-pass + banking
  - Turn ownership invariants
  - Team-play delegation continuity
- Full test suite: **GREEN**.

---

## What Was Completed in This Session (2026‑02‑04)

### Kill‑Roll Banking — Server & Contract
- Fixed **kill‑roll banking detection**:
  - Server now detects captures via `replayEntry.move.captures`.
  - Resolves mismatch between engine replay data and banking logic.
- Enforced **kill‑roll cash‑out gating**:
  - Turn does not advance until banked extra die is cashed out.
  - Invalid cash‑out rolls are rejected with **BAD_ROLL**.
- Added **wsServer lifecycle integration test**:
  - `test/wsServer.killRoll.lifecycle.integration.test.ts`
  - Verifies capture → bank → enforced single‑die cash‑out.
- Full suite verified **GREEN** after fix.

### Team Play — Lobby Contract Locked
- Defined and committed **Team Play lobby contract**:
  - Team Play remains an option in `LobbyGameConfig`.
  - Team membership tracked in lobby state (not game config).
- Locked **team assignment policy**:
  - One‑time random split when Team Play enabled.
  - **Lock on first ready** (no automatic reassignment afterward).
  - Explicit **swap‑only** adjustments allowed after lock.
- Extended protocol:
  - Added `LobbyTeams` structure with `isLocked` semantics.
- No gameplay logic implemented yet; this is a **contract‑first milestone**.


---


---

## What Was Completed in This Session (2026‑02‑05)

### Team Play — Lobby Implementation (Server)
- Implemented **pre‑start lobby configuration** via `setLobbyGameConfig` (client → server).
- Lobby now accepts and stores:
  - `playerCount`
  - `teamPlay` flag
- Implemented **Team Play lock-on-first-ready**, gated by roster completion:
  - Teams lock only when:
    - Team Play is enabled
    - `playerCount` is set
    - Connected players === `playerCount`
    - First `ready=true` occurs
  - No automatic reassignment after lock.
  - Subsequent ready events do not reshuffle teams.
- Enforced **even playerCount requirement** for two-team splits.
- Behavior verified with new server integration tests:
  - `test/lobby.teamPlay.lock.playerCount.integration.test.ts`
- Full test suite verified **GREEN** after implementation.


## Current Authoritative Rules
- **Rules Authority:** `LMR_Rules_Authority_v1.7.4.md`
- **Rules Anchor:** `LMR_Rules_Anchor_v1.7.4.md`

All engine, UI, and tests must conform to these documents.

---

## How to Resume Work

1. Start on **master** with a clean working tree.
2. Read:
   - `LMR_Rules_Authority_v1.7.4.md`
   - `LMR_Rules_Anchor_v1.7.4.md`
3. Confirm tests are green:
   ```powershell
   npm test
   ```
4. Next logical areas:
   - UI audit (httpConsole) to confirm it reads `bankedExtraDice`.
   - Snapshot packaging (Restart-Complete zip).
   - Future options: double-dice UI flow polish, kill-roll UX, or documentation cleanup.

---

## Working Preferences (Reminder)
- Full-file replacements only (no patches).
- One focused change at a time; pause checkpoints before long edits.
- Prefer canonical rules → engine → tests → UI, in that order.
- Avoid legacy terminology once removed from rules.

---

## Notes
- `node_modules/.vite/vitest/results.json` is a local artifact and should not be committed.
