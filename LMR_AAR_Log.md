# LMR Project After-Action Review Log

Purpose: Capture significant process improvements and failure patterns
to prevent recurrence.

------------------------------------------------------------------------

## 2026-03-18 --- Arrow Rendering (M7) Integration Process

### What went well

• Establishing a baseline renderer reset enabled recovery  
• Breaking problem into isolated validation steps restored progress  
• Visual confirmation gates enabled fast validation loops  
• Final architecture proved clean and extensible  

------------------------------------------------------------------------

### What did not work well

• Multiple layers modified simultaneously  
• Replacements applied without baseline validation  
• Arrow logic introduced before data and pipeline confirmed  

------------------------------------------------------------------------

### Process corrections

• Enforce render baseline first  
• Introduce features in strict order  
• Never modify logic/render/integration simultaneously  
• Revert immediately if UI disappears  

------------------------------------------------------------------------

### Outcome

• Arrow system successfully implemented  
• Reinforced baseline-first rule  

------------------------------------------------------------------------

## 2026-03-19 --- Double-Dice Interaction & Move Execution Loop

### What went well

• Server-first debugging discipline  
• End-to-end loop validation prevented partial fixes  
• Correct separation of preview vs authoritative state  

------------------------------------------------------------------------

### What did not work well

• App.tsx drift / multiple variants  
• Overlapping fixes across pipeline stages  
• UI-side inference attempts  
• Step gating breakdown  

------------------------------------------------------------------------

### Process corrections

• Lock active file before debugging  
• Enforce single-stage pipeline fixes  
• No UI inference when server is authoritative  
• Use fixed validation scenarios  

------------------------------------------------------------------------

### Outcome

• Gameplay loop operational and deterministic  

------------------------------------------------------------------------

## 2026-03-20 --- UI Iteration Control & Server Contract Misdiagnosis

### What went well

• Persistence through failure cycles  
• Runtime data exposure clarified issue  
• Correct layer identified  

------------------------------------------------------------------------

### What did not work well

• Wrong layer targeted repeatedly  
• Replacements on unstable baselines  
• Contract ambiguity  

------------------------------------------------------------------------

### Process corrections

• Identify source-of-truth layer first  
• Do not fix downstream symptoms  
• Define data contracts explicitly  
• Preserve system wiring  

------------------------------------------------------------------------

### Outcome

• Root cause: server contract inconsistency  
• Reinforced “fix the owning layer” rule  

------------------------------------------------------------------------

## 2026-03-22 --- Contract Alignment vs UI Drift

### What went well

• Server as source-of-truth enforced  
• Single-message validation improved accuracy  
• Code-path reasoning exposed root cause  

------------------------------------------------------------------------

### What did not work well

• Message ambiguity  
• UI-first instinct persisted  
• File baseline drift  

------------------------------------------------------------------------

### Process corrections

• Mandatory state authority check  
• Single-message validation rule  
• Lock live file before replacement  
• Detect loop conditions early  

------------------------------------------------------------------------

### Outcome

• Reliable debugging pattern established  

------------------------------------------------------------------------

## 2026-03-23 --- UI Clarity vs Signal Strength & Correct-Layer Fix Discipline

### What went well

• Rapid visual iteration loops  
• User perception feedback drove correct decisions  
• Shift from color-based to structural highlighting  
• Correct UI vs server layer isolation  
• Debug panel used as source-of-truth validation  

------------------------------------------------------------------------

### What did not work well

• UI fixes attempted before data verification  
• Assumption-based debugging (config path guessing)  
• Over-reliance on color-based highlighting  
• Weak visual signals accepted too long  

------------------------------------------------------------------------

### Process corrections

• Enforce Visual Clarity Threshold  
→ if not instantly readable, reject  

• Enforce Data Before Display  
→ verify payload before UI changes  

• Avoid speculative bindings  
→ always confirm actual data path  

• Prefer structural UI signals  
→ contrast, outline, elevation, scale  

• Terminate ineffective approaches early  
→ switch strategy after 2–3 failed iterations  

------------------------------------------------------------------------

### Outcome

• Clear UI readability standard established  
• Interaction clarity achieved across system  
• Root cause fixed at correct layer (server)  
• Reinforced rule:

"Verify the data source before fixing the display, and prefer structural clarity over subtle visual changes."

------------------------------------------------------------------------
