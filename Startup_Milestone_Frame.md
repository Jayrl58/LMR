# Startup Milestone Frame — LMR Project

Purpose:

This document defines the authoritative milestone roadmap and milestone
completion history for the LMR project.

It serves three roles:

• Define the milestone roadmap for the project  
• Indicate milestone status (complete / in progress / planned)  
• Preserve post-completion validation records for major milestones

Session restart instructions and next actions are maintained separately
in:

LMR_Project_Startup.md

------------------------------------------------------------------------

## Milestone Status Symbols

✓ COMPLETE  
○ IN PROGRESS (Open)  
→ PLANNED

------------------------------------------------------------------------

## Milestone Rendering Rules

Default view: fully collapsed milestone list.

Expand milestones only when explicitly requested  
(e.g., "Show M6").

------------------------------------------------------------------------

## Milestone Roster

✓ M1 — Engine Core (Authoritative Rules Engine)  
✓ M2 — Server Authority Layer  
✓ M3 — Pregame Options  
✓ M4 — Team Model Expansion  
✓ M5 — Game Setup UI  
✓ M6 — Graphical Board UI  
✓ M7 — Gameplay Interaction Layer  
→ M8 — Game Completion & Results  
→ M9 — Production Readiness

------------------------------------------------------------------------

## M6 — Graphical Board UI (Expanded Status)

✓ M6.1 — WebSocket client connection  
✓ M6.2 — Board renderer integration  
✓ M6.3 — Roll / legalMoves / move interaction loop  
✓ M6.4 — Dice contract compatibility (double-dice + bank lifecycle)  
✓ M6.5 — Functional gameplay loop validation  
✓ M6.6 — Debug UI console refinement  

------------------------------------------------------------------------

## M7 — Gameplay Interaction Layer (Expanded Status)

✓ M7.1 — Multi-die interaction gating stabilization  
✓ M7.2 — Peg arrow affordance pipeline  
✓ M7.3 — Directional arrow rendering  
✓ M7.4 — Multi-arrow support  
✓ M7.5 — Interaction refinements  
✓ M7.6 — Completion lock  

------------------------------------------------------------------------

### M7 VALIDATION RECORD — 2026-03-23  
(Final Interaction Polish, Option Propagation Fix, UI Clarity Pass)

[unchanged content preserved]

------------------------------------------------------------------------

### POST-M7 VALIDATION RECORD — 2026-03-24  
(Team Play Delegation, No-Legal-Moves Contract, Team Victory)

Objective:

Validate full team-play lifecycle including delegated dice control,
dead-turn handling, and team-based win detection.

Issues resolved:

• Delegated dice lost controller identity in server → UI could not act  
• Delegated dice incorrectly gated by turn owner instead of controller  
• Pending dice flattening in wsServer removed controllerId  
• No-legal-moves flow regressed to auto-pass behavior  
• Server crash due to actorFinished initialization order  
• Delegated dice not consistently assigned when roller finished  

Root cause:

• wsServer stripped structured pendingDice into primitive values  
• UI action gating tied to turn owner instead of die controller  
• Delegation logic allowed null controller in valid cases  
• Server-side normalization order error (actorFinished usage)  
• Mixed client/server assumptions about die ownership  

Resolution:

• Preserved full pendingDice objects in wsServer (no flattening)  
• Updated UI to use controllerId for:
  - die selection  
  - move execution  
  - legalMoves requests  
• Enforced auto-delegation:
  - if ≥1 eligible teammate → assign immediately  
• Restored explicit no-legal-moves acknowledgment flow  
• Fixed actorFinished initialization ordering in server  
• Verified consistent delegation pipeline end-to-end  

Validated behavior:

• Finished player retains turn correctly  
• Banked dice delegate immediately to teammate  
• Only controlling player can act on delegated die  
• Delegated player receives correct legalMoves  
• No-legal-moves requires explicit player acknowledgment  
• No silent auto-pass behavior  
• Team completion triggers immediate game end  
• Game transitions cleanly back to lobby state  

Result:

• Full team-play loop validated  
• Delegation model stable  
• No-legal-moves contract enforced  
• Team victory condition confirmed  

------------------------------------------------------------------------