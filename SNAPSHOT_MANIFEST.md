# SNAPSHOT MANIFEST
LMR Project — Restart-Complete Snapshot

Snapshot Version: v5
Snapshot Date: 2026-03-08
Snapshot Type: UI Baseline — Engine/Server Stabilized Prior to Graphical UI Implementation

---

## Snapshot Context

This snapshot marks the transition from the **engine/server development phase (M1–M5)** into **UI implementation work (M6)**.

The engine rules, dice lifecycle, turn ownership invariants, and team-play delegation contracts are considered stable.

The minimal debug UI is now capable of exercising the full authoritative server contract and validating real gameplay flows.

This snapshot establishes a **restart-safe baseline before beginning graphical board rendering and interaction work.**

---

## Major Capabilities Locked

### Engine
- Deterministic move legality
- Dice lifecycle
- Auto-pass behavior
- FIFO forced forfeiture
- Team-play per-die delegation

### Server
- Authoritative turn engine
- WS message contract validated
- Correct moveResult / legalMoves / stateSync emission
- bankedDice emission corrected

### Debug UI
- Roll lifecycle validated
- Pending dice inspection
- Banked dice lifecycle visible
- Automatic legalMoves on pending-die selection
- Dynamic dice control based on eligibleRollCount
- Move execution confirmed stable

---

## Files of Note

### Engine
- `src/engine/applyMove.ts`
- `src/engine/tryApply.ts`
- `src/engine/validateState.ts`

### Server
- `src/server/wsServer.ts`
- `src/server/handleMessage.ts`

### Debug UI
- `ui/src/App.tsx`

---

## Snapshot Integrity Notes

- Rules Authority unchanged
- Board geometry unchanged
- Team Play scope remains 2 teams
- Server remains authoritative
- Debug UI is a validation harness, not final UI

---

## Explicit Non-Changes

- No gameplay rule changes
- No board geometry changes
- No expansion beyond 2-team play
- No graphical board rendering yet