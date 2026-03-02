# LMR Project After-Action Review Log

Purpose: Capture significant architectural, design, milestone, or
invariant insights. Entries are added only when meaningful signal
exists.

------------------------------------------------------------------------

## Baseline

Log initialized.

------------------------------------------------------------------------

## 2026-02-23 --- WS Turn-Owner Desync Reproduction

### Context

Live WebSocket multi-client validation (2P, doubleDice ON, killRoll OFF)
using localhost:8788 console windows.

### What Was Verified

-   Banked dice behavior on rolling `1` works as designed.
-   Pending dice consumption flow works correctly.
-   Turn advances correctly after final pending die is consumed.
-   No-legal-moves pass behavior functions (p1 rolled 2/3 with all pegs
    in base → turn advanced to p0).

### Issue Reproduced

Observed mismatch between: - `state.turn.currentPlayerId` (engine
state) - Server session-level `turn.nextActorId`

Server enforced `NOT_YOUR_TURN` based on session expectation even when
one client believed it was that client's turn.

### Technical Observations

-   `stateHash` stability does not imply turn-owner stability (hash
    excludes session metadata).
-   Engine state and server session turn metadata can diverge.
-   Multi-window WS testing exposes synchronization issues not visible
    in engine-only tests.

### Lessons

-   Distinguish clearly between engine authority and session-layer turn
    metadata.
-   When debugging turn issues, always capture:
    -   `moveResult`
    -   `legalMoves`
    -   `stateSync`
    -   `NOT_YOUR_TURN` errors
-   Console duplication of `moveResult` can create noise; rely on first
    authoritative instance.

### Actionable Improvement Ideas

-   Add explicit diagnostic logging in `wsServer.ts` for:
    -   received actorId
    -   authoritative currentPlayerId
    -   session nextActorId
-   Consider adding a visible debug panel showing:
    -   engine turn owner
    -   session turn owner
    -   pendingDice/bankedDice state

------------------------------------------------------------------------

## Process Notes --- Session Discipline

-   Long live-debug sessions increase cognitive fatigue and reduce
    precision.
-   Safe-stop breadcrumb method (commit hash + roomJoined lines) was
    effective.
-   Repository discipline maintained; no authority drift occurred.

------------------------------------------------------------------------

(End of entries)

------------------------------------------------------------------------

## 2026-02-27 --- M6 Foundation + Multi-Team Terminal Hardening

### Context

Session focused on early M6 groundwork and reinforcing terminal
invariants for 3x2 and 4x2 team modes.

### What Was Implemented

-   Introduced `src/ui/board/boardViewModel.ts`
    -   Added `normalizeDeg`
    -   Added `computeBoardRotationDeg`
-   Added `test/ui.boardViewModel.test.ts`
    -   Covered 4P, 6P, 8P rotation
    -   Covered diagram-bottom override behavior

### Terminal Behavior Hardening

-   Strengthened tests for:
    -   `server.moveResult.turnConsistency`
    -   `server.teamPlay.finisherKeepsTurn`
    -   `teamPlay.winningTeamFinishOrder`
-   Explicit 6P and 8P validation that:
    -   First team completion immediately ends game
    -   No optional continuation for placement exists
    -   No further lifecycle progression occurs after terminal
        recognition

### Architectural Significance

-   First concrete artifact under active `src/ui`
-   Established deterministic rotation contract before any rendering
    layer exists
-   Locked multi-team end-of-game semantics at engine + server contract
    level

### Process Notes

-   Download artifact instability required switching to inline full-file
    creation.
-   Avoided committing `ui__quarantined/` during selective add.
-   Reinforced discipline of explicit file adds over `git add .`.

------------------------------------------------------------------------

## 2026-03-02 --- Server ↔ UI Contract Hardening (External Dice Flow)

### Context

Live WebSocket multi-client validation (2P, doubleDice ON, killRoll OFF)
using localhost:8788 console and multiple browser sessions.

### What Was Verified

- Double-dice sequencing with roll `[1,2]` behaves deterministically.
- Banked die behavior confirmed (1 and 6 bank one die).
- Pending dice must resolve before roll (`BAD_TURN_STATE` enforced).
- `NOT_YOUR_TURN` enforcement confirmed.
- Enter-on-1 from base validated.
- Correct turn retention after partial resolution.
- Correct turn advance after full resolution.
- `legalMoves` payload structure confirmed to include:
  - actorId
  - dice array
  - active die value
  - moves list
  - turn snapshot
- `turn` payload includes `pendingDice` and `bankedDice` when applicable.

### Observed Friction

- Window context confusion (prototype vs console vs multiple clients).
- Intermittent “No legalMoves received yet” states during external dice testing.
- Actor claim switching (p0/p1) not visually obvious in console UI.

### Technical Observations

- Server behavior appears internally consistent when correct actor and
  window context are used.
- Intermittent missing `legalMoves` likely UI handling rather than engine emission.
- No engine regressions detected.
- Server↔UI contract not yet formally documented.

### Next Focus

Isolate and deterministically reproduce intermittent missing `legalMoves`
in external dice flow to confirm whether issue is emission-layer or UI-layer.
