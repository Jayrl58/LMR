# LMR Snapshot Manifest

**Project:** Last Man Running (LMR) / Roll & Run  
**Snapshot Type:** Engine Dice Lifecycle – Dead Pending Die Resolution  
**Status:** GREEN (Engine + Tests)  
**Date:** 2026-02-03

---

## Purpose

This manifest records an **engine-level dice lifecycle milestone** in the LMR project.  
It exists to support safe resumption, verification, and regression prevention.

This snapshot captures **authoritative server behavior** around:
- double-dice resolution
- extra-die banking
- turn advancement when dice become unusable

---

## Canonical Rule Documents (Unchanged)

The following documents remain **canonical and locked**:

- **Rules Authority:** `LMR_Rules_Authority_v1.7.4.md`
- **Rules Anchor:** `LMR_RULES_ANCHOR_v1.7.4.md`

No gameplay rule changes are introduced by this snapshot.

---

## Summary of Changes Since Prior Snapshot

### Engine / Server Fixes

- **Fixed dead pending die exhaustion**
  - If remaining pending dice have **zero legal moves** after a move, they are auto-exhausted.
  - The turn advances immediately.
  - Prevents soft-locks requiring game restarts.

- **Fixed extra-die accounting regression**
  - Extra dice are awarded **only** for:
    - rolling a **1**
    - rolling a **6**
    - a **kill** (when kill-roll is enabled)
  - Extra dice are **not** granted on die spend.
  - Prevents erroneous `BAD_ROLL` states (e.g., “must roll exactly 4 dice”).

### Contract Locking

- Added a **server-level regression test**:
  - `test/server.doubleDice.deadDieExhaustion.test.ts`
- Test asserts:
  - Remaining pending dice with no legal moves are exhausted automatically
  - Turn advances cleanly with no pending dice remaining

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
  - dead die exhaustion
  - extra-die lifecycle
  is **GREEN and verified**
- Full test suite passes (`npm test`)

---

## UI / Debug Status

- HTTP console may lag or diverge from authoritative server messaging
- WS-level inspection remains the authoritative diagnostic surface
- UI reconciliation may occur in a future snapshot

---

## Snapshot Integrity

This snapshot is considered valid if and only if:

- Commits include:
  - Fix for dead pending die exhaustion
  - Fix for extra-die double counting
  - Addition of `server.doubleDice.deadDieExhaustion.test.ts`
- All tests pass (`npm test`)
- No uncommitted engine files are present in the snapshot ZIP

---

## Resume Pointer

To resume work from this snapshot:

1. Pull snapshot ZIP at this commit boundary
2. Trust engine dice lifecycle behavior as canonical
3. Continue with:
   - UI reconciliation **or**
   - additional engine features (kill-roll UX, banking display, etc.)

---

**End of SNAPSHOT_MANIFEST**
