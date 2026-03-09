PHASE 5 COMPLETE — UI BASELINE SNAPSHOT

Engine
- Core rules stable
- Turn invariants stable
- Dice lifecycle contracts stable
- Auto-pass / FIFO forfeiture contracts stable

Server
- Authoritative WS contract validated
- moveResult / legalMoves / stateSync flows verified
- bankedDice emission stabilized

Team Play
- 2-team scope complete
- Explicit per-die delegation
- Assignment guardrail enforced
- Delegation immutability enforced
- No implicit delegation on roll

Debug UI
- Minimal WS client validated
- Pending dice lifecycle visible
- Banked dice lifecycle visible
- Move execution stable
- Automatic legalMoves on pending-die selection
- Dynamic roll control based on eligibleRollCount

Tests
- Full test suite green
- Engine and server contracts stable

Snapshot
LMR_Restart_Complete_Snapshot_v5_2026-03-08_UI_BASELINE.zip

---

BOARD GEOMETRY BASELINE (LOCKED 2026-03-09)

Canonical board geometry references for 4-player, 6-player, and
8-player boards were reconstructed and locked after the UI baseline
snapshot.

The project now has explicit authoritative board geometry artifacts.

Reference diagrams
- Playpen/board_geometry/LMR_board_reference_4p.png
- Playpen/board_geometry/LMR_board_reference_6p.png
- Playpen/board_geometry/LMR_board_reference_8p.png

Geometry specification
- Playpen/board_geometry/LMR_board_geometry_spec.md

Source coordinate data
- Geometry files/B4_geometry.csv
- Geometry files/B6_geometry.csv
- Geometry files/B8_geometry.csv
- Geometry files/Track Index Table.xlsx

Board construction rule

All boards reuse the same 14‑spot arm module (T0–T13 plus H0–H3).
Different board sizes are produced by rotating this arm module around
the center and adjusting radius and branch swing.

Accepted visual baselines

4‑Player Board
Canonical orthogonal layout.

6‑Player Board
Approximate parameters
- radius ≈ 9
- branch swing ≈ 2.5°

8‑Player Board
Approximate parameters
- radius ≈ 10.6
- branch swing ≈ 4°

These diagrams now serve as the working authority for board layout and
should not be changed unless board geometry is explicitly reopened.

---

Next Focus
Phase 6 — Graphical UI Implementation

- Board renderer
- Peg renderer
- Legal move highlighting
- Peg interaction model
- Animation layer
