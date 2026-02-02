# LMR Rules Anchor v1.7.4

## Purpose

This document anchors interpretation of the **LMR Rules Authority**.
Where wording, implementation, or interpretation conflicts arise, this anchor defines the intended meaning and precedence.

This document supersedes **LMR Rules Anchor v1.7.3**.

---

## Authoritative Sources (Order of Precedence)

1. **LMR_Rules_Authority_v1.7.4.md** (highest authority)
2. Rules Anchor (this document)
3. Engine implementation
4. UI behavior
5. Tests and scenarios

Engine, UI, and tests must conform to the Rules Authority as interpreted here.

---

## Terminology Locks

### Extra Dice (Canonical)

- **Extra Dice** is the only valid term.
- Terms such as *Extra Rolls* or *bankedExtraRolls* are **forbidden**.
- Extra Dice represent **owed dice**, not permissions or actions.

### Active Die

- An **Active Die** is a designation applied to exactly one Pending Die.
- Active status does **not** force a move or forfeiture.
- Active Die designation may change freely among Pending Dice.

---

## Dice Lifecycle Interpretation

Dice exist in the following conceptual states:

- **Rolled Dice** → **Pending Dice** → **Active Die** → **Resolved**

Interpretation rules:

- Pending Dice must be resolved one at a time.
- Exactly one Active Die may exist at any moment.
- Lifecycle states are **descriptive**, not imperative.
- Turn blocking is based on **state**, not on required actions.

---

## Banked Extra Dice — Interpretation

### Nature of Banked Extra Dice

- Banked Extra Dice are **owed dice** that must be rolled.
- They are not “extra turns” and not optional.

### Cashout Semantics (Locked)

- If a player has **N Banked Extra Dice**, their next roll consists of **N dice rolled together**.
- That roll **fully consumes** the bank (N → 0).
- Any new Extra Dice earned from that roll are added afterward.

Any interpretation that allows “one-at-a-time” rolling of banked dice is incorrect.

---

## Auto-Pass Clarification

- Auto-pass resolves Pending Dice that have no legal moves.
- Auto-pass **never bypasses** Banked Extra Dice.
- If Banked Extra Dice remain after auto-pass, the turn does **not** advance.
- Only when **no Pending Dice** and **no Banked Extra Dice** remain may the turn advance.

---

## Turn Advancement Invariant (Interpretive)

A turn may not advance while:

- A die is Active, or
- Pending Dice remain, or
- Banked Extra Dice remain to be rolled.

This invariant is **state-based** and does not force any particular action.

---

## Engine / UI Contract Guidance

- The engine represents the Active Die implicitly (selected die).
- UI may allow re-selection of Active Die without resolving it.
- Tests asserting dice lifecycle behavior must follow the above interpretations.

---

## Change Log

### v1.7.4
- Forbade legacy “Extra Rolls” terminology.
- Locked interpretation of Banked Extra Dice as owed dice.
- Clarified N-dice cashout semantics.
- Clarified Auto-pass interaction with Banked Extra Dice.
- Aligned interpretation with engine and test suite behavior.
