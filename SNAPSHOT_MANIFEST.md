# LMR Snapshot Manifest

**Project:** Last Man Running (LMR) / Roll & Run  
**Snapshot Type:** Engine Messaging & Dice Lifecycle Milestone  
**Status:** GREEN (Engine + Tests)  
**Date:** 2026-01-27

---

## Purpose

This manifest records a **logic and server-messaging milestone** in the LMR project.  
It exists to support safe resumption, verification, and regression prevention.

This snapshot captures **engine-facing server behavior**, not UI polish.

---

## Canonical Rule Documents (Unchanged)

The following documents remain **canonical and locked**:

- **Rules Authority:** `LMR_Rules_Authority_v1.7.3.md`
- **Rules Anchor:** `Rules_Anchor_v1.7.3.md`

No gameplay rule changes are introduced by this snapshot.

---

## Summary of Changes Since Prior Snapshot

### Engine / Server Fixes

- **Fixed `moveResult` turn inconsistency**:
  - `pendingDice` is now preserved correctly after spending a single die from a multi-die roll
  - `awaitingDice` now reflects true resolution state (only `true` when no pending dice remain)
- Removed divergence between:
  - `moveResult.response.turn`
  - engine-derived `result.turn`
  - subsequent `stateSync.turn`

### Contract Locking

- Added a **server-level test** asserting:
  - `moveResult.response.turn` mirrors engine/session turn state
  - Pending dice and awaiting state cannot silently regress
- This test will fail CI if the dice lifecycle messaging contract is violated.

---

## Explicit Non-Changes

- No rules authority changes
- No board geometry changes
- No movement or capture rule changes
- No UI behavior is locked by this snapshot
- HTTP debug console is explicitly **non-authoritative**

---

## Engine Status

- Engine logic for:
  - double-dice
  - pending dice resolution
  - extra dice lifecycle
  is **GREEN and verified**
- Full test suite passes, including the new contract test

---

## UI / Debug Status

- HTTP console may lag or diverge from authoritative server messaging
- WS-level inspection (`wsClient.ts`) is the preferred diagnostic tool
- UI cleanup may occur in a future snapshot

---

## Snapshot Integrity

This snapshot is considered valid if and only if:

- Commits include:
  - `Fix moveResult turn consistency: preserve pendingDice and awaitingDice after moves`
  - `Add test enforcing moveResult turn consistency with pending dice`
- All tests pass (`npm test`)
- No uncommitted engine files are present in the snapshot ZIP

---

## Resume Pointer

To resume work from this snapshot:

1. Pull snapshot ZIP at this commit boundary
2. Trust engine dice lifecycle and server turn messaging as canonical
3. Continue with:
   - UI reconciliation **or**
   - further engine features (kill-roll, banking UX, etc.)

---

**End of SNAPSHOT_MANIFEST**
