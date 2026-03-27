# LMR Project After-Action Review Log

Purpose: Capture significant process improvements and failure patterns
to prevent recurrence.

------------------------------------------------------------------------

## 2026-03-18 --- Arrow Rendering (M7) Integration Process

[unchanged content preserved]

------------------------------------------------------------------------

## 2026-03-19 --- Double-Dice Interaction & Move Execution Loop

[unchanged content preserved]

------------------------------------------------------------------------

## 2026-03-20 --- UI Iteration Control & Server Contract Misdiagnosis

[unchanged content preserved]

------------------------------------------------------------------------

## 2026-03-22 --- Contract Alignment vs UI Drift

[unchanged content preserved]

------------------------------------------------------------------------

## 2026-03-23 --- UI Clarity vs Signal Strength & Correct-Layer Fix Discipline

[unchanged content preserved]

------------------------------------------------------------------------

## 2026-03-24 --- Delegation Failure Loop & Data Loss at Boundary

### What went well

• Persistence through multi-layer debugging  
• Clear reproduction scenarios (Blue → Green delegation)  
• Isolation of behavior across multiple clients  
• Correct identification of server as authoritative layer  
• Final resolution achieved with minimal, targeted fix  

------------------------------------------------------------------------

### What did not work well

• Repeated UI-side fixes attempted while server data was incorrect  
• Lack of visibility into `turn.pendingDice` slowed diagnosis  
• Delegation assumed to be UI/control issue instead of data issue  
• Iteration loop persisted longer than necessary  

------------------------------------------------------------------------

### Process corrections

• Enforce **Data Fidelity Rule**  
→ Never transform or flatten structured state across boundaries  
→ Preserve full objects (e.g., `{ value, controllerId }`) end-to-end  

• Enforce **State Visibility Requirement**  
→ Debug output must include full authoritative state (turn, pendingDice)  
→ Never debug blind  

• Enforce **Ownership Validation First**  
→ Before modifying UI logic, confirm server data correctness  

• Detect **Stalled Iteration Loop Early**  
→ If 2–3 fixes do not change behavior, assume wrong layer  

------------------------------------------------------------------------

### Outcome

• Root cause: server stripped `controllerId` during stateSync  
• Delegated dice became unusable across all clients  
• Fix: preserve structured pendingDice in wsServer  

• Reinforced rule:

"Never discard critical state fields across system boundaries. If behavior does not change after multiple fixes, the wrong layer is being modified."

------------------------------------------------------------------------

## 2026-03-25 --- Results Flow Integration & Contract Discipline

### What went well

• Strict step-by-step isolation exposed issues quickly  
• Multi-window testing (solo + team) validated full flow  
• Server-authoritative transitions prevented hidden UI state bugs  
• Clear separation of responsibilities (server = truth, UI = presentation)  

------------------------------------------------------------------------

### What did not work well

• Partial edits and non–full-file updates caused structural breakage  
• Multiple simultaneous changes (server + UI) obscured root causes  
• Assumed payload shapes (UI vs server mismatch) created silent failures  
• WebSocket lifecycle bug (reconnect on state change) introduced hidden desync  

------------------------------------------------------------------------

### Process corrections

• Enforce **Full File Replacement Rule**  
→ Never issue partial edits or inline patch instructions  
→ Always replace entire file to maintain structural integrity  

• Enforce **Contract Verification Step**  
→ Validate server payload shape before implementing UI handling  
→ Never assume payload structure  

• Enforce **Single-Layer Change Discipline**  
→ Modify server OR UI, never both simultaneously  
→ Verify each layer independently before proceeding  

• Enforce **Connection Stability Awareness**  
→ Avoid unintended WebSocket reinitialization tied to state changes  
→ Treat connection lifecycle as critical system component  

------------------------------------------------------------------------

### Outcome

• Root cause cluster:
  - UI expected incorrect `gameOver` payload shape  
  - WebSocket reconnected on state change, losing room context  
  - Render gating incorrectly tied to `phase === active` only  

• Fixes:
  - Correct payload mapping (server → UI contract alignment)  
  - Stabilized WebSocket lifecycle (removed dependency loop)  
  - Updated render gating to support `ended` phase  
  - Implemented owner-controlled post-game flow  

• Reinforced rule:

"Always validate contracts before rendering. If behavior disappears without errors, assume a contract mismatch or lifecycle issue."

------------------------------------------------------------------------

------------------------------------------------------------------------

## 2026-03-27 --- Lobby UI Regression Loop & Replacement Discipline

### What went well

• Rapid detection of regressions through visual validation  
• Multi-client testing exposed ownership/UI mismatch clearly  
• Strong enforcement of working preferences prevented bad commits  
• Successful recovery to stable baseline before continuing  

------------------------------------------------------------------------

### What did not work well

• Pattern-based text replacements caused unintended code changes  
• Partial structural assumptions led to UI regressions (checkbox → text)  
• Multiple iterations drifted away from known-good baseline  
• Generated files were not always true full replacements  

------------------------------------------------------------------------

### Process corrections

• Enforce **Baseline Preservation Rule**  
→ Always start from the last known-good file  
→ Never “approximate” current state  

• Enforce **No Pattern Replacement Rule**  
→ Do not modify code via string/pattern matching  
→ Only edit known, exact code blocks  

• Reinforce **Full File Replacement Rule (Strict)**  
→ Every replacement must be complete and verifiable  
→ No snippets, no partials, no assumptions  

• Enforce **Single-Concern Change Rule**  
→ Only change one behavior per iteration  
→ Verify before proceeding  

------------------------------------------------------------------------

### Outcome

• Root cause: unsafe pattern-based edits and stale file assumptions  
• Fix: returned to stable baseline and applied minimal, targeted change  
• Result: Start button behavior + UI alignment achieved without regression  

• Reinforced rule:

"Never modify what you cannot see exactly. Always operate from the current file, and change only one known element at a time."

------------------------------------------------------------------------
