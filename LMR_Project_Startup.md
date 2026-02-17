# LMR Project — Startup Authority & State Anchor

Purpose:
Provide authoritative context for Startup Protocol execution.

This document defines the current milestone state, active focus, and scope boundaries.

---

## High-Level Milestone Frame (Authoritative)

M1 — Engine Authority Stabilization — Complete  
M2 — Server Contract Alignment — Complete  
M3 — Team Play (2-Team Model) — Complete  
M4 — Invariant Hardening — Complete  
M5 — Team Model Expansion (4/6/8 Player Variants) — In Progress  
M6 — UI Alignment & Integration — Planned  
M7 — Pre-Release Feature Completion (Double-Dice, Kill-Roll, Polish) — Planned  

---

## Current Technical Focus — M5 (Design Hardening)

Status: Design hardening, not implementation.

### 1) Valid Team Shapes (Engine-Level)

Support and validate:

4 players  
- Free-for-all  
- 2 × 2  

6 players  
- Free-for-all  
- 3 × 2  
- 2 × 3  

8 players  
- Free-for-all  
- 4 × 2  
- 2 × 4  

Focus areas:
- Team shape validation in `validateState`
- Prevent invalid configurations
- Ensure finished players cannot receive delegation

---

### 2) Delegation Scaling Beyond 2 Teams

Ensure:

- Turn owner selects among eligible teammates with legal moves
- No implicit preference order
- Finished players excluded
- Works correctly with 3 or 4 teammates

Primary impact areas:
- `chooseRollRecipient`
- Delegation invariants
- Engine audit layer

---

### 3) Invariant Coverage Expansion

Strengthen audit checks so:

- Team membership is internally consistent
- Delegation respects team boundaries
- No illegal cross-team delegation
- Free-for-all treated as each player is their own team

---

## Explicitly Out of Scope (Current Phase)

- UI updates
- Lobby UX changes
- Test surface expansion beyond shape validation
- Multi-team performance tuning

---

## Immediate Logical Next Step

Formalize team-shape validation matrix inside `validateState`  
so all 4/6/8 configurations are explicitly enforced.
