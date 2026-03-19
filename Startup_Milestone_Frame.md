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

## M7 — Gameplay Interaction Layer (Expanded Status)

M7 represents the transition from basic clickable move interaction to
clear, rule-aligned graphical affordance signaling on the board.

Current atomic milestone state:

✓ M7.1 — Multi-die interaction gating stabilization  
✓ M7.2 — Peg arrow affordance pipeline (single-arrow baseline)  
✓ M7.3 — Directional arrow rendering from board geometry  
✓ M7.4 — Multi-arrow per legal move support  
○ M7.5 — Additional gameplay interaction refinements  
→ M7.6 — Milestone completion lock

Notes:

• Arrow indicators are now generated from legal move data and rendered
  at the peg level in board space.  
• Multiple legal moves for a single peg now render as multiple arrows.  
• Arrow direction is derived from from-hole → to-hole geometry rather
  than coarse logical direction guesses.  
• Arrow indicators are informational only; destination spots remain the
  clickable interaction target.  
• Multi-die state remains gated: no arrows are shown until a die is
  explicitly selected when multiple pending dice exist.

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

### M7 VALIDATION RECORD — 2026-03-18  
(Arrow Affordance Layer — Multi-Arrow Directional Rendering)

Objective:

Add board-level arrow affordances that identify all currently legal peg
moves while preserving the existing clickable destination model.

Issues observed during implementation:

• Initial single-arrow-per-peg contract hid some legal choices in
  point-with-1 and center-with-1 cases  
• Early direction derivation based on abstract move categories pointed
  arrows incorrectly relative to board geometry  
• Arrow generation was initially gated on awaitingDice rather than live
  legal move availability  
• Renderer keying and data-shape mismatches caused intermediate React
  warnings and transient runtime failures during development  

Resolution:

• Established legalMoves as the source of truth for arrow generation  
• Reworked arrow payload from pegId + direction to pegId + fromHole +
  toHole  
• Moved final direction derivation into BoardRenderer using actual board
  screen positions  
• Expanded output from one-arrow-per-peg to one-arrow-per-legal-move  
• Kept arrows informational only; destination spots remain the
  interaction target  
• Preserved multi-die gating so arrows remain suppressed until a die is
  selected in ambiguous multi-die states  
• Added unique per-move arrow keys to stabilize React rendering

Validated behavior:

• Movable pegs display arrows only when legal moves exist  
• Pegs with multiple legal moves display multiple arrows  
• Point-with-1 center and track options render distinctly  
• Arrow direction aligns with actual board geometry  
• Existing destination click model remains intact  

Result:

• M7 gameplay affordance layer is now substantively implemented and
  usable  
• Board interaction clarity improved without changing move authority  
• Remaining M7 work, if any, is refinement rather than foundational
  pipeline work

------------------------------------------------------------------------

### M7 VALIDATION RECORD — 2026-03-19  
(Double-Dice Selected-Die Interaction Loop)

Objective:

Complete the selected-die gameplay loop for multi-die turns so that the
active client can switch between pending dice, preview the correct legal
destination for each die, execute a move by clicking the destination,
and consume only the spent die while preserving remaining pending dice.

Issues observed during implementation:

• Room/join and lobby flow initially worked, but the active gameplay UI
  repeatedly drifted between simplified debug App.tsx variants and the
  working multiplayer shell  
• Die clicks sometimes changed local selection state without issuing a
  fresh die-specific legalMoves request  
• legalMoves responses sometimes overwrote the full pending-dice set
  with only the currently selected die  
• move submission initially used stale or inferred move-dice state
  rather than the explicitly selected die  
• moveResult acknowledgement initially updated status text only, leaving
  the board and pending-dice display stale  
• legal move payloads for enter moves did not expose enough die context
  for correct UI-side inference, requiring die-specific refresh requests
  rather than pure local filtering

Root cause:

• onSelectDie was at one point bound to local state update instead of
  the handler that requests getLegalMoves for the chosen die  
• pendingDice lifecycle handling was split incorrectly between roll,
  legalMoves, and moveResult paths  
• the board state after move application was not being refreshed from
  the returned moveResult payload  
• attempted UI-side inference from raw legalMoves payloads was
  insufficient because legalMoves.ts evaluates only the requested die
  input and getLegalMoves must therefore be requested explicitly per
  selected die  
• temporary debug replacements obscured which App.tsx was actually
  active in the project at a given moment

Resolution:

• Restored the real gameplay App.tsx path and re-established the
  multiplayer/double-dice shell as the active working file  
• Bound die clicks to the handler that requests getLegalMoves for the
  explicitly selected die  
• Changed legalMoves handling so pendingDice seeds once when empty but
  is not overwritten by later die-specific legalMoves responses  
• Changed move submission to spend the explicitly selected die  
• Applied returned moveResult next-state data back into the UI so the
  board and pending-dice state refresh immediately after a move  
• Verified server-side legalMoves payloads now carry die attribution for
  generated moves and confirmed handleMessage.ts already routes
  getLegalMoves using the requested die value

Validated behavior:

• Fresh room/lobby flow still works before gameplay  
• With Double Dice enabled, rolling 1 and 6 produces two pending dice  
• Clicking die 1 and die 6 now changes the highlighted legal
  destination appropriately  
• Clicking the highlighted destination applies the move successfully  
• After spending die 6, the peg moves to the point and die 1 remains
  pending for subsequent resolution  
• The selected-die request/preview/execute loop is now functioning end
  to end

Result:

• The selected-die interaction loop is operational in the graphical UI  
• Multi-die gameplay now supports deterministic die selection, preview,
  move execution, and partial pending-die consumption  
• Remaining M7 work is refinement of interaction affordances and cleanup
  rather than restoration of core move authority

------------------------------------------------------------------------
