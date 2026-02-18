# LMR Rules Anchor v1.7.6

## Purpose

This document anchors interpretation of the **LMR Rules Authority**.
Where wording, implementation, or interpretation conflicts arise, this
anchor defines the intended meaning and precedence.

This document supersedes **LMR Rules Anchor v1.7.5**.

------------------------------------------------------------------------

## Authoritative Sources (Order of Precedence)

1.  **LMR_Rules_Authority_v1.7.6.md** (highest authority)
2.  Rules Anchor (this document)
3.  Engine implementation
4.  UI behavior
5.  Tests and scenarios

Engine, UI, and tests must conform to the Rules Authority as interpreted
here.

------------------------------------------------------------------------

## Terminology Locks

### Extra Dice (Canonical)

-   **Extra Dice** is the only valid term for dice earned from
    qualifying events.
-   Terms such as *Extra Rolls* are forbidden.
-   Extra Dice represent owed dice, not permissions or actions.

### Banked Dice (Canonical)

-   **Banked Dice** are owed dice that must be rolled.
-   A **Bank Roll** consists of rolling exactly N dice when N Banked
    Dice exist.
-   A Bank Roll consumes the entire bank (N → 0).
-   Any newly earned Banked Dice from that roll are added afterward.
-   Rolling Banked Dice one-at-a-time is incorrect.

### Active Die

-   An **Active Die** is a designation applied to exactly one Pending
    Die.
-   Active status does not force a move or forfeiture.
-   Active Die designation may change freely among Pending Dice.

### Rematch (Canonical)

-   **Rematch** is the canonical term for a subsequent game created by
    unanimous consent after a completed game.
-   "Subsequent Game" is an internal descriptive term only and must not
    appear in player-facing UI text.
-   A Rematch implies:
    -   identical players (roster)
    -   identical seats
    -   identical teams
    -   carried-forward options (unless changed per Rules Authority)

------------------------------------------------------------------------

## Dice Lifecycle Interpretation

Dice exist in the following conceptual states:

Rolled Dice → Pending Dice → Active Die → Resolved

Interpretation rules:

-   Pending Dice must be resolved one at a time.
-   Exactly one Active Die may exist at any moment.
-   Lifecycle states are descriptive, not imperative.
-   Turn blocking is based on state, not required actions.

------------------------------------------------------------------------

## Team Play --- Interpretive Locks

### Turn Ownership

-   Turn order continues normally under Team Play.
-   A finished player remains in the turn rotation and still rolls on
    their turn.

### Delegation Eligibility (State-Based)

-   Delegation is permitted whenever the turn owner has Finished all of
    their Pegs.
-   If the turn owner becomes Finished mid-turn while Pending Dice
    remain, delegation becomes permitted for the remaining Pending Dice.
-   If the turn owner has any Peg not Finished, delegation is
    prohibited.

### Delegation Resolution Model

-   Delegation is sequential.
-   Only one Pending Die may be assigned and resolved at a time.
-   No simultaneous multi-die assignment is permitted.

------------------------------------------------------------------------

## Auto-Pass Clarification

-   A Dead Die is a Pending Die that currently has no Legal Move.
-   Auto-Pass resolves Pending Dice that have no Legal Moves.
-   Auto-Pass never bypasses Banked Dice.
-   If Banked Dice remain after Auto-Pass, the turn does not advance.
-   Only when no Pending Dice and no Banked Dice remain may the turn
    advance.

------------------------------------------------------------------------

## Turn Advancement Invariant (Interpretive)

A turn may not advance while:

-   A die is Active, or
-   Pending Dice remain, or
-   Banked Dice remain to be rolled.

This invariant is state-based and does not force any particular action.

------------------------------------------------------------------------

## Engine / UI Contract Guidance

-   The engine represents the Active Die implicitly (selected die).
-   Under Team Play, Pending Dice begin unassigned when delegation is
    permitted.
-   UI may allow re-selection of Active Die without resolving it.
-   Tests asserting dice lifecycle behavior must follow the above
    interpretations.

------------------------------------------------------------------------

## Game End vs Rematch Boundary (Interpretive)

-   A completed game enters an ENDED_GAME state where all gameplay
    actions are rejected.
-   The ended game remains frozen for result inspection until a new
    transition occurs.
-   A Rematch is a new game instance, not a continuation of the prior
    game.
-   Gameplay state is cleared at the Rematch boundary, not at game end.
-   The starting player for a Rematch is derived once from the prior
    game's frozen results during the Rematch transition.

------------------------------------------------------------------------

## Endgame Results Period (Interpretive)

-   After a game reaches a terminal state, the room enters an Endgame
    Results period.
-   Specific duration and behavior are defined in the Rules Authority.
-   If a Rematch is unanimously approved during the Endgame Results
    period, the Rematch transition occurs.
-   If the period expires or a Rematch fails, the room transitions to
    PRE_GAME.
-   Endgame transitions do not imply player removal.

------------------------------------------------------------------------

## Change Log

### v1.7.6

-   Updated precedence to Rules Authority v1.7.6.
-   Replaced "Banked Extra Dice" terminology with "Banked Dice / Bank
    Roll".
-   Clarified delegation eligibility as state-based (including mid-turn
    finishing).
-   Locked sequential delegation model.

### v1.7.5

-   Anchored "Rematch" terminology.
-   Clarified ENDED_GAME vs Rematch boundary.
-   Anchored Endgame Results period behavior.
