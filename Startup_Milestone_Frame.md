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
→ M7 — Gameplay Interaction Layer  
→ M8 — Game Completion & Results  
→ M9 — Production Readiness

------------------------------------------------------------------------

## M6 — Graphical Board UI (Expanded Status)

M6 represents the transition from server-only validation tools to a
functional graphical client capable of rendering game state and
interacting with the authoritative server engine.

Current atomic milestone state:

✓ M6.1 — WebSocket client connection  
✓ M6.2 — Board renderer integration  
✓ M6.3 — Roll / legalMoves / move interaction loop  
✓ M6.4 — Dice contract compatibility (double-dice + bank lifecycle)  
✓ M6.5 — Functional gameplay loop validation  
✓ M6.6 — Debug UI console refinement  

------------------------------------------------------------------------

## Post-Completion Validation Records

These records document engineering validation performed after milestone
completion and serve as the authoritative technical history of milestone
verification.

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-02  
(Server ↔ UI Contract Hardening)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-04  
(HTTP Console Rendering)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-05  
(Minimal UI Debug Client)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-06  
(Minimal UI Dice Lifecycle Validation)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-08  
(UI Rendering Model Definition)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-09  
(Board Geometry Baseline Lock)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-10  
(Sandbox Geometry Authority Freeze)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-11  
(UI Render Pipeline Integration)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Debug UI Lifecycle Stabilization)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Board-Length Normalization & Center Exit Verification)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-15  
(Multi-Player Start State Initialization Fix)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-16  
(Board Ownership Styling & Dynamic Arm Color Binding)

[UNCHANGED]

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-17  
(UI Interaction Gating Stabilization — Multi-Die Control)

Objective:

Eliminate ambiguous UI behavior when multiple pending dice exist by
enforcing explicit die selection prior to move preview and peg
interaction.

Issues observed:

• Legal move previews appeared without explicit die selection  
• UI defaulted implicitly to first pending die  
• Peg selection allowed without die context  
• Visual state did not clearly represent active decision context  

Root cause:

• UI accepted and rendered legalMoves payloads regardless of die
selection state  
• selectedDie persisted incorrectly across state transitions  
• No gating between pendingDice count and legalMoves visibility  

Resolution:

• Enforced peg click guard requiring selected die  
• Cleared stale selectedDie unless exactly one pending die exists  
• Blocked legalMoves rendering when multiple pending dice exist and no
die is selected  
• Removed implicit “first die” fallback behavior  
• Added request guard preventing legalMoves queries without die
selection in multi-die state  

Validated behavior:

• Multi-die roll produces neutral board until die is selected  
• Selecting a die produces correct legal move preview  
• Peg click without die produces explicit instruction message  
• No automatic or implicit die selection occurs  
• Legal moves correspond only to explicitly selected die  

Result:

• UI interaction model now deterministic and rule-aligned  
• Eliminates hidden state ambiguity in player decision flow  
• Establishes foundation for future visual affordance layer (M7)

------------------------------------------------------------------------