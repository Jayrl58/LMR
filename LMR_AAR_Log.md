# LMR Project After-Action Review Log

Purpose: Capture significant process improvements and failure patterns
to prevent recurrence.

------------------------------------------------------------------------

## 2026-03-18 --- Arrow Rendering (M7) Integration Process

### What went well

• Establishing a **baseline renderer reset** enabled recovery from
repeated rendering failures

• Breaking the problem into **isolated validation steps** (render
baseline → single arrow → integration → multi-arrow) restored forward
progress

• Using **visual confirmation gates** ("do arrows appear?", "are they
directional?") provided fast validation loops

• Final architecture (App → getArrowIndicators → BoardRenderer) proved
clean and extensible

------------------------------------------------------------------------

### What did not work well

• Initial attempts violated process rule:

→ Multiple layers (logic + rendering + integration) were modified
simultaneously

• Repeated full-file replacements were attempted **without confirming
baseline stability first**

• Arrow logic was introduced before confirming:

→ data availability  
→ render pipeline integrity

• This resulted in:

→ blank screens  
→ lost renderer state  
→ unnecessary recovery cycles

------------------------------------------------------------------------

### Process corrections

• Enforce **render baseline first** for any UI feature:

→ Renderer must display board correctly before adding features

• Introduce new features in strict order:

1) Static render (no logic)  
2) Single controlled test case  
3) Data wiring  
4) Full integration  

• Never introduce:

→ data logic  
→ rendering changes  
→ integration wiring  

in the same step

• If UI disappears:

→ Immediately revert to last-known-good  
→ Do not attempt forward debugging on a broken render

------------------------------------------------------------------------

### Outcome

• Arrow system successfully implemented with:

→ multi-arrow support  
→ correct directional vectors  
→ stable rendering  

• Reinforced process rule:

"UI features must be built from a verified visual baseline upward, not
integrated all at once."

------------------------------------------------------------------------

## 2026-03-19 --- Double-Dice Interaction & Move Execution Loop

### What went well

• Maintaining **server-first debugging discipline** prevented unnecessary
engine changes

• Verifying `handleMessage` early confirmed server contract correctness
and narrowed scope to UI

• Forcing **end-to-end loop validation**:

→ roll → select die → request → preview → move → apply state

prevented partial fixes from being accepted

• Correctly separating state ownership:

→ `legalMoves` = preview only  
→ `moveResult` = authoritative state  

was the key turning point

• Using a **repeatable test scenario** (roll 1 + 6, switch, execute)
enabled fast and consistent validation

------------------------------------------------------------------------

### What did not work well

• **App.tsx drift / multiple active variants**

→ Multiple replacements caused loss of known-good baseline  
→ Uncertainty about which logic was actually running  
→ Slowed debugging significantly  

• **Overlapping fixes across the same pipeline**

→ die selection  
→ pendingDice handling  
→ legalMoves handling  

were modified simultaneously

→ Root cause became obscured  

• **UI-side inference attempts**

→ Tried to derive die context from legalMoves  
→ Conflicted with server model (die-specific requests required)  

• **Step gating breakdown**

→ Multiple stages (selection, request, move, apply) changed together  
→ Violated “one thing at a time” rule  
→ Introduced regressions (e.g., pendingDice overwrite)

------------------------------------------------------------------------

### Process corrections

• **Lock the active working file before debugging**

→ Explicitly confirm which file is authoritative  
→ Do not introduce alternate variants mid-session  

• **Enforce single-stage pipeline fixes**

Always isolate:

1) die selection  
2) request  
3) response  
4) move execution  
5) state application  

• **No UI inference where server is authoritative**

→ If data is missing: request it  
→ Never reconstruct server logic client-side  

• **Use fixed validation scenarios**

→ Continue using controlled repeat cases (e.g., 1 + 6 double-dice)  
→ Validate full loop before moving forward  

------------------------------------------------------------------------

### Outcome

• Full gameplay loop now operational:

→ roll → select die → preview → move → state update  

• Multi-die interaction now deterministic and stable  

• Reinforced process rule:

"Stateful interaction pipelines must be debugged one stage at a time,
with strict separation between preview data and authoritative state."

------------------------------------------------------------------------