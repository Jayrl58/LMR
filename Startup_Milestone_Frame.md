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
○ M7 — Gameplay Interaction Layer  
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
○ M7.5 — Interaction refinements  
→ M7.6 — Completion lock  

------------------------------------------------------------------------

### M7 VALIDATION RECORD — 2026-03-22  
(Turn-Envelope Merge, Multi-Die Stability, Auto-Selection Refinement)

Objective:

Stabilize gameplay loop by aligning server turn-envelope authority with UI state and completing die interaction flow.

Issues observed:

• Zero-move multi-die rolls incorrectly cleared pending dice  
• Turn ownership desynced between clients  
• Final die required manual reselection  

Root cause:

• Server auto-pass logic on zero-move roll  
• UI not merging authoritative turn envelope  
• Auto-select did not trigger legalMoves  

Resolution:

• Server: removed auto-pass, preserved pending dice  
• UI: merged turn envelope into gameState  
• UI: direct getLegalMoves on die select  
• UI: auto-select + auto-request for final die  

Validated behavior:

• Pending dice persist correctly  
• Legal moves display reliably  
• Final die auto-displays moves  
• Turn advances correctly across players  

Result:

• Gameplay loop stable  
• Server/UI contract aligned  
• Ready for continuity lock  

------------------------------------------------------------------------
