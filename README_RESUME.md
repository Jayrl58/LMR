# LMR – Resume Guide

This file exists to allow **safe, fast resumption** of the Last Man Running (LMR) project in a new chat, new session, or on a new day without loss of context or rule drift.

---

## Project State at This Snapshot

- **Rules Authority:** v1.7.3 (Canonical / Locked)
- **Rules Anchor:** v1.7.3 (Canonical / Locked)
- **Documentation Status:** GREEN
- **Engine Status:** Previously GREEN; engine must now be verified against v1.7.3
- **UI Status:** Debug HTTP Console in use (verification tool only)

This is a **clean stopping point**.

---

## What Changed in This Snapshot

### Rules Clarifications (Locked)

- **Extra Rolls → Extra Dice**
  - Extra Dice are Dice
  - Extra Dice follow the same rules, restrictions, and resolution mechanics as all other Dice
  - Extra Dice may earn additional Extra Dice
- **Kill Rolls**
  - Name unchanged
  - Remains an optional rule that grants Extra Dice
- **Team Play Win Condition**
  - In Team Play, **the first team to finish all of its Pegs wins**
  - The game ends immediately when this condition is met

No other gameplay rules were changed.

---

## Canonical Documents

The following files are authoritative and must be loaded first when resuming work:

- `LMR_Rules_Authority_v1.7.3.md`
- `Rules_Anchor_v1.7.3.md`
- `SNAPSHOT_MANIFEST.md` (current snapshot)

Older versions must not be referenced except for historical comparison.

---

## How to Resume (Engine / Server)

From the project root:

1. **Install dependencies** (if needed)
   ```bash
   npm install
