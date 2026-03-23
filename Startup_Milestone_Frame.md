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

Objective:

Finalize gameplay interaction layer, eliminate UI ambiguity, and ensure full alignment between lobby configuration, server state, and UI rendering.

Issues resolved:

• Selected die lacked sufficient visual clarity  
• Peg selection did not fully control destination visibility  
• Background click did not fully clear interaction state  
• Movable peg highlighting lacked clarity across zones (base, track, point, one spot)  
• Dice panel layout lacked clarity and stability  
• Status panel contained non-player-facing data  
• Options display did not match selected pregame configuration  
• Server failed to propagate lobby options (killRoll, etc.) into active game config  

Root cause:

• Insufficient visual hierarchy for selected die  
• Destination highlight logic not gated by peg selection  
• UI/state coupling incomplete for deselection  
• Highlight strategy too subtle (color-based vs structural)  
• Dice panel not aligned with final interaction model  
• Status panel mixing debug + player-facing concerns  
• Options bound to incorrect config path  
• Server startGame did not merge lobby configuration  

Resolution:

• Implemented strong structural highlight for selected die (ring + elevation + scale)  
• Enforced rule: no peg selected → no destination highlights  
• Added background click → full peg deselection  
• Implemented outer glow highlight for movable pegs across all zones  
• Refined dice panel:
  - Roll vs In-Play dynamic rows  
  - Player-colored dice inputs  
  - Overlay positioning (top-right of rotated view)  
• Split UI panels:
  - Status (Player + Turn only)  
  - Options (lower-left, game-facing only)  
  - Debug (right side, full state visibility)  
• Corrected UI binding to `gameState.config.options`  
• Fixed server propagation:
  - Merged `room.gameConfig` into active game config at startGame  

Validated behavior:

• Selected die is visually unambiguous  
• Peg selection cleanly controls all highlights  
• Background click fully resets interaction state  
• Movable pegs clearly identifiable in all zones  
• Dice flow (roll → in-play) behaves intuitively  
• Status panel is minimal and readable  
• Options panel reflects actual game configuration  
• Server/UI contract fully aligned  
• Debug panel confirms correct state at all times  

Result:

• Gameplay interaction layer complete  
• UI clarity achieved across all interaction surfaces  
• Server and UI fully synchronized  
• Ready for milestone transition  

------------------------------------------------------------------------