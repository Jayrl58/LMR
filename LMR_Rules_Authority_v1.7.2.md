# Last Man Running (LMR)
## Rules Authority v1.7.2 — Hardened

This document is the single authoritative source for all gameplay rules of Last Man Running (LMR).
All gameplay behavior must be fully derivable from this document.

This document defines legal moves, state transitions, and outcomes only.
Player seating, UI presentation, lobby configuration, and setup etiquette are out of scope.

---

## 1. Glossary

**Arm**  
A segment of the board associated with a player, containing that player’s Point, One Spot, Home, and Home Entry region.

**Base**  
The area where a player’s Pegs begin the game and where Pegs return when they are Killed. Pegs in Base are not on the Track.

**Center Spot**  
The single Spot at the center of the board. It may hold at most one Peg.

**Die / Dice**  
One or more six-sided Dice used to determine movement. Dice are resolved individually.

**Exact Count**  
The full value of one Die must be used to move exactly one Peg.

**Finished Peg**  
A Peg that has reached the highest available Home Spot and may not be moved again.

**Home**  
The set of Home Spots (H0–H3) belonging to a player.

**Home Spot**  
One of the four finishing Spots for a player’s Pegs. Home Spots fill from H3 to H0.

**Kill**  
When a Peg lands on a Spot occupied by another player’s Peg, sending the other Peg back to Base.

**Legal Move**  
A move that fully satisfies all applicable rules for the Die being resolved.

**One Spot**  
The Track Spot used on a roll of 1 to enter a Peg from Base.

**Peg**  
A single playing piece controlled by a player.

**Point**  
The Track Spot used to enter a Peg from Base on a roll of 6, and the Track Spot through which Center transitions occur.

**Spot**  
Any single position on the board that can hold at most one Peg.

**Track**  
The continuous clockwise path of Spots connecting all Arms, Corners, and Points.

**Turn**  
All Dice resolutions, moves, and Extra Rolls taken by a player until control passes.

---

## 2. Setup

### 2.1 Pre-Game Configuration

Before the game starts, the following are selected and then locked for the duration of the game:

- Player color
- Optional rules:
  - Team Play (on/off)
    - If enabled: team assignment and team composition
  - Double Dice (on/off)
  - Kill Rolls (on/off)
  - Fast Track (on/off)

### 2.2 Board Selection

The board used must support the number of players:

- 2 players → 4-player board
- 3 players → 6-player board
- 4 players → 4- or 8-player board
- 5 players → 6- or 8-player board
- 6 players → 6-player board
- 7–8 players → 8-player board

Unused Arms remain empty.

### 2.3 Initial Peg Placement

- All Pegs begin in their player’s Base.
- If Fast Track is enabled, one Peg per player is immediately placed on that player’s H3.

---

## 3. Core Gameplay Rules

### 3.1 Movement Direction

- Pegs move clockwise on the Track.
- A Peg may not land on or pass over a Spot occupied by one of its own Pegs.

### 3.2 One Spot, One Peg

At most one Peg may occupy any Spot at any time.
This applies universally to the Track, Center Spot, Home, and Base.

### 3.3 Exact Count

The full value of one Die must be used to move exactly one Peg.

### 3.4 Mandatory Movement

- If a player has a Legal Move for a Die, they must make a move.
- Dice continue to be resolved as long as unresolved Dice with Legal Moves exist.

---

## 4. Dice Resolution

### 4.1 Dice Resolution Order

- Dice are resolved one Die at a time.
- When multiple Dice are available, the player chooses the order in which they are resolved.
- All Dice from a roll must be resolved or forfeited before any Extra Rolls are rolled.
- No new Dice may be rolled while unresolved Dice exist.

Each Die is resolved independently.

### 4.2 Extra Rolls

- Rolling a 1 or 6 always grants an Extra Roll.
- Extra Rolls are banked and resolved only after all current Dice are resolved or forfeited.
- Extra Rolls are granted even if the triggering Die has no Legal Move.
- When Kill Rolls are enabled, Killing an opponent’s Peg grants an Extra Roll.

Extra Rolls follow the same resolution rules as all other Dice.

---

## 5. Legal Moves

### 5.1 Legal Move Determination

A Legal Move must:

- Use the full value of the Die
- Obey clockwise Track movement
- Respect one Spot, one Peg
- Respect Track Entry, Center, and Home rules
- Respect all enabled optional rules

### 5.2 No Legal Move

- If no Legal Move exists for a Die, that Die is forfeited.
- Forfeiting a Die has no effect on the resolution of any other Dice.
- A forfeited Die does not move a Peg.

### 5.3 Forced Moves

If only one Legal Move exists for a Die at the time that Die is being resolved, that move is forced.

---

## 6. Track Entry

From Base:

- A roll of 1 allows entry to the One Spot.
- A roll of 6 allows entry to the Point.

Normal Kill rules apply on entry.

---

## 7. Center Spot

### 7.1 Entry

A Peg that occupies any Point at the start of Die resolution may enter the Center Spot by rolling a 1.

### 7.2 Exit

A Peg that occupies the Center Spot may exit to any Point by rolling a 1.

Entry to and exit from the Center Spot are transitions and are independent of Track direction.

### 7.3 Additional Rules

- Only one Peg may occupy the Center Spot.
- Kill resolution follows the global Kill Rules (§9).

---

## 8. Track and Home Movement

### 8.1 Track Definition

The Track is a continuous clockwise path of Spots passing through Arms, Corners, and Points.
The Track does not branch.

### 8.2 Home Entry

Each Arm has a final Track Spot that precedes Home.

- For non-owning players, it behaves exactly like any other Track Spot.
- It may be occupied, passed over, and involved in Kills.

For the owning player’s Pegs:

- The Track terminates after this final Track Spot.
- A Peg may enter Home without stopping on the final Track Spot, as part of a single Exact Count move.
- When a Peg’s movement reaches the final Track Spot and would continue beyond it, the only legal continuation is into Home.
- A Peg may not continue past the final Track Spot on the Track.

If Home entry is not legal (due to Exact Count or blocking by the player’s own Pegs), the move is illegal.

### 8.3 Finishing Pegs

- Home Spots fill in order: H3, H2, H1, H0.
- A Peg is finished when it reaches the highest available Home Spot.
- A Finished Peg remains on its Home Spot and may not be moved again.

---

## 9. Kill Rules

### 9.1 Where Kills Are Allowed

- Kills are permitted on the Track and in the Center Spot.
- Kills are not permitted in Base or Home.

### 9.2 Resolution

- The Killed Peg is returned to Base.
- The moving Peg occupies the destination Spot.

### 9.3 Kill Rolls (Optional)

- If enabled, Killing an opponent grants an Extra Roll.
- Killing a teammate never grants an Extra Roll.

---

## 10. Team Play (Optional)

### 10.1 Teams

If Team Play is enabled, teams are chosen before the game starts and remain fixed.

### 10.2 Finishing in Team Play

When a player finishes all Pegs:

- All unresolved Dice for that Turn, including banked Extra Rolls, are distributed to teammates with Legal Moves.
- On future Turns, the finished player continues rolling and distributing Dice to teammates with Legal Moves.
  - If no teammate has a Legal Move for a Die, that Die is forfeited.

Dice are distributed; Turns are not transferred.

---

## 11. End of Game

### 11.1 Individual Play

In individual play, the game ends immediately when a player finishes all Pegs.

### 11.2 Team Play

In Team Play, a team wins when all players on that team finish all Pegs.

### 11.3 Finishing Order

Finishing order does not affect victory.
It may be recorded for summary or rematch purposes.

---

## 12. Subsequent Games (Optional)

In a rematch with the same players and teams, the first finisher on the winning team may be designated to go first.

---

End of Rules Authority v1.7.2 — Hardened
