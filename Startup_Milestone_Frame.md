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

Validated runtime behavior (external dice mode, double-dice enabled):

• Verified double-dice sequencing with roll [1,2]  
• Verified banked-die behavior (1 or 6 banks one die)  
• Verified enter-on-1 from base  
• Verified pendingDice roll gating (BAD_TURN_STATE enforced)  
• Verified NOT_YOUR_TURN enforcement  
• Verified correct turn retention after partial resolution  
• Verified correct turn advance after full resolution  

Verified legalMoves payload includes:

• actorId  
• dice array  
• active die value  
• moves list  
• turn snapshot  

Verified turn payload includes pendingDice and bankedDice when applicable.

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-04  
(HTTP Console Rendering)

Issue identified during console validation session:

• Server emitted full legalMoves payload correctly  
• HTTP console Moves table rendered only the first move  

Root cause:

• UI filtering/truncation inside HTTP console move rendering

Resolution:

• Replaced httpConsole.ts rendering logic  
• Console now displays complete legalMoves list

Result:

• Server legalMoves generation confirmed correct  
• HTTP console move rendering confirmed correct

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-05  
(Minimal UI Debug Client)

A minimal React debug client was introduced to verify that the server
WebSocket contract operates correctly outside the HTTP console.

Environment:

WebSocket server: ws://127.0.0.1:8787  
HTTP console: http://127.0.0.1:8788

Verified interaction loop:

connect → hello → joinRoom → startGame → roll → legalMoves → move → moveResult

Result:

• Server contract confirmed stable with independent UI client  
• UI correctly reflects turn state transitions  
• Full roll → move → roll loop verified

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-06  
(Minimal UI Dice Lifecycle Validation)

Validated the authoritative server turn engine for the full
double-dice + bank lifecycle.

Verified:

• pendingDice creation from roll  
• sequential die resolution  
• bank persistence after partial resolution  
• cash-out roll behavior  
• roll rejection when pendingDice exist  
• roll rejection when roll size mismatches bankedDice  
• turn advance only when pendingDice = 0 and bankedDice = 0

Fix implemented:

• `bankedDice` added to `moveResult.turn` so UI can display owed dice.

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-08  
(UI Rendering Model Definition)

Defined visual presentation model for board spaces and pegs.

Peg model:

• Solid cylinders with flat circular tops  
• Peg replaces the hole when present  
• Subtle highlight and side gradient

Hole model:

• Shaded circular depressions  
• No rim or border  
• Radial interior shading indicates depth

Rendering rule:

occupied space → drawPeg()  
empty space → drawHole()

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-09  
(Board Geometry Baseline Lock)

Canonical board geometry references verified and locked for
4-player, 6-player, and 8-player boards.

Geometry invariants:

• All boards use the same 14-spot arm module  
• Home column always points toward board center  
• Perimeter rule: PiT13 → P(i+1)T0

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-10  
(Sandbox Geometry Authority Freeze)

Introduced geometry sandbox renderer to validate board layout.

Capabilities:

• Render 4P / 6P / 8P boards  
• Adjustable geometry parameters  
• Track continuity overlays  
• Spot ID labeling

Result:

• Geometry authority centralized  
• Sandbox renderer validated for all board sizes

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-11  
(UI Render Pipeline Integration)

Rendering pipeline verified:

GameState  
→ mapGameStateToUI  
→ mapPositionToBoardHole  
→ BoardRenderer

Result:

• Renderer now displays pegs based on real engine state  
• UI architecture prepared for live WebSocket integration

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Debug UI Lifecycle Stabilization)

Debug UI room lifecycle improvements:

• Explicit "Create Fresh Room" workflow  
• Session reset on disconnect  
• Guarded connect/join/leave actions  
• Leave disabled during active gameplay

Result:

• Stable repeated testing sessions  
• No stale-room reconnection issues

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Board-Length Normalization & Center Exit Verification)

Verified board-length normalization for larger boards.

Engine corrections:

• Removed fixed TRACK_LENGTH assumptions  
• Implemented board-size–aware normalization

Validated:

• Center entry and exit logic  
• Eight exits on 8-player board  
• Legal move generation matches board size

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-15  
(Multi-Player Start State Initialization Fix)

Objective:

Resolve a defect where games started with playerCount > 2
initialized with only two players due to reuse of an existing
development game state.

Observed behavior:

• startGame recorded correct playerCount in config  
• Engine state contained only p0 and p1  
• Turn order alternated only between those two players

Root cause:

• Server mutated configuration fields on an existing state instead of
creating a new game instance.

Resolution:

• startGame now constructs a fresh state via makeState() using
the requested player count and options.  
• The new state replaces the previous session game before the initial
stateSync.

Validation performed:

Game started with:

playerCount: 6  
doubleDice: true  
killRoll: true  

Verified:

• Players created: p0 → p5  
• Peg states generated for all players  
• Initial actor correctly p0

Turn sequence confirmed:

p0 → p1 → p2 → p3 → p4 → p5 → p0

Gameplay checks during same session:

• Base entry allowed on rolls 1 and 6  
• Track movement functioning correctly  
• Kill mechanics functioning correctly  
• UI rendering synchronized with authoritative server state

Result:

• Multi-player initialization verified correct  
• Turn sequencing validated across full roster  
• Engine/UI gameplay loop confirmed stable