# LMR Project After-Action Review Log

Purpose: Capture significant architectural, design, milestone, or
invariant insights. Entries are added only when meaningful signal
exists.

------------------------------------------------------------------------

## Baseline

Log initialized.

------------------------------------------------------------------------

## 2026-02-23 --- WS Turn-Owner Desync Reproduction

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-02-27 --- M6 Foundation + Multi-Team Terminal Hardening

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-02 --- Server ↔ UI Contract Hardening (External Dice Flow)

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-04 --- Console Validation and Rendering Fix

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-05 --- Minimal UI Stabilization

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-06 --- Dice Lifecycle Validation

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-08 --- Debug UI Interaction Model + Visual Prototype Direction

### Context

Session focused on stabilizing the debug UI interaction model and
beginning early visual design exploration for the board UI.

### Debug UI Improvements

Several interaction improvements were implemented in `App.tsx`:

- Pending die selection automatically requests legal moves
  - Clicking a pending die now triggers legal-move display.
  - Eliminates the need for the manual `GetLegalMoves` workflow.

- Dice controls clear after roll
  - Once dice are rolled and become pending, the roll inputs disappear.

- Dynamic roll control
  - Dice input fields dynamically match `eligibleRollCount`.

- Banked dice UI support
  - The dice control area now supports displaying N banked dice.

- Stale move cleanup
  - Move list clears when dice selection changes.

- LegalMoves button demoted to debug
  - Legal moves now appear automatically when a die is selected.

### Validation Results

Manual gameplay testing confirmed:

- Pending dice switching correctly updates legal moves.
- Banked dice lifecycle behaves correctly.
- Move execution updates UI and server state correctly.
- No server contract regressions were observed.

### Visual UI Direction (Early Exploration)

Initial visual prototype work for board pieces began.

Peg visual style:

- simple cylindrical peg

Hole rendering rules:

- hole interior shading only
- no border ring
- peg fills ~98% of hole diameter

### Color System Exploration

A 16-color candidate palette was evaluated for player colors.

Requirements identified:

- colors must remain clearly distinguishable on the board
- avoid near-duplicates in green/blue families
- provide more colors than maximum player count

A provisional palette was accepted pending full-board visualization.

### Key UI Principle Captured

Player color determines the color of:

- pegs
- base area
- home area
- dice

### Outcome

- Debug UI interaction model stabilized
- Server/UI contract validation remains green
- First visual language decisions recorded for board UI

------------------------------------------------------------------------

## 2026-03-09 --- Board Geometry Baseline Lock

### Context

Session focused on reconstructing the canonical board geometry for
4-player, 6-player, and 8-player boards.

### Canonical Arm Module

A single 14-spot arm module was confirmed as the invariant building
block used by all boards.

Track indices:
T0–T13

Home column:
H0–H3

Key landmarks:

- Entry: T6
- Home corner: T4
- One-spot: T8
- Point: T13

### Board Geometry Baselines

4-Player Board  
Accepted as the canonical orthogonal layout.

6-Player Board

- radius ≈ 9
- branch swing ≈ 2.5°

8-Player Board

- radius ≈ 10.6
- branch swing ≈ 4°

### Authority Rule

These diagrams and numeric arm-module specifications now form the
working authority for board layout.

Future rendering or engine geometry must use these references unless
geometry is explicitly reopened.

### Process Observation

Board geometry reconstruction required many visual iteration cycles.

A parameterized preview tool (interactive radius and branch swing)
would significantly reduce iteration time for future geometry work.

------------------------------------------------------------------------

## 2026-03-10 --- Geometry Sandbox & Renderer Foundation (Process Notes)

### What went well

The geometry sandbox renderer proved extremely effective for board
calibration.

Interactive parameter adjustment allowed rapid convergence on visually
uniform spacing for 4-player, 6-player, and 8-player boards.

Centralizing geometry authority in a single file (`boardGeometry.ts`)
worked well. Both sandbox and renderer referencing the same geometry
definitions eliminated the risk of geometry drift.

### What did not work well

Response formatting degraded during longer code-generation exchanges.
Several code blocks required regeneration due to formatting corruption.

Upload limits temporarily blocked the normal continuity-lock workflow.

### Process adjustments

When generating implementation files, responses should contain only:

- file name
- single clean code block

Continuity-lock procedures should allow a text-paste fallback when file
uploads are temporarily unavailable.

------------------------------------------------------------------------

## 2026-03-11 --- UI Render Pipeline Integration

### Context

The graphical board renderer was integrated with the real engine game
state pipeline.

Verified pipeline:

GameState  
→ mapGameStateToUI  
→ mapPositionToBoardHole  
→ BoardRenderer

### Architecture Improvement

The demo message feed previously embedded in `App.tsx` was extracted
into a dedicated state generator:

makeDemoUiState.ts

App.tsx now acts strictly as a renderer composition layer.

### Structural Insight

Isolating demo state generation avoided a likely future refactor.

If demo logic had remained embedded inside `App.tsx`, connecting the UI
to the WebSocket stream later would have required rewriting the
component.

### Environment Note

TypeScript compilation required Node type definitions:

npm install --save-dev @types/node

### Outcome

- UI render pipeline verified operational
- Demo state generator isolated from renderer
- Architecture prepared for WebSocket-driven UI updates

------------------------------------------------------------------------

## 2026-03-13 --- Board-Length Normalization Discovery

### Context

During gameplay testing on an 8-player board, center exits appeared
duplicated rather than covering all valid points.

Expected exits:

13  
27  
41  
55  
69  
83  
97  
111

Observed exits:

13  
27  
41  
55 (repeated)

### Root Cause

Engine normalization used a fixed:

TRACK_LENGTH = 56

This assumption came from the 4-player board and caused incorrect
wrapping on larger boards.

### Resolution

Normalization logic now derives track length from board configuration:

14 track spots × number of arms.

### Validation

Graphical debug UI confirmed:

- correct 8-player center exits
- exits removed when blocked by own peg
- highest home peg produces no legal moves
- board rendering remained correct

### Operational Note

Engine changes appeared ineffective until the development server was
restarted.

Reminder:

npm run dev:server

### Outcome

- hidden board-size assumption removed from engine
- normalization now scales with board size
- correct center exits verified

------------------------------------------------------------------------

## 2026-03-15 --- Multiplayer Initialization Bug Investigation

### Context

During gameplay testing with a 6-player game, the turn sequence advanced:

p0 → p1 → p0 → p1

instead of progressing through the full roster.

### Investigation Pattern

The debugging process followed a useful investigation sequence:

1. Observe gameplay anomaly in UI
2. Inspect authoritative `stateSync` payload
3. Confirm player roster inside engine state
4. Trace initialization path in server (`startGame`)
5. Validate fix using live gameplay loop

### Root Cause

`startGame` was mutating configuration fields on an existing
development game state instead of constructing a fresh state.

As a result:

- config showed `playerCount = 6`
- engine state still contained only players `p0` and `p1`

### Resolution

`startGame` now constructs a new engine state using:

makeState()

The fresh state replaces the room session game before the first
`stateSync`.

### Validation

Testing confirmed:

Players created:

p0 → p1 → p2 → p3 → p4 → p5

Turn sequence:

p0 → p1 → p2 → p3 → p4 → p5 → p0

Gameplay validation confirmed:

- base entry works on rolls 1 and 6
- track movement functions correctly
- kill mechanics operate correctly
- UI remains synchronized with server state

### Process Observation

The debugging sequence proved efficient because validation began with
the authoritative server state (`stateSync`) rather than attempting to
diagnose behavior purely from the UI.

Using server state as the primary diagnostic source should remain the
default debugging approach for engine/UI issues.

### Additional Process Note

Long sessions involving large file outputs again triggered response
formatting corruption in generated code blocks.

When generating file replacements during extended sessions, responses
should contain only:

- filename
- one clean code block

to minimize formatting failure risk.

### Outcome

- multiplayer initialization defect resolved
- debugging workflow pattern reinforced
- response-formatting limitation documented for future sessions