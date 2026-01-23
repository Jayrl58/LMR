\# LMR Rules v1.7.1 — Test Coverage Declaration



This document declares the current scenario-test coverage for the

\*\*LMR\_Rules\_Authority\_v1.7.1.md\*\* ruleset.



It is descriptive, not aspirational.  

Only rules with concrete scenario coverage are listed as covered.



---



\## Scope



\- \*\*Rules Version:\*\* v1.7.1

\- \*\*Engine State:\*\* GREEN

\- \*\*Test Suite Status:\*\* All tests passing

\- \*\*Coverage Type:\*\* Scenario-based (positive + negative where applicable)



This declaration applies to:

\- Engine move generation (`legalMoves`)

\- Engine move application (`tryApplyMoveWithResponse`)

\- Forced-move filtering

\- Capture / blocking semantics



---



\## Coverage Principles



\- Every \*\*forced rule\*\* must have:

&nbsp; - at least one test proving it \*is forced\*

&nbsp; - at least one test proving it \*is not forced\* when alternatives exist

\- Capture rules are validated only on \*\*landing\*\*, never on pass-over

\- Home rules are validated separately from track rules

\- Illegal states may be injected defensively to assert engine behavior



---



\## Section-by-Section Coverage



\### Section C — Entry Rules



\#### Entry on Roll = 1

\- Entry from base is generated correctly

\- Entry is \*\*forced\*\* when it is the only legal move

\- Entry is \*\*not forced\*\* when any other legal move exists

\- Entry captures any other player’s peg on landing

\- Entry is blocked by own peg on destination



\*\*Covered by:\*\*

\- `entryBlocking.scenario.test.ts`

\- `entryOnOneNotForced.scenario.test.ts`



\#### Entry on Roll = 6

\- Entry from base is generated correctly

\- Entry is \*\*forced\*\* when it is the only legal move

\- Entry is \*\*not forced\*\* when track advances exist

\- Entry captures any other player’s peg on landing

\- Entry is blocked by own peg on destination



\*\*Covered by:\*\*

\- `entryOnSix.scenario.test.ts`

\- `entryOnSixNotForced.scenario.test.ts`



---



\### Section F — Center Rules



\#### Center Entry

\- Entry into Center is only available from a Point on roll = 1

\- Center entry is not available on other rolls



\*\*Covered by:\*\*

\- `centerRules.scenario.test.ts` (F.1)



\#### Center Exit

\- Exit from Center is only available on roll = 1

\- Exit destinations may be \*\*any Point\*\*

\- Exit captures any other player’s peg on landing

\- Exit is \*\*forced\*\* when it is the only legal move

\- Exit is \*\*not forced\*\* when any other legal move exists



\*\*Covered by:\*\*

\- `centerRules.scenario.test.ts` (F.3, F.4, F.6)

\- `centerExitNotForced.scenario.test.ts`



---



\### Section H — Home Rules



\#### Home Entry

\- Entry into home requires exact count

\- Overshoot into home is illegal

\- Entry into home is blocked by own peg

\- Entry into home is \*\*forced\*\* when it is the only legal move

\- Entry into home is \*\*not forced\*\* when other legal moves exist



\*\*Covered by:\*\*

\- `homeExactCount.scenario.test.ts`

\- `forcedHomeEntry.scenario.test.ts`

\- `homeEntryNotForced.scenario.test.ts`



\#### Home Exclusivity

\- No player’s peg may enter another player’s home

\- Home spaces are non-capturable

\- Any occupancy of a home space blocks entry

\- Defensive behavior is correct even if an illegal state is injected



\*\*Covered by:\*\*

\- `homeEntryKillsOnLanding.scenario.test.ts`  

&nbsp; (final version asserting \*\*no capture in home\*\*)



---



\### Finished Peg Handling



\- Finished pegs are ignored for forced-move calculations

\- Forced entry logic behaves correctly when all non-base pegs are finished



\*\*Covered by:\*\*

\- `forcedEntryFinishedPegs.scenario.test.ts`



---



\## Explicit Non-Coverage (By Design)



The following are \*\*not yet covered\*\* by scenario tests:



\- UI rendering behavior

\- Client-side move filtering

\- Replay/hash stability guarantees

\- Performance characteristics

\- Network synchronization edge cases



These are considered separate work lanes.



---



\## Coverage Status Summary



\- \*\*Forced-move logic:\*\* COMPLETE

\- \*\*Entry rules:\*\* COMPLETE

\- \*\*Center rules:\*\* COMPLETE

\- \*\*Home rules:\*\* COMPLETE

\- \*\*Capture semantics:\*\* COMPLETE (with explicit home exclusion)



This test suite is sufficient to detect regressions in all currently

locked rule logic.



---



\## Usage Notes



\- This declaration must be updated \*\*only\*\* when:

&nbsp; - rules change, or

&nbsp; - scenario coverage materially changes

\- Passing tests alone do not imply coverage; inclusion here does.



---



End of declaration.



