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

-   **Pending die selection automatically requests legal moves**
    -   Clicking a pending die now triggers legal-move display.
    -   Eliminates the need for the manual `GetLegalMoves` workflow.
-   **Dice controls clear after roll**
    -   Once dice are rolled and become pending, the roll inputs
        disappear.
-   **Dynamic roll control**
    -   Dice input fields dynamically match `eligibleRollCount` so the
        UI always shows exactly the number of dice the player is allowed
        to roll.
-   **Banked dice UI support**
    -   The dice control area now supports displaying N banked dice.
-   **Stale move cleanup**
    -   Move list clears when dice selection changes to prevent stale
        move execution.
-   **LegalMoves button demoted to debug**
    -   Legal moves are now automatically displayed when a die is
        selected.
    -   Manual request remains only as a debug tool.

### Validation Results

Manual gameplay testing confirmed:

-   Pending dice switching correctly updates legal moves.
-   Banked dice lifecycle behaves correctly.
-   Move execution updates UI and server state correctly.
-   No server contract regressions were observed.

### Visual UI Direction (Early Exploration)

Initial visual prototype work for board pieces began:

-   Peg visual style selected: **simple cylindrical peg**
-   Board view uses **top-down peg representation**
-   Hole rendering rules:
    -   hole interior shading only
    -   **no border ring**
-   Peg visually fills **\~98% of hole diameter**.

### Color System Exploration

A 16-color candidate palette was evaluated for player colors.

Requirements identified:

-   Colors must remain clearly distinguishable on the board.
-   Avoid near-duplicates in green/blue families.
-   Provide more colors than maximum player count to avoid forced
    assignment.

A provisional **16-color palette** was accepted pending full-board
visualization testing.

### Key UI Principle Captured

Player color determines the color of:

-   pegs
-   base area
-   home area
-   dice

This establishes a consistent visual identity for each player.

### Outcome

-   Debug UI interaction model stabilized.
-   Server/UI contract validation remains green.
-   First concrete visual language decisions recorded for the board UI.

------------------------------------------------------------------------

## 2026-03-09 --- Board Geometry Baseline Lock

### Context

Session focused on reconstructing the canonical board geometry for
4-player, 6-player, and 8-player boards from arm-module definitions and
visual references.

Geometry was derived iteratively by rendering boards, validating arm
placement, and adjusting radius and branch swing until perimeter
connections and visual spacing matched the physical board references.

### Canonical Arm Module

A single 14-spot arm module was confirmed as the invariant building
block used by all boards.

Track indices:\
T0--T13

Home column:\
H0--H3

Key landmarks:

-   Entry: T6
-   Home corner: T4
-   One-spot: T8
-   Point: T13

The arm geometry itself never changes. Board sizes differ only by the
rotation and radius used when placing arms around the center.

### Board Geometry Baselines

**4-Player Board**

Accepted as the canonical orthogonal layout.

Reference file:

LMR_board_reference_4p.png

**6-Player Board**

Accepted with visually validated parameters:

-   radius ≈ 9
-   branch swing ≈ 2.5°

Reference file:

LMR_board_reference_6p.png

**8-Player Board**

Accepted with visually validated parameters:

-   radius ≈ 10.6
-   branch swing ≈ 4°

Reference file:

LMR_board_reference_8p.png

### Geometry Authority Artifacts

The following files were preserved and committed:

Board references

-   LMR_board_reference_4p.png
-   LMR_board_reference_6p.png
-   LMR_board_reference_8p.png

Geometry specification

-   LMR_board_geometry_spec.md

Source coordinate data

-   B4_geometry.csv
-   B6_geometry.csv
-   B8_geometry.csv
-   Track Index Table.xlsx

### Authority Rule

These diagrams and the numeric arm-module specification now form the
working authority for board layout.

Future rendering, UI work, or engine geometry must use these references
unless board geometry is explicitly reopened and a new baseline is
approved.

### Geometry Reconstruction Process Observations

The board geometry reconstruction required a large number of visual
iteration cycles. The workflow relied on repeatedly exporting static
render images, manually inspecting them, and adjusting parameters
(radius and branch swing) until the arm connections visually matched
reference boards.

This approach proved reliable but inefficient.

A parameterized preview tool (interactive radius and branch swing
controls with immediate board redraw) would likely reduce the iteration
cycle dramatically for future geometry work.

### Renderer Verification Gap

During the session it became clear that describing the arm construction
rule alone does not guarantee that a renderer can reproduce the board
layout correctly.

A successful proof requires a renderer capable of generating a board
that matches the accepted reference diagrams exactly. A stylized board
illustration does not satisfy this requirement.

Future UI work (M6.1) should therefore include an early **geometry
verification renderer** capable of producing a board from the arm
specification and placement parameters.

This renderer should be used to validate geometry authority files before
full graphical UI development begins.

------------------------------------------------------------------------

## 2026-03-10 --- Geometry Sandbox & Renderer Foundation (Process Notes)

### What went well

The geometry sandbox renderer proved extremely effective for board
calibration. Interactive parameter adjustment allowed rapid convergence
on visually uniform spacing for 4-player, 6-player, and 8-player boards.

Centralizing geometry authority in a single file (`boardGeometry.ts`)
worked well. Both the sandbox and renderer referencing the same geometry
definitions eliminated the risk of geometry drift between development
tools and gameplay UI code.

Early verification of the renderer skeleton against all three board
configurations confirmed that the canonical arm replication model is
sufficient to reproduce the board layouts.

### What did not work well

Response formatting degraded during longer code-generation exchanges.
Several code blocks required regeneration due to formatting corruption,
which slowed the development loop.

Upload limits temporarily blocked the normal continuity-lock workflow.
Manual text pasting was required to complete milestone confirmation.

### Process adjustments

When generating implementation files, responses should be restricted to:

-   file name
-   single clean code block

This reduces formatting failure risk during long sessions.

Continuity-lock procedures should allow a text-paste fallback when file
uploads are temporarily unavailable.

------------------------------------------------------------------------

## 2026-03-11 --- UI Render Pipeline Integration

### Context

The graphical board renderer was integrated with the real engine game
state pipeline, completing the first operational version of the board UI
rendering path.

Verified pipeline:

GameState\
→ mapGameStateToUI\
→ mapPositionToBoardHole\
→ BoardRenderer

### Architecture Improvement

The demo message feed previously embedded in `App.tsx` was extracted
into a dedicated state generator:

`makeDemoUiState.ts`

`App.tsx` now acts strictly as a **renderer composition layer**.

Resulting UI structure:

App.tsx\
→ makeDemoUiState.ts\
→ BoardRenderer

### What went well

Separating the demo state generator from the renderer simplified the UI
architecture and made the rendering pipeline easier to reason about.

The pipeline now mirrors the eventual production structure where server
WebSocket messages will drive the `UiController`.

### Structural Insight

This separation avoided a likely future refactor.

If the demo message logic had remained embedded inside `App.tsx`,
connecting the UI to the WebSocket stream later would have required
rewriting the entire component. By isolating demo state generation
early, the UI can now transition to live server events simply by
replacing the demo generator with a real message source.

This preserves the renderer layer and prevents architectural churn
during later milestones.

### Process Observation

Several debugging iterations were initially spent resolving module
imports because the project structure was inferred rather than derived
from an existing working import.

Future TypeScript debugging should begin by copying an import path from
a working file (such as `App.tsx`) to avoid path-guessing cycles.

### Environment Note

TypeScript compilation required Node type definitions.

Installed via:

npm install --save-dev @types/node

### Outcome

• UI render pipeline verified operational\
• Demo state generator isolated from renderer\
• Architecture prepared for WebSocket-driven UI updates\
• M6 graphical board UI work can proceed on top of a stable pipeline

------------------------------------------------------------------------

## 2026-03-13 --- Board-Length Normalization Discovery

### Context

During gameplay testing of the graphical debug UI on an 8-player board,
legal moves generated for center exits appeared duplicated rather than
covering the full set of point exits.

Initial symptoms:

• center exit moves repeated only the first four points\
• expected exits: 13, 27, 41, 55, 69, 83, 97, 111\
• observed exits: 13, 27, 41, 55 (repeated)

Investigation revealed that the engine still contained a fixed
`TRACK_LENGTH = 56` normalization assumption derived from the 4-player
board.

### Root Cause

Track index normalization inside the engine used a constant track length
instead of deriving the correct track length from the board
configuration.

This caused indices beyond 56 to wrap incorrectly, producing duplicated
legal moves on larger boards.

### Resolution

Engine normalization logic was updated to use board-size--aware track
length derived from the canonical arm module:

14 track spots per arm × number of arms.

This allows correct normalization for:

• 4-player board\
• 6-player board\
• 8-player board

### Validation

Graphical debug UI gameplay confirmed:

• center exits correctly generated for all 8 points on the 8-player
board\
• exits removed when occupied by the player's own pegs\
• pegs in the highest home spot produce no legal moves\
• center peg rendering and board rendering remained correct

### Operational Note

During debugging, engine changes appeared ineffective until the
development server was restarted.

Reminder:

npm run dev:server

### Outcome

• Hidden board-size assumption removed from engine\
• Track normalization now scales with board size\
• Correct center exit generation verified for 8-player boards
