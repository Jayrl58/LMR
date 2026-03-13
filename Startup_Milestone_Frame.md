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

Remaining M6.6 scope:

• Prevent accidental reconnect into stale active rooms  
• Improve fresh-room startup behavior  
• Clarify room lifecycle controls (join / leave / reset)  
• Finalize multi-die inspection UX for debug panel

Estimated remaining effort for M6.6:

~2–3 hours

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
• Root cause: UI filtering/truncation inside HTTP console move rendering

Resolution:

• Replaced httpConsole.ts rendering logic  
• Console now displays complete legalMoves list

Verified with roll [6,1] producing:

enter:p0:0:6  
enter:p0:1:6  
enter:p0:2:6  
enter:p0:3:6  

followed by:

enterCenter:p0:0:1  
enter:p0:1:1  
enter:p0:2:1  
enter:p0:3:1  
adv:p0:0:1  

Result:

• Server legalMoves generation confirmed correct  
• HTTP console move rendering confirmed correct  
• Prior "UI does not consistently render legalMoves" issue resolved

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-05  
(Minimal UI Debug Client)

A minimal React debug client was introduced to verify that the server
WebSocket contract operates correctly outside the HTTP console.

Environment:

WebSocket server: ws://127.0.0.1:8787  
HTTP console: http://127.0.0.1:8788

Verified interaction loop:

connect  
hello  
joinRoom  
startGame  
roll  
legalMoves  
move  
moveResult  

Observed behavior:

• roll correctly produces legalMoves payload  
• legalMoves includes actorId, dice, die, moves list, and turn snapshot  
• bankedDice correctly appears when rolling 1  
• executing a move consumes the banked die  
• moveResult returns authoritative turn state  
• UI returns to awaitingDice:true when dice resolution completes

Example verified sequence:

roll [1]  
→ legalMoves (bankedDice:1)

move enter:p0:1:1  
→ moveResult

turn state after resolution:

awaitingDice:true

Result:

• Server contract confirmed stable with independent UI client  
• UI correctly reflects turn state transitions  
• Full roll → move → roll loop verified

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-06  
(Minimal UI Dice Lifecycle Validation)

Using the LMR Minimal Debug UI, the authoritative server turn engine was
validated for the full double-dice + bank lifecycle.

Verified behavior:

• pendingDice created correctly from roll  
• pendingDice resolve one die at a time  
• bankedDice persist after partial resolution  
• bank cash-out roll occurs once pendingDice are exhausted  
• bank recalculates from the cash-out roll values  
• roll rejected if pendingDice still exist  
• roll rejected if roll size does not match bankedDice  
• turn advances only when pendingDice = 0 and bankedDice = 0

Defect discovered during validation:

• `bankedDice` was not included in `moveResult.turn`, preventing the UI
from displaying owed dice after a move.

Resolution:

• handleMessage.ts updated so `moveResult.turn` includes `bankedDice`
during both intermediate and terminal resolution states.

Result:

• Server turn engine verified correct for the double-dice + bank
lifecycle using the Minimal Debug UI client.

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-08  
(UI Rendering Model Definition)

During UI exploration using the Minimal Debug UI client, the visual
presentation model for board pieces and board spaces was defined.

Peg Rendering Model:

• Pegs render as solid cylinders with flat circular tops  
• Peg fully replaces the board space when present  
• Hole is not rendered beneath a peg  
• Peg style uses subtle top highlight and soft side gradient  
• Peg outline remains minimal to preserve color clarity  

Hole Rendering Model:

• Empty board spaces render as shaded circular depressions  
• No visible rim or border is drawn  
• Hole depth indicated only by radial interior shading  

Rendering Rule:

occupied space → drawPeg()  
empty space → drawHole()

Color Palette Definition:

A provisional 16-color peg palette was defined for player selection
without exhausting options for late joiners.

Palette:

Blue  
Red  
Green  
Yellow  
Purple  
Orange  
Cyan  
Pink  
Lime  
Teal  
Magenta  
Navy  
Brown  
White  
Black  
Coral

Status:

• Peg geometry model defined  
• Board hole rendering model defined  
• Candidate peg color palette defined  

These assets remain provisional pending validation on a full board
layout during M6 UI development.

Result:

• Foundational visual design for the board layer established  
• Ready to proceed into M6 UI Integration & Presentation

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-09  
(Board Geometry Baseline Lock)

Canonical board geometry references for the 4-player, 6-player, and
8-player boards were reconstructed and verified.

Artifacts preserved:

Playpen/board_geometry/

• LMR_board_reference_4p.png  
• LMR_board_reference_6p.png  
• LMR_board_reference_8p.png  
• LMR_board_geometry_spec.md  

Geometry source files:

Geometry files/

• B4_geometry.csv  
• B6_geometry.csv  
• B8_geometry.csv  
• Track Index Table.xlsx  

Key geometry invariants:

• All boards use the same 14-spot arm module (T0–T13 track + H0–H3 home column)  
• The home column always points toward the board center  
• Perimeter continuity rule: PiT13 → P(i+1)T0 (clockwise traversal)

Accepted visual baselines:

4-Player board — orthogonal reference layout

6-Player board  
radius ≈ 9  
branch swing ≈ 2.5°

8-Player board  
radius ≈ 10.6  
branch swing ≈ 4°

These diagrams now serve as the working authority for board layout
unless board geometry is explicitly reopened.

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-10  
(Sandbox Geometry Authority Freeze)

A geometry verification sandbox renderer was introduced to validate
board layout geometry using the canonical arm model.

Sandbox capabilities:

• Visual rendering of 4-player, 6-player, and 8-player boards  
• Adjustable parameters:
  - T6 radius  
  - spot spacing  
  - branch swing  
  - hole size  
• Track continuity overlay  
• Direction arrows for perimeter traversal  
• Join-distance measurement overlay  
• Spot ID labeling for debugging

Accepted calibration set:

4-player board  
T6 radius: 7  
spot spacing: 56  
branch swing: 0  
hole radius: 10  
join distance ≈ 56  

6-player board  
T6 radius: 9  
spot spacing: 40  
branch swing: -3.6  
hole radius: 8  
join distance ≈ 40  

8-player board  
T6 radius: 10.6  
spot spacing: 31  
branch swing: -3.6  
hole radius: 6.6  
join distance ≈ 31.2  

Geometry authority consolidation:

Shared geometry source:

Playpen/board_geometry/boardGeometry.ts

Contents:

• BOARD_GEOMETRY — calibrated geometry parameters  
• CANONICAL_ARM — grid coordinates for the 14-spot arm module  
• TRACK_LOOP_ORDER — canonical track traversal order  

Both the sandbox renderer and the future gameplay board renderer now
reference this shared geometry authority.

Result:

• Board geometry calibration completed  
• Geometry authority centralized  
• Sandbox renderer validated for all board sizes  
• Project ready to proceed with the gameplay board renderer in M6

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-11  
(UI Render Pipeline Integration)

The graphical board renderer was successfully integrated with the real
engine game state pipeline.

Rendering pipeline verified:

GameState  
→ mapGameStateToUI  
→ mapPositionToBoardHole  
→ BoardRenderer

Structural UI changes implemented:

• Demo message feed removed from App.tsx  
• Demo state generation isolated into makeDemoUiState.ts  
• App.tsx reduced to renderer composition layer  
• Offline simulator updated to current UiController API  
• Node type definitions installed for stable TypeScript builds

Result:

• BoardRenderer now renders peg placements derived from real mapped
game state  
• UI architecture prepared for live WebSocket message integration  
• M6 graphical board UI work can proceed on top of the verified pipeline

------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Debug UI Lifecycle Stabilization)

Objective:

Complete the remaining M6.6 work by refining the debug UI room lifecycle
behavior and eliminating stale-room reconnection issues.

Improvements implemented:

• Introduced explicit "Create Fresh Room" workflow in the debug client  
• Separated editable room code from joined room state  
• Reset session UI state before joining or leaving rooms  
• Cleared room state on WebSocket disconnect  
• Disabled lifecycle controls when invalid (connect/join/leave guards)  
• Disabled "Leave Room" during active gameplay to prevent server
  rejection of leaveRoom requests

Validation performed:

connect  
createFreshRoom  
joinRoom  
startGame  
leaveRoom (disabled during active phase)  
createFreshRoom  
joinRoom

Results:

• No stale-room reconnection observed  
• Fresh-room startup consistently produces clean lobby state  
• UI lifecycle controls now match server lifecycle constraints  
• Debug client workflow confirmed stable for repeated test sessions

Result:

• M6.6 Debug UI console refinement completed  
• M6 Graphical Board UI milestone closed successfully


------------------------------------------------------------------------

### POST-COMPLETE VALIDATION — 2026-03-13  
(Board-Length Normalization & Center Exit Verification)

Objective:

Verify correct gameplay behavior on boards larger than the original
56‑track assumption by validating board-length–aware normalization and
center exit generation.

Engine corrections validated:

• Removed fixed TRACK_LENGTH assumptions in engine logic  
• Implemented board-size–aware track normalization based on the
  14‑spot arm module  
• Confirmed correct track traversal for 4-player, 6-player, and
  8-player boards

Center mechanics validation:

• Verified center entry behavior using a roll of 1  
• Verified center exit generation on the 8-player board produces
  eight distinct exits:

  13  
  27  
  41  
  55  
  69  
  83  
  97  
  111

Rules enforcement verified:

• Center exits correctly blocked when the destination point is
  occupied by the player's own peg  
• Pegs located in the highest home spot generate no legal moves  
• Legal move generation reflects correct board size

Rendering verification:

• Center hole rendering corrected to match standard track holes  
• Peg in center position confirmed visible in BoardRenderer  
• Verified correct board rendering for 4P, 6P, and 8P boards using
  the live debug UI client

Result:

• Board-length normalization verified across all supported board sizes  
• Center exit logic confirmed correct for the 8-player board  
• Rendering and rules engine now aligned for center mechanics
