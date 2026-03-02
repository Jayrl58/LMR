# Startup Milestone Frame — LMR Project

Status: Updated after M5 completion verification
Status: Session validation added 2026-03-02

------------------------------------------------------------------------

COMPLETE M1 — Engine Core (Authoritative Rules Engine)
COMPLETE M2 — Server Authority Layer
COMPLETE M3 — Double Dice Mode
COMPLETE M4 — Team Play (2-Team Baseline)

COMPLETE M5 — Team Model Expansion
COMPLETE M5.1 — 3 teams of 2 (6P board)
COMPLETE M5.2 — 4 teams of 2 (8P board)
COMPLETE M5.3 — Advanced delegation arbitration hardening
COMPLETE M5.4 — Multi-team finish ordering
COMPLETE M5.5 — Edge-case multi-team turn flow hardening

COMPLETE OPT.KILLROLL — Optional Module — Kill-Roll Banking Hardening

NOT_STARTED M6 — UI Integration & Presentation

------------------------------------------------------------------------

POST-COMPLETE VALIDATION — 2026-03-02 (Server ↔ UI Contract Hardening)

Validated runtime behavior (external dice mode, double-dice enabled):

- Verified double-dice sequencing with roll [1,2]
- Verified banked-die behavior (1 or 6 banks one die)
- Verified enter-on-1 from base
- Verified pendingDice roll gating (BAD_TURN_STATE enforced)
- Verified NOT_YOUR_TURN enforcement
- Verified correct turn retention after partial resolution
- Verified correct turn advance after full resolution
- Verified legalMoves payload includes:
  - actorId
  - dice array
  - active die value
  - moves list
  - turn snapshot
- Verified turn payload includes pendingDice and bankedDice when applicable

Open Contract Issues:

- Intermittent “No legalMoves received yet” during external dice flow
- Prototype UI does not consistently render legalMoves
- No frozen written server ↔ UI message contract specification yet

------------------------------------------------------------------------

RESUME ANCHOR — Next Session Focus

Primary Objective:
Isolate and reproduce intermittent missing legalMoves emission/handling in external dice flow.

Success Definition:
Deterministically reproduce the issue OR formally eliminate it as a UI-side rendering defect.

Stop Condition:
Server ↔ UI contract for roll → legalMoves → moveResult → next turn is fully deterministic and documented.
