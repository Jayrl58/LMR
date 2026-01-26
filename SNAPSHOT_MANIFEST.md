# LMR Snapshot Manifest

**Project:** Last Man Running (LMR) / Roll & Run  
**Snapshot Type:** Canonical Documentation Alignment  
**Status:** GREEN (Docs)  
**Date:** 2026-01-25

---

## Purpose

This manifest records the authoritative state of the LMR project at the time of this snapshot.  
It exists to support safe resumption, verification, and change tracking across sessions.

This snapshot captures **documentation alignment only**.  
No gameplay rules beyond those explicitly stated have been changed.

---

## Canonical Rule Documents

The following documents are **canonical and locked**:

- **Rules Authority:** `LMR_Rules_Authority_v1.7.3.md`
- **Rules Anchor:** `Rules_Anchor_v1.7.3.md`

These documents supersede all prior versions.

---

## Summary of Changes Since Last Snapshot

### Documentation Changes

- Terminology standardized from **Extra Rolls** → **Extra Dice**
- Explicit invariant locked:
  - *Extra Dice follow the same rules, restrictions, and resolution mechanics as all other Dice*
- **Kill Rolls** terminology retained as the name of the optional rule module
- **Team Play win condition corrected**:
  - Victory is awarded to the **first team to finish all of its Pegs**
  - Game ends immediately upon this condition

### Non-Changes (Explicit)

- No board geometry changes
- No movement rule changes
- No dice resolution order changes
- No engine logic changes captured in this snapshot
- No UI behavior changes captured in this snapshot

---

## Engine Status

- Engine behavior is expected to conform to **Rules Authority v1.7.3**
- Any deviations must be addressed before future snapshots are marked GREEN (Engine)

---

## UI Status

- HTTP Debug Console remains a **verification tool only**
- UI behavior must reflect the canonical rules but is not locked by this snapshot

---

## Snapshot Integrity

This snapshot is considered valid if and only if:

- All documentation listed above is present and unmodified
- No downstream files contradict the Rules Authority or Rules Anchor
- Any future work references **v1.7.3** as the baseline

---

## Resume Pointer

To resume work from this snapshot:

1. Load **Rules Authority v1.7.3**
2. Treat **Rules Anchor v1.7.3** as the interpretive contract
3. Resume engine or UI work against these locked documents

---

**End of SNAPSHOT_MANIFEST**
