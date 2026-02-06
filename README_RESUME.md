# LMR Project — README_RESUME

## Snapshot Status
- **Branch:** master
- **Last Commit:** ac0a419
- **State:** GREEN (all tests passing)
- **Engine:** Server dice lifecycle + banking semantics finalized
- **Rules:** Authority v1.7.4 locked; Anchor v1.7.4 locked

---

## What Was Completed in This Session

### Double-Dice Dead Pending Die Fix (2026-02-03)
- Fixed **dead pending die exhaustion**:
  - If remaining pending dice have zero legal moves after a move, they are auto-exhausted.
  - Turn advances immediately; no lock or forced restart.
- Fixed **extra-die accounting regression**:
  - Extra dice are awarded **only** for:
    - rolling a **1**
    - rolling a **6**
    - a **kill** (when kill-roll is enabled)
  - No extra dice are granted on die spend.
  - Prevents erroneous “roll exactly 4 dice” BAD_ROLL states.
- Added regression test:
  - `test/server.doubleDice.deadDieExhaustion.test.ts`
- Manual gameplay verified.

---

### Dice Lifecycle & Banking (v1.7.4)
- Canonicalized **bankedExtraDice** (legacy terminology fully removed).
- Locked **N-dice cash-out** semantics:
  - Banked dice roll together.
  - Bank is consumed before new extras can be earned.
- Enforced **turn-advance invariants**:
  - No advance while Active, Pending, or Banked dice exist.
- Auto-pass never bypasses Banked Extra Dice.

---

## What Was Completed in This Session (2026-02-04)

### Kill-Roll Banking — Server & Contract
- Fixed kill-roll capture detection via replay data.
- Enforced kill-roll cash-out gating.
- Added lifecycle integration test:
  - `test/wsServer.killRoll.lifecycle.integration.test.ts`
- Full suite verified **GREEN**.

---

### Team Play — Lobby Contract Locked
- Defined Team Play as a **lobby-level contract**, not gameplay logic.
- Locked team assignment rules:
  - One-time random split.
  - No reshuffle after lock.
  - Swap-only changes allowed post-lock.
- Extended protocol with `LobbyTeams` and `isLocked`.
- No gameplay engine changes.

---

## What Was Completed in This Session (2026-02-05)

### Team Play — Lobby Implementation (Server)
- Implemented **pre-start lobby configuration** via `setLobbyGameConfig`.
- Lobby now stores:
  - `playerCount`
  - `teamPlay`
- Enforced **even playerCount** for two-team play.
- Added integration tests:
  - `test/lobby.teamPlay.lock.playerCount.integration.test.ts`
- Full test suite verified **GREEN**.

### Team Play — Auto-Lock Behavior Fix
- Fixed edge case where:
  - Players were already **ready**
  - Lobby was already **full**
  - Team Play config was applied **afterward**
- New behavior:
  - If Team Play is enabled **after** the lobby is full and **any player is ready**, teams **lock immediately**.
- Preserves all original gating rules.
- Removes the need for a manual “toggle ready” workaround.
- **No Rules Authority changes.**

---

## Current Authoritative Rules
- **Rules Authority:** `LMR_Rules_Authority_v1.7.4.md`
- **Rules Anchor:** `LMR_Rules_Anchor_v1.7.4.md`

All engine, server, UI, and tests must conform to these documents.

---

## How to Resume Work

1. Start on **master** with a clean working tree.
2. Read:
   - `LMR_Rules_Authority_v1.7.4.md`
   - `LMR_Rules_Anchor_v1.7.4.md`
3. Confirm tests are green:
   ```powershell
   npm test
