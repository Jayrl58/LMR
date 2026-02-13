Snapshot Version: v3.1  
Snapshot Date: 2026-02-13  
Snapshot Type: Engine Invariant Layer + Repository Stabilization

---

## Summary of Changes Since Prior Snapshot (v3.0)

### Engine: validateState invariant layer
- Implemented shape-only `validateState()` enforcement.
- Integrated invariant checks into `applyMove` lifecycle boundaries.
- Relaxed playerCount contract to allow pre-active states (0..8) while enforcing >=2 during active/ended phases.
- Restored full green test suite under invariant enforcement.

### Repository Hardening
- Configured GitHub remote (origin).
- Removed `node_modules` from version control.
- Added proper `.gitignore`.
- Verified clean working tree and successful push.

---

## Files of Note

### Engine
- `src/engine/validateState.ts`
- `src/engine/applyMove.ts` (integration boundary calls)

---

## Snapshot Integrity Notes
- All 54 test files green (123 passing, 3 intentionally skipped).
- No Rules Authority changes.
- No board geometry changes.
- No Team Play scope expansion.
- Invariant layer is shape-only (no rule duplication).

---

## Explicit Non-Changes
- No gameplay feature expansion.
- No UI integration changes.
- No modification to Phase 5 delegation contracts.

# SNAPSHOT MANIFEST
LMR Project — Restart-Complete Snapshot

Snapshot Version: v3.0  
Snapshot Date: 2026-02-09  
Snapshot Type: Phase 5 — Turn & Dice Lifecycle Contracts (auto-pass timing, FIFO forfeiture, Team Play per-die delegation)

---

## Summary of Changes Since Prior Snapshot (v2.9)

### Phase 5: Turn & Dice lifecycle contract hardening
- Locked and enforced “temporarily-illegal die” behavior (double-dice opening 1+5 example):
  - A die with no legal moves cannot be prematurely resolved/forfeited while any unresolved die has a legal move.
  - Attempting the temporarily-illegal selection is rejected (Option A).
- Locked and enforced auto-pass timing:
  - Auto-pass occurs only when **all remaining unresolved dice** have no legal moves in the current state.
- Locked and enforced deterministic forced-forfeiture order:
  - FIFO by roll order when auto-pass must resolve multiple dead dice.
- Locked and enforced player-visible forfeiture signaling:
  - Auto-pass/forfeiture produces explicit per-die notifications suitable for UI display.

### Phase 5: Team Play (2 teams) — per-die delegation contracts
- Bank ownership remains with the **turn owner** (`activeActorId`), regardless of which teammate resolves a die.
- Delegation is **per die** (not per roll):
  - The turn owner can assign different dice to different teammates.
- Delegation immutability:
  - Once a die is delegated to a teammate, it cannot be reassigned until that die is resolved.
- Deterministic arbitration for concurrent/stale inputs:
  - First valid action wins; subsequent actions based on stale state are rejected.

---

## Files of Note

### Engine
- `src/engine/tryApply.ts`
  - emits an explicit “no legal moves” reason for the temporarily-illegal selection rejection path (contract requirement)

### Tests
- `test/contracts/turnDice.contract.test.ts`
  - Phase 5 contract coverage:
    - temporarily-illegal selection rejection
    - legality becomes valid later in the same turn (1 then 5)
    - auto-pass timing (ALL-unresolved-illegal)
    - FIFO forfeiture + per-die notification expectations
    - Team Play per-die delegation authority + immutability + stale arbitration
  - Some tests remain intentionally skipped where underlying feature surface is not yet implemented (documented inline).

---

## Snapshot Integrity Notes
- Rules Authority unchanged and remains authoritative.
- Server remains authoritative; UI does not invent rules.
- Snapshot is restart-complete and engine-safe.
- Test suite was GREEN during Phase 5 completion; re-run full suite after snapshot packaging as standard practice.

---

## Explicit Non-Changes
- No changes to Rules Authority text.
- No changes to board geometry.
- No expansion of Team Play beyond 2 teams.
- No UI feature work beyond contract-visible signaling.
