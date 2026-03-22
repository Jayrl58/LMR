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

## 2026-03-20 --- UI Iteration Control & Server Contract Misdiagnosis

### What went well

• **Persistence through repeated failure cycles** led to correct root-cause identification

• **Capturing real runtime data (console + screenshots)** exposed that UI was receiving inconsistent turn state

• **Returning to baseline files (App.tsx checkpoint)** restored a reliable debugging foundation

• **Final isolation of problem layer**:

→ Confirmed issue is server-side contract, not UI rendering

------------------------------------------------------------------------

### What did not work well

• **Wrong layer targeted repeatedly**

→ Multiple UI fixes attempted for a server contract problem  
→ Created “round and round” loop with no progress  

• **Full-file replacements against unstable baselines**

→ Replacements applied to partially modified or broken files  
→ Introduced additional errors (blank screens, missing functions)

• **Loss of system integrity during debugging**

→ Server file replaced without preserving full wiring  
→ Caused runtime instability and confusion about failure source  

• **Contract ambiguity not identified early**

→ No explicit definition of required `turn` envelope  
→ UI forced to infer missing data  

------------------------------------------------------------------------

### Process corrections

• **Identify source-of-truth layer FIRST**

→ Before making changes, explicitly answer:
  - Is this UI, server, or engine?  

• **Do not fix downstream symptoms**

→ If UI appears inconsistent:
  - verify server payload before changing UI  

• **Define required data contracts explicitly**

→ For turn handling, always require:
  - pendingDice  
  - bankedDice  
  - awaitingDice  

• **Preserve system wiring during replacements**

→ Never replace server files unless:
  - all imports are preserved  
  - all integration points are intact  

• **Stop iteration once root cause is identified**

→ Do not continue modifying code after isolation  
→ Capture findings and restart clean next session  

------------------------------------------------------------------------

### Outcome

• Root cause successfully identified:

→ **Server turn envelope inconsistency**

• UI confirmed stable when given correct data

• Next session can begin with a single focused objective:

→ Fix server contract (wsServer turn normalization)

• Reinforced process rule:

"Fix the layer that owns the truth, not the layer that exposes the symptom."

------------------------------------------------------------------------


------------------------------------------------------------------------

## 2026-03-22 --- Contract Alignment vs UI Drift

### What went well

• Forced return to **server as source-of-truth** broke UI debugging loop  
• Targeted single-message capture eliminated noise and guesswork  
• Shift from behavior debugging → code-path reasoning exposed root cause quickly  
• Once layer ownership was identified, fixes remained stable  

------------------------------------------------------------------------

### What did not work well

• **WebSocket message ambiguity**
→ wrong frames repeatedly analyzed (old roll vs current stateSync)

• **UI-first instinct persisted too long**
→ delayed correct server-side diagnosis  

• **File baseline drift**
→ replacements generated from non-current files reintroduced bugs  

• **Missing early state validation step**
→ no explicit “verify server payload first” gate  

------------------------------------------------------------------------

### Process corrections

• Add **State Authority Check (mandatory)**

1) Capture one authoritative server message  
2) Validate:
   - pendingDice  
   - bankedDice  
   - awaitingDice  
3) Only proceed to UI if server state is correct  

• Enforce **Single-Message Validation Rule**
→ always capture “immediately after X event”  
→ reject historical/ambiguous frames  

• Lock **live file before replacement**
→ always generate from current on-disk file  

• Detect loop condition early
→ if same symptom persists after 2–3 iterations:
   - stop
   - switch to code-path audit or server validation  

• Separate bug types strictly:
→ Interaction bug = UI  
→ State bug = server  
→ never fix both simultaneously  

------------------------------------------------------------------------

### Outcome

• Established reliable debugging pattern:

Server message → validate state → then UI  

• Eliminated speculative iteration loops  

• Reinforced rule:

"UI must never be debugged before validating server state."

------------------------------------------------------------------------
