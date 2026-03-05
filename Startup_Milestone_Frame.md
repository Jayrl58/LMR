# Startup Milestone Frame — LMR Project

Status: Updated after M5 completion verification  
Status: Session validation added 2026-03-02  
Status: Console rendering validation added 2026-03-04  
Status: Minimal UI validation added 2026-03-05

------------------------------------------------------------------------

COMPLETE M1 — Engine Core (Authoritative Rules Engine)  
COMPLETE M2 — Server Authority Layer  
COMPLETE M3 — Double Dice Mode  
COMPLETE M4 — Team Play (2-Team Baseline)

COMPLETE M5 — Team Model Expansion  
COMPLETE M5.1 — 3 teams of 2 (6P board)  
COMPLETE M5.2 — 4 teams of 2 (8P board)  
COMPLETE M5.3 — Advanced delegation arbitration hardening  
COMPLETE M5.4 — Multi-team finish ordering  
COMPLETE M5.5 — Edge-case multi-team turn flow hardening

COMPLETE OPT.KILLROLL — Optional Module — Kill-Roll Banking Hardening

NOT_STARTED M6 — UI Integration & Presentation

------------------------------------------------------------------------

POST-COMPLETE VALIDATION — 2026-03-02 (Server ↔ UI Contract Hardening)

Validated runtime behavior (external dice mode, double-dice enabled):

- Verified double-dice sequencing with roll [1,2]
- Verified banked-die behavior (1 or 6 banks one die)
- Verified enter-on-1 from base
- Verified pendingDice roll gating (BAD_TURN_STATE enforced)
- Verified NOT_YOUR_TURN enforcement
- Verified correct turn retention after partial resolution
- Verified correct turn advance after full resolution
- Verified legalMoves payload includes:
  - actorId
  - dice array
  - active die value
  - moves list
  - turn snapshot
- Verified turn payload includes pendingDice and bankedDice when applicable

------------------------------------------------------------------------

POST-COMPLETE VALIDATION — 2026-03-04 (HTTP Console Rendering)

Issue identified during console validation session:

- Server emitted full legalMoves payload correctly
- HTTP console Moves table rendered only the first move
- Root cause: UI filtering/truncation inside HTTP console move rendering

Resolution:

- Replaced httpConsole.ts rendering logic
- Console now displays complete legalMoves list

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

- Server legalMoves generation confirmed correct
- HTTP console move rendering confirmed correct
- Prior "UI does not consistently render legalMoves" issue resolved

------------------------------------------------------------------------

POST-COMPLETE VALIDATION — 2026-03-05 (Minimal UI Debug Client)

A minimal React debug client was introduced to verify that the server
WebSocket contract operates correctly outside the HTTP console.

Environment:

- WebSocket server: ws://127.0.0.1:8787
- HTTP console: http://127.0.0.1:8788

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

- roll correctly produces legalMoves payload
- legalMoves includes actorId, dice, die, moves list, and turn snapshot
- bankedDice correctly appears when rolling 1
- executing a move consumes the banked die
- moveResult returns authoritative turn state
- UI returns to awaitingDice:true when dice resolution completes

Example verified sequence:

roll [1]  
→ legalMoves (bankedDice:1)

move enter:p0:1:1  
→ moveResult

turn state after resolution:

awaitingDice:true

Result:

- Server contract confirmed stable with independent UI client
- UI correctly reflects turn state transitions
- Full roll → move → roll loop verified

------------------------------------------------------------------------

RESUME ANCHOR — Next Session Focus

Primary Objective: Begin M6 — UI Integration & Presentation.

Initial focus areas:

- Define stable UI ↔ server message contract
- Determine UI state model for pendingDice / bankedDice
- Establish deterministic move presentation rules
- Begin replacing prototype console behaviors with production UI patterns

Stop Condition: UI layer can reliably consume server contract and
present legalMoves without filtering or ambiguity.
