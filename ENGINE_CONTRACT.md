\# LMR Green Engine Contract (Authoritative)



Snapshot: LMR\_SNAPSHOT\_2026-01-11\_SERVER\_ENGINE\_GREEN\_v0.1.4.zip

Date: 2026-01-11

Status: LOCKED (changes require version bump)



\## Source of truth



\- Vitest suite is authoritative for behavior.

\- This document describes the intended stable contract and must match tests.



\## Turn model (LOCKED)



\- Model: \*\*Option C\*\*

&nbsp; - Dice are explicit input (engine does not roll).

&nbsp; - The \*\*same actor continues\*\* making decisions until a roll produces \*\*no legal moves\*\*.

&nbsp; - Dice lifecycle and turn-advance orchestration remain external to the engine.



\## Public API (stable)



These exports are the public contract:



\### Core

\- `legalMoves(state, actorId, dice) -> Move\[]`

\- `applyMove(state, move) -> { state: GameState, outcome: Outcome }`



\### Teams

\- `isTeamFinished(state, teamId) -> boolean`

\- `teamFinishOrder(state, teamId) -> PlayerId\[]`

\- `chooseRollRecipient(state, currentPlayerId, roll) -> PlayerId`



\### Determinism

\- `serializeState(state) -> string`

\- `deserializeState(json) -> GameState`

\- `hashState(state) -> string`



\### Replay

\- `applyAndRecord(state, move, log) -> { nextState, nextLog }`

\- `REPLAY\_FORMAT\_VERSION -> 1`

\- `serializeReplay(replayFile) -> string`

\- `deserializeReplay(json) -> ReplayFile` (validates)

\- `validateReplayFile(replayFile) -> void` (throws on invalid)



\### Sync + Server Envelope

\- `applyMoveWithSync(state, move) -> { nextState, afterHash, replayEntry }`

\- `tryApplyMoveWithResponse(state, actorId, dice, proposedMove, options?) -> MoveResponse`

&nbsp; - If `options.includeNextLegalMoves === true`, success response may include `nextLegalMoves`.



\## Core movement invariants (stable)



\### Track movement

\- Movement is clockwise.

\- A move is illegal if it lands on the actor’s own peg.

\- A move is illegal if it passes over the actor’s own peg at any point on its path (including home paths).



\### Home entry (forced)

\- If a peg is on the player’s home-entry index, the next step must go into home\[0].

\- If a peg lands on home-entry during a multi-step move, the immediately following step must go into home\[0].

\- If home\[0] is occupied, any move that requires forced entry to home\[0] is illegal (no alternate route).



\### Home exact-fit + progressive finish targets

\- Home requires exact fit; overshooting the intended home slot is illegal.

\- Pegs finish in this order of targets:

&nbsp; 1st finished peg -> home\[3]

&nbsp; 2nd -> home\[2]

&nbsp; 3rd -> home\[1]

&nbsp; 4th -> home\[0]

\- When the 4th peg finishes, player.hasFinished becomes true.

\- A player appears in finishedOrder once, when they become finished.



\## Kills (captures) (stable)

\- Kills occur only on landing, never on pass-over.

\- Landing on an occupied spot kills the occupant if it is not the actor’s own peg.

\- Teammates are not immune: landing on a teammate kills them.

\- Killed pegs return to base.



\## Team mode (stable)

\- teamFinishOrder(teamId) is derived from global finishedOrder filtered to team members.

\- isTeamFinished(teamId) becomes true only when all team members have finished.

\- When a team finishes, phase becomes ended and outcome includes:

&nbsp; - winnerTeamId

&nbsp; - winnerTeamPlayersInFinishOrder (team members ordered by finish order)



\## Versioning policy (stable)

\- PATCH: doc/test additions, refactors that do not change behavior.

\- MINOR: new optional behavior behind flags, backward compatible.

\- MAJOR: any behavior, state shape, or API change.



