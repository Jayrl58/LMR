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