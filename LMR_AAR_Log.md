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

------------------------------------------------------------------------

## 2026-03-20 --- UI Iteration Control & Replacement Discipline

### What went well

• **Fast visual validation loop** (refresh + immediate UI inspection) caught regressions quickly

• **Using real multiplayer sessions early** exposed identity and turn-sync issues that would not appear in single-client testing

• **Explicit user constraints** (no patching, full-file replacements, one step at a time) helped keep scope bounded when followed

### What did not work well

• **Full-file replacement discipline broke down**

→ Some responses attempted patch-style guidance  
→ Some replacements were generated against stale or incorrect baselines  
→ Result: blank screens and regressions

• **Baseline drift during active iteration**

→ Dynamic roll-input work started without locking a known-good App.tsx  
→ Subsequent fixes stacked on unstable state  
→ Made it unclear whether issues were new or inherited

• **Multiple concerns modified in one pass**

→ Input model + state sync + rendering touched together  
→ Violated single-change rule  
→ Slowed root-cause isolation

• **Incorrect source-of-truth assumptions**

→ UI attempted to infer dice count from config and pending state inconsistently  
→ Highlighted need to explicitly define authoritative source before UI changes

### Process corrections

• **Hard lock baseline before UI refactor**

→ Save and label last-known-good file  
→ Do not proceed without confirmed rollback point

• **Enforce “replacement-only, from-current-file” rule**

→ Always generate replacements from the exact file provided in the same turn  
→ No inferred or reconstructed files

• **Single-variable change per iteration**

→ UI layout change OR state change OR data source change — never combined

• **Define source of truth before wiring UI**

→ For any dynamic UI (dice, moves, turns), explicitly state:
  - where data comes from
  - when it is valid
  - when it is empty

• **Abort early on instability**

→ If UI regresses (blank screen / core interaction broken):
  - stop forward work immediately  
  - revert to baseline  
  - re-scope smaller

### Outcome

• Reinforced need for strict baseline control during UI work  
• Confirmed that full-file replacement workflow must be followed exactly to avoid drift  
• Identified dynamic UI work (like roll inputs) as requiring tighter scoping and clearer data contracts before implementation

