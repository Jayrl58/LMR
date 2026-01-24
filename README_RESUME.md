# LMR – Resume Guide

This file exists to allow **safe, fast resumption** of the LMR project in a new chat or on a new day.

---

## Project State at This Snapshot

- Server engine is **GREEN**
- Rules Authority is **locked**
- Double Dice mode is implemented and verified
- Debug HTTP console is stable and reflects the current engine contract

This is a **good stopping point**.

---

## How to Resume

1. Open the project root
2. Install dependencies (if needed)
   ```
   npm install
   ```
3. Verify engine health
   ```
   npm test
   ```
   Expected result: **all tests passing**
4. Start the dev server
   ```
   npm run dev:server
   ```
5. Open the debug console
   - http://localhost:8788

---

## What the HTTP Console Is (and Is Not)

**Is:**
- A debug and verification tool
- A contract visualizer for dice, moves, and turn flow

**Is Not:**
- A production UI
- A final UX reference

Decisions made here should inform the real UI, not constrain it.

---

## Current Design Decisions (Locked)

- Exactly **one die** is resolved per move
- Pending dice list is stable across inspections
- Legal moves are fetched per selected die
- After a successful move:
  - spent die is removed
  - remaining die auto-fetches moves (if enabled)

---

## Known Follow‑Ups (Not Done Yet)

- Visual handling of dice with zero legal moves (greyed out, unselectable)
- Explicit end-of-resolve action when all remaining dice have no moves
- UI treatment of die forfeiture
- Non-debug UI implementation

---

## How to Work With Me (Reminder)

- Be brief by default
- Full file replacements only
- One step at a time
- Do not generate files unless explicitly requested
- Freeze / hold means stop immediately

---

## Resume Prompt for a New Chat

Paste this at the start of a new session:

> Load LMR project from snapshot **LMR_SNAPSHOT_2026-01-23_SERVER_ENGINE_DOUBLE_DICE_GREEN_v0.2.8_FULL**.  
> Rules Authority is locked. Engine tests are green.  
> Resume at Double Dice UI/contract verification.

