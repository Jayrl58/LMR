# LMR Project After-Action Review Log

Purpose: Capture significant architectural, design, milestone, or
invariant insights. Entries are added only when meaningful signal
exists.

------------------------------------------------------------------------

## Baseline

Log initialized.

------------------------------------------------------------------------

## 2026-02-23 --- WS Turn-Owner Desync Reproduction

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-02-27 --- M6 Foundation + Multi-Team Terminal Hardening

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-02 --- Server ↔ UI Contract Hardening (External Dice Flow)

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-04 --- Console Validation and Rendering Fix

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-05 --- Minimal UI Stabilization

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-06 --- Dice Lifecycle Validation

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-08 --- Debug UI Interaction Model + Visual Prototype Direction

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-09 --- Board Geometry Baseline Lock

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-10 --- Geometry Sandbox & Renderer Foundation (Process Notes)

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-11 --- UI Render Pipeline Integration

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-13 --- Board-Length Normalization Discovery

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-15 --- Multiplayer Initialization Bug Investigation

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-16 --- Renderer Ownership Stabilization & Visual Consistency

(Context and findings unchanged from prior log entry.)

------------------------------------------------------------------------

## 2026-03-17 --- UI Interaction Gating & Recovery Process Breakdown

### What went well

• Returning to a **last-known-good file via Git restore** immediately
  recovered a broken UI state

• Once the baseline was restored, **small, targeted logic fixes**
  (die gating, stale selection removal) worked correctly and were
  verifiable

• Explicit **test scenarios** (multi-die rolls like 1,6 or 2,3) were
  effective in validating correctness quickly

• Using **clear stop conditions** ("neutral", "still broken") kept
  validation focused and prevented unnecessary branching

---

### What did not work well

• Repeated use of **full file replacements without a stable baseline**
  caused loss of working functionality and forced manual recovery

• The workflow drifted into **trial-and-error patching** rather than
  controlled, incremental changes

• Multiple iterations attempted to fix **visual and logic layers at the
  same time**, leading to confusion and regression

• File delivery failures ("file no longer available") created
  additional friction and broke continuity

• Lack of immediate fallback to Git resulted in **wasted cycles
  attempting to reconstruct known-working behavior**

---

### Process corrections

• When UI behavior regresses:

  → Immediately restore last-known-good via Git  
  → Do not attempt forward fixes on a broken baseline  

• Enforce **strict separation of concerns**:

  → Fix logic first (state, gating, contracts)  
  → Then add visuals (arrows, highlights)  
  → Never combine both in the same step  

• Avoid iterative blind changes:

  → Each change must have a **single explicit purpose**  
  → Each test must have a **clear expected outcome**  

• Prefer **minimal diffs over full rewrites** unless restoring from Git  

• Treat file delivery instability as a **signal to reduce iteration
  complexity**, not increase it  

---

### Outcome

• Correct UI interaction model restored and stabilized  
• Multi-die ambiguity eliminated at the state level  
• Clear process rule established:

  "Restore baseline first, then apply one controlled change at a time"

• Session exposed a failure mode (drift into patch churn) and corrected
  it for future work

------------------------------------------------------------------------