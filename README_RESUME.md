# LMR Project — README_RESUME

## Snapshot Status
- **Branch:** master
- **Last Commit:** 14e59eb
- **State:** GREEN (all tests passing)
- **Engine:** Server dice lifecycle + banking semantics finalized
- **Rules:** Authority v1.7.4 locked; Anchor v1.7.4 locked

---

## What Was Completed in This Session

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
