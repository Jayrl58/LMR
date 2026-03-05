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

-   Double-dice sequencing with roll `[1,2]` behaves deterministically.
-   Banked die behavior confirmed (1 and 6 bank one die).
-   Pending dice must resolve before roll (`BAD_TURN_STATE` enforced).
-   `NOT_YOUR_TURN` enforcement confirmed.
-   Enter-on-1 from base validated.
-   Correct turn retention after partial resolution.
-   Correct turn advance after full resolution.
-   `legalMoves` payload structure confirmed to include:
    -   actorId
    -   dice array
    -   active die value
    -   moves list
    -   turn snapshot
-   `turn` payload includes `pendingDice` and `bankedDice` when
    applicable.

### Observed Friction

-   Window context confusion (prototype vs console vs multiple clients).
-   Intermittent "No legalMoves received yet" states during external
    dice testing.
-   Actor claim switching (p0/p1) not visually obvious in console UI.

### Technical Observations

-   Server behavior appears internally consistent when correct actor and
    window context are used.
-   Intermittent missing `legalMoves` likely UI handling rather than
    engine emission.
-   No engine regressions detected.
-   Server↔UI contract not yet formally documented.

### Next Focus

Isolate and deterministically reproduce intermittent missing
`legalMoves` in external dice flow to confirm whether issue is
emission-layer or UI-layer.

------------------------------------------------------------------------

## AAR Entry --- WS Forfeit Flow Stabilization Session

### Technical Findings

**WS Payload Shape Issue --- Resolved** - Previous
`BAD_MESSAGE type=forfeitPendingDie typeof=string` error confirmed and
corrected. - Verified via DevTools WebSocket frames that outgoing
payload is proper JSON object:
`{ "type": "forfeitPendingDie", "actorId": "p0" }` - Server now responds
with `stateSync`, not `error`.

**Forfeit Flow Behavior --- Verified** Observed sequence: 1.
`roll [2,3]` 2. `legalMoves` empty (die 2) 3. `getLegalMoves` for die 3
4. `legalMoves` empty (die 3) 5. `forfeitPendingDie` 6. `stateSync`
advancing turn to `p1`

-   Global-stuck acknowledgement path functioning.
-   Turn advancement confirmed.
-   No residual pendingDice state after forfeit.

### Process Observations

**Reproduction Before Modification** - At least one iteration attempted
fixes without confirmed reproduction. - Reinforced workflow rule:
Reproduce → Confirm → Then Modify.

**WebSocket-First Debugging** - Debugging became deterministic once
DevTools WS Frames were used from the start. - Future debugging
protocol: always verify actual outgoing WS payload before assuming
server fault.

### Current Stability Assessment

Stable: - wsServer transport layer - handleMessage forfeit handling -
httpConsole message shape - Turn advancement after global-stuck

Deferred / UX Clarity: - Synthetic forfeit row visibility clarity -
Explicit pending-dice visual indicator - Optional outgoing WS payload
echo panel in UI

------------------------------------------------------------------------

------------------------------------------------------------------------

## 2026-03-04 --- Console Validation and Rendering Fix

### Context

During manual console validation of `legalMoves` behavior, the engine
appeared to be producing incomplete move lists in the HTTP console UI.

### Observation

Server logs and raw WS payloads confirmed the engine was emitting the
full `legalMoves` array.\
However, the **Moves table in the HTTP console displayed only the first
move**, creating the false appearance of an engine legality bug.

### Root Cause

Move rendering logic inside `httpConsole.ts` filtered/truncated the
`legalMoves` array before populating the Moves table.

### Resolution

Replaced the HTTP console rendering logic so the full `legalMoves` array
is rendered.

### Verification

Roll `[6,1]` now correctly produces:

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

Server payload and console display now match.

### Additional Diagnostic Work

Temporary emission logging added to `handleMessage.ts` to confirm when
`legalMoves` messages are generated and emitted.

### Outcome

-   Confirmed **server move generation is correct**
-   Fixed **HTTP console rendering bug**
-   Verified **M5 milestone completion**
-   Updated **Startup_Milestone_Frame.md**
-   Repository committed and pushed cleanly

## 2026-03-05 --- Minimal UI Stabilization (WS Debug Console Parity)

### Context

The Vite-based minimal UI (`ui/`) was being used as a lightweight WS client
for engine validation, but several missing controls and message-shape
mismatches forced repeated DevTools copy/paste and made it hard to know
what the client was actually doing.

### Observations

- WebSocket server is reachable on `ws://127.0.0.1:8787` (8788 is not the WS endpoint for this client).
- Refreshing the UI creates/joins a *new room*, which can make "role"/seat expectations appear to reset.
- The UI could connect/hello/join, but **startGame** and **getLegalMoves**
  were sending invalid payload shapes (server returned `BAD_MESSAGE`).
- After a successful roll and move, the UI did not reliably surface the
  current "pending dice" state, leading to confusion when roll became disabled.

### Changes / Resolution

- Minimal UI upgraded from "buttons only" to a small debug-oriented panel:
  - displays WS URL used
  - shows raw last message
  - maintains a message log
  - shows Turn summary (`nextActorId`, `awaitingDice`, `bankedDice`, etc.)
  - renders the current move list as clickable actions
- Fixed **startGame** client payload to match server expectations
  (player count + options, not a string/roomCode-only shape).
- Removed/avoided the invalid **getLegalMoves** request shape; the
  supported flow is **roll → server returns legalMoves → pick a move**.

### Verification

End-to-end validation succeeded in the minimal UI:

- connect → hello → joinRoom → startGame → `stateSync`
- roll `[1]` → `legalMoves` list populated
- selecting `enter` / `advance` moves → `moveResult` OK
- follow-up `legalMoves` updates received and displayed

### Notes / Follow-ups

- Keep the minimal UI as the preferred debug client (reduces DevTools copy/paste).
- Consider adding an explicit "roomCode" input + "join existing room" behavior
  to support multi-client testing (p0/p1) without relying on refresh/new-room creation.
