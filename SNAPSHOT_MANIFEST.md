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

During the subsequent 2026‑03‑09 session, canonical board geometry references were reconstructed and locked.  
These geometry artifacts are now preserved in the repository to prevent future ambiguity in board layout.

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

## Board Geometry Authority (Locked 2026‑03‑09)

Board geometry references were reconstructed and verified during the board‑geometry session.

These artifacts now serve as the **working authority for board layout**.

Reference diagrams:

- `Playpen/board_geometry/LMR_board_reference_4p.png`
- `Playpen/board_geometry/LMR_board_reference_6p.png`
- `Playpen/board_geometry/LMR_board_reference_8p.png`

Supporting specification:

- `Playpen/board_geometry/LMR_board_geometry_spec.md`

Source coordinate data:

- `Geometry files/B4_geometry.csv`
- `Geometry files/B6_geometry.csv`
- `Geometry files/B8_geometry.csv`
- `Geometry files/Track Index Table.xlsx`

Board construction rule:

All boards reuse the same **14‑spot arm module (T0–T13 + H0–H3)**.  
Different board sizes are produced by rotating this arm module around the center and adjusting radius and branch swing.

Accepted visual baselines:

4‑Player Board  
Canonical orthogonal layout.

6‑Player Board  
Approximate parameters:  
- radius ≈ 9  
- branch swing ≈ 2.5°

8‑Player Board  
Approximate parameters:  
- radius ≈ 10.6  
- branch swing ≈ 4°

These diagrams should be treated as authoritative unless board geometry is explicitly reopened.

---

## Snapshot Integrity Notes

- Rules Authority unchanged
- Board geometry now explicitly documented and preserved
- Team Play scope remains 2 teams
- Server remains authoritative
- Debug UI is a validation harness, not final UI

---

## Explicit Non-Changes

- No gameplay rule changes
- No engine behavior changes
- No expansion beyond 2-team play
- No graphical board rendering yet
