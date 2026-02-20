# LMR Rules Authority

## Version 1.7.6

------------------------------------------------------------------------

# 9. Pre-Game Options

## 9.1 Available Options

Before the game starts, the following optional rules may be enabled and
are then locked for the duration of the game:

-   Team Play\
-   Double Dice\
-   Kill Rolls\
-   Fast Track

------------------------------------------------------------------------

## 9.2 Team Play (Optional)

If **Team Play** is enabled, players are assigned to teams.\
The game is won when **all players on a team have finished all of their
Pegs**.

### 9.2.1 Team Formation

When Team Play is enabled:

-   The game is configured with a **teamCount** of 2 or greater.\
-   Teams must be equal size. Therefore, **teamCount must evenly divide
    playerCount**.

### 9.2.2 Teammate Interaction

Under Team Play:

-   A Peg may legally land on and **Kill** a teammate's Peg.\
-   A Kill of a teammate's Peg does not grant a Banked Die.\
-   If killing a teammate's Peg is the only Legal Move available for a
    Die, that move must be taken.

### 9.2.3 Turn Ownership and Delegation

Turn order continues normally under Team Play.

When a player's turn arrives, that player becomes the **turn owner** and
rolls Dice as usual.

-   If the turn owner has any Peg that is not Finished, that player
    Resolves Pending Dice under the standard rules.\
-   If the turn owner has Finished all of their Pegs, the Pending Dice
    from that roll are delegated to eligible teammates in accordance
    with §9.2.4 and §9.2.5.

### 9.2.4 Delegation of Pending Dice

When delegation is permitted:

-   Each Pending Die begins **unassigned**.\
-   The turn owner may delegate a Pending Die only to a player on the
    same team who currently has at least one Legal Move for that Die.\
-   If multiple Pending Dice exist, the turn owner may delegate
    different Dice to different eligible teammates.

A Pending Die that has no Legal Move available for any player on the
team in the current game state is a **Dead Die**.

-   A Dead Die may later have a Legal Move available if the game state
    changes during the Turn.\
-   A Dead Die is forfeited under **Auto-Pass** conditions only when
    none of the remaining Pending Dice have a Legal Move.

### 9.2.5 Sequential Delegation and Resolution

When delegating:

-   The turn owner delegates a Pending Die of their choice to an
    eligible teammate.\
-   Only one Pending Die may be delegated at a time.\
-   Upon delegation, the assigned teammate immediately Resolves that Die
    by applying a Legal Move.\
-   After the Die is Resolved, the game state is updated before any
    remaining Pending Dice are evaluated.\
-   The process repeats until all Pending Dice are either Resolved or
    forfeited under Auto-Pass.

No two Pending Dice are simultaneously assigned for independent
resolution.

------------------------------------------------------------------------

## 9.3 Double Dice (Optional)

If **Double Dice** is enabled, the start-of-turn roll produces **two
Dice** instead of one.

Both Dice become **Pending Dice** for that Turn.

### 9.3.1 Resolution Model

-   Dice are resolved one Die at a time.\
-   When multiple Pending Dice exist, the player chooses which Die to
    designate as the **Active Die**.\
-   The Active Die may be changed before resolution.\
-   A Die is Resolved only when it is used to apply a Legal Move.\
-   A Die with a Legal Move must be Resolved.

### 9.3.2 Temporarily Unusable Dice

-   A Pending Die that has no Legal Move available is a Dead Die.\
-   A Dead Die is not automatically forfeited if another Pending Die has
    a Legal Move.\
-   If a player attempts to resolve a Die that has no Legal Move while
    another Pending Die does have a Legal Move, the attempt is rejected
    and no Dice are forfeited.

### 9.3.3 Auto-Pass Interaction

-   If none of the remaining Pending Dice have a Legal Move, Auto-Pass
    occurs.\
-   All remaining Pending Dice are forfeited in Roll Order.

### 9.3.4 Extra Rolls and Banked Dice

Double Dice affects only the start-of-turn roll.

-   Rolling a **1** grants exactly one Banked Die.\
-   Rolling a **6** grants exactly one Banked Die.\
-   If Kill Rolls are enabled, each qualifying capturing Move grants
    exactly one Banked Die.

Each qualifying event grants one Banked Die independently.\
Double Dice does not multiply Banked Dice awards.

When performing a **Bank Roll**, the number of Dice rolled must equal
the number of Banked Dice, regardless of whether Double Dice is enabled.

### 9.3.5 Scope

Double Dice alters only the number of Dice created at the start of a
Turn.\
It does not modify any other game rules.

------------------------------------------------------------------------

## 9.4 Kill Rolls (Optional)

If **Kill Rolls** is enabled, a player banks exactly one Banked Die for
each Move that captures one opponent Peg.

### 9.4.1 Qualifying Move

A qualifying Move is a Move in which:

-   A player's Peg lands on a Spot occupied by an opponent's Peg, and\
-   That opponent's Peg is sent to Base in accordance with the standard
    Kill rules.

A Move can capture only one Peg.

-   A Move that captures an opponent's Peg grants exactly one Banked
    Die.\
-   A Move that does not capture a Peg grants no Banked Die.\
-   A Move that captures a teammate's Peg grants no Banked Die.

### 9.4.2 Turn Interaction

Banked Dice earned from capturing Moves are accumulated during the Turn
and follow the standard Banked Die and Bank Roll rules.

------------------------------------------------------------------------

## 9.5 Fast Track (Optional)

If **Fast Track** is enabled, each player begins the game with one Peg
already placed in Home.

### 9.5.1 Initial Placement

At the start of the game, before the first Turn:

-   Each player starts with one Peg on H3 (the highest Home Spot).\
-   The remaining Pegs begin in Base.

### 9.5.2 Status of the Placed Peg

The Peg placed on H3 under Fast Track:

-   Is immediately a Finished Peg.\
-   May not be moved.\
-   May not be Killed.\
-   Counts toward that player's total Finished Pegs for purposes of
    victory.

### 9.5.3 Scope

Fast Track alters only the initial Peg placement at game start.\
It does not modify any other game rules.

------------------------------------------------------------------------

# Change Log (v1.7.6)

-   Consolidated and restructured Section 9 (Pre-Game Options).
-   Formalized Team Play delegation eligibility gate.
-   Clarified Dead Die lifecycle wording.
-   Locked Double Dice to exactly one Banked Die per qualifying event.
-   Formalized Kill Rolls as move-based (one Banked Die per capturing
    Move; teammate exclusion retained).
-   Cleaned scope language for all pre-game options.
