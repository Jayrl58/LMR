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
-   Board view uses **top‑down peg representation**
-   Hole rendering rules:
    -   hole interior shading only
    -   **no border ring**
-   Peg visually fills **\~98% of hole diameter**.

### Color System Exploration

A 16‑color candidate palette was evaluated for player colors.

Requirements identified:

-   Colors must remain clearly distinguishable on the board.
-   Avoid near‑duplicates in green/blue families.
-   Provide more colors than maximum player count to avoid forced
    assignment.

A provisional **16‑color palette** was accepted pending full-board
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
