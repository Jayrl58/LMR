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

- **Pending die selection automatically requests legal moves**
  - Clicking a pending die now triggers legal-move display.
  - Eliminates the need for the manual `GetLegalMoves` workflow.

- **Dice controls clear after roll**
  - Once dice are rolled and become pending, the roll inputs disappear.

- **Dynamic roll control**
  - Dice input fields dynamically match `eligibleRollCount` so the UI
    always shows exactly the number of dice the player is allowed to
    roll.

- **Banked dice UI support**
  - The dice control area now supports displaying N banked dice.

- **Stale move cleanup**
  - Move list clears when dice selection changes to prevent stale move
    execution.

- **LegalMoves button demoted to debug**
  - Legal moves are now automatically displayed when a die is selected.
  - Manual request remains only as a debug tool.

### Validation Results

Manual gameplay testing confirmed:

- Pending dice switching correctly updates legal moves.
- Banked dice lifecycle behaves correctly.
- Move execution updates UI and server state correctly.
- No server contract regressions were observed.

### Visual UI Direction (Early Exploration)

Initial visual prototype work for board pieces began:

- Peg visual style selected: **simple cylindrical peg**
- Board view uses **top-down peg representation**
- Hole rendering rules:
  - hole interior shading only
  - **no border ring**
- Peg visually fills **~98% of hole diameter**.

### Color System Exploration

A 16-color candidate palette was evaluated for player colors.

Requirements identified:

- Colors must remain clearly distinguishable on the board.
- Avoid near-duplicates in green/blue families.
- Provide more colors than maximum player count to avoid forced
  assignment.

A provisional **16-color palette** was accepted pending full-board
visualization testing.

### Key UI Principle Captured

Player color determines the color of:

- pegs
- base area
- home area
- dice

This establishes a consistent visual identity for each player.

### Outcome

- Debug UI interaction model stabilized.
- Server/UI contract validation remains green.
- First concrete visual language decisions recorded for the board UI.

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

Track indices:  
T0–T13

Home column:  
H0–H3

Key landmarks:

- Entry: T6
- Home corner: T4
- One-spot: T8
- Point: T13

The arm geometry itself never changes. Board sizes differ only by the
rotation and radius used when placing arms around the center.

### Board Geometry Baselines

**4-Player Board**

Accepted as the canonical orthogonal layout.

Reference file:

LMR_board_reference_4p.png

**6-Player Board**

Accepted with visually validated parameters:

- radius ≈ 9
- branch swing ≈ 2.5°

Reference file:

LMR_board_reference_6p.png

**8-Player Board**

Accepted with visually validated parameters:

- radius ≈ 10.6
- branch swing ≈ 4°

Reference file:

LMR_board_reference_8p.png

### Geometry Authority Artifacts

The following files were preserved and committed:

Board references

- LMR_board_reference_4p.png
- LMR_board_reference_6p.png
- LMR_board_reference_8p.png

Geometry specification

- LMR_board_geometry_spec.md

Source coordinate data

- B4_geometry.csv
- B6_geometry.csv
- B8_geometry.csv
- Track Index Table.xlsx

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
```

---

### Next question you asked earlier

You also wanted to know **what tool would have made today’s geometry work much easier**.

That tool is essentially a **live geometry preview renderer**:

* sliders for **radius**
* sliders for **branch swing**
* instant redraw of the board
* no export-image / inspect / regenerate cycle

You visually dial the parameters in **seconds instead of dozens of PNG iterations**.

Next message I can show you **exactly what that tool would look like conceptually** and how simple it would be to build inside the LMR dev UI.
