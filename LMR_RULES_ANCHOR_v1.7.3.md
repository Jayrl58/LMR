# Last Man Running (LMR)
## Rules Anchor v1.7.3

**Status:** Canonical / Locked  
**Anchors:** LMR_Rules_Authority_v1.7.3.md  
**Supersedes:** Rules Anchor v1.7.2

---

## Purpose

This document is the **Rules Anchor** for the Last Man Running (LMR) project.

Its role is to:
- Define the **authoritative interpretation points** of the rules
- Act as the **binding contract** between the Rules Authority, the engine, tests, and UI
- Prevent ambiguity, drift, or “soft interpretation” during implementation

Where the Rules Authority defines *what the rules are*, this Anchor defines *how they must be interpreted*.

If any discrepancy exists:
- **Rules Authority v1.7.3 governs**
- This Anchor clarifies intent, not gameplay

---

## Canonical References

- **Rules Authority:** `LMR_Rules_Authority_v1.7.3.md`
- **Terminology Lock:**
  - *Extra Dice* is canonical
  - *Extra Rolls* is deprecated terminology
  - *Kill Rolls* remains the name of the optional rule module

---

## Global Invariants

The following invariants are absolute and must never be violated by engine logic or UI behavior.

### Dice Invariants

- A Die is always resolved individually.
- Dice are never combined, summed, chained, split, or reinterpreted.
- One Die produces at most one move.
- If a Die has no Legal Move, it is forfeited.

These invariants apply equally to:
- Initial Dice
- Extra Dice
- Dice granted via Kill Rolls
- Dice distributed in Team Play

---

## Extra Dice Interpretation

- **Extra Dice are Dice.**  
  They follow the same rules, restrictions, and resolution mechanics as all other Dice.

- Extra Dice may be earned by:
  - Rolling a 1
  - Rolling a 6
  - Killing an opponent’s Peg (if Kill Rolls are enabled)

- Extra Dice:
  - Are banked
  - Are rolled only after all currently pending Dice are resolved or forfeited
  - May themselves earn additional Extra Dice

- **Double Dice**:
  - Affects only the initial roll of a Turn
  - Does not multiply Extra Dice
  - Does not change how Extra Dice are resolved

---

## Turn Ownership and Resolution

- A Turn continues as long as unresolved Dice (including Extra Dice) exist.
- Control does not pass while any resolvable Dice remain.
- Dice resolution order is chosen by the active player.
- Rolling is prohibited while unresolved Dice exist.

---

## Team Play Anchors

- Dice belong to the **team**, not an individual player.
- When a player finishes:
  - Remaining Dice (including Extra Dice) are distributed to teammates with Legal Moves.
- Victory condition is **temporal**, not state-based:

> **In Team Play, the first team to finish all of its Pegs wins, and the game ends immediately.**

No further Dice are rolled or resolved after this condition is met.

---

## UI and Engine Contract

The UI and engine must enforce:

- No roll action while unresolved Dice exist
- No move action that spends more than one Die
- Clear visibility of:
  - Pending Dice
  - Banked Extra Dice
  - Acting player / team
- Deterministic resolution behavior consistent with the Rules Authority

The HTTP Debug Console is a **verification tool**, not a UX reference.

---

## Change Control

- Any rule change requires a new **Rules Authority version**
- The Anchor version must match the Rules Authority version
- Engine and UI behavior must be validated against the Anchor before release

---

**End of Rules Anchor v1.7.3**
