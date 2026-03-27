# Startup Milestone Frame — LMR Project

Purpose:

This document defines the authoritative milestone roadmap and milestone
completion history for the LMR project.

------------------------------------------------------------------------

## Milestone Status Symbols

✓ COMPLETE  
○ IN PROGRESS (Open)  
→ PLANNED

------------------------------------------------------------------------

## Milestone Roster

✓ M1 — Engine Core (Authoritative Rules Engine)  
✓ M2 — Server Authority Layer  
✓ M3 — Pregame Options  
✓ M4 — Team Model Expansion  
✓ M5 — Game Setup UI  
✓ M6 — Graphical Board UI  
✓ M7 — Gameplay Interaction Layer  
✓ M8 — Game Completion & Results  
→ M9 — Production Readiness

------------------------------------------------------------------------

## M5 — Game Setup UI (Expanded Status)

✓ M5.1 — Player join / seat assignment  
✓ M5.2 — Ready system  
✓ M5.3 — Game configuration (options)  
✓ M5.4 — Start game transition  

✓ M5.6 — Lobby Lifecycle (join / leave / ready / start)  
✓ M5.7 — Team Assignment & Locking  
✓ M5.8 — Post-Game Return to Lobby  
✓ M5.9 — Lobby Interaction Contract  
✓ M5.10 — Lobby UX & Layout Stabilization

### M5.10 — Lobby UX & Layout Stabilization

• Fixed 8-seat table (non-dynamic, always visible)  
• Disabled rows tied to selected player count  
• Checkbox-based Ready system (player-controlled)  
• Owner indicator (crown) in seat column  
• Owner-only Start enforcement (UI + behavior)  
• Start button visual contract:
  - Green only when valid AND owner  
  - Disabled for non-owner players  
• Players X/Y display normalization  
• Layout restructuring:
  - Lobby Seats (left)
  - Pre-Game Options + Start (right)
• Regression recovery stabilization after layout iteration

------------------------------------------------------------------------

### M5.9 — Lobby Interaction Contract

#### Owner Model
- First player by room join order is the room owner.
- Ownership passes by original room join order when the current owner disconnects.
- Ownership order is stable for the room session.

#### Owner Powers
- Only the owner may:
  - change lobby-wide options
  - start the game
  - acknowledge post-game return to lobby

#### Player Powers
- Each player controls only their own:
  - team selection
  - color selection
  - ready state

#### Lobby-Wide Options
- Team Play
- Double Dice
- Kill Roll
- Fast Track

#### Ready / Start Contract
- Start is enabled only when:
  - all seats are filled
  - all players are Ready
- If any player becomes Not Ready, Start is disabled immediately.
- If the owner changes any lobby-wide option, all players reset to Not Ready.

#### Team Validation (Current Scope)
- 4 players: 2 teams of 2
- 6 players: 2 teams of 3
- 8 players: 2 teams of 4

#### Owner Visibility
- Owner is indicated in the seat table (crown icon)
- Owner is the only player able to initiate Start

------------------------------------------------------------------------

## M7 — Gameplay Interaction Layer (Expanded Status)

✓ M7.1 — Multi-die interaction gating stabilization  
✓ M7.2 — Peg arrow affordance pipeline  
✓ M7.3 — Directional arrow rendering  
✓ M7.4 — Multi-arrow support  
✓ M7.5 — Interaction refinements  
✓ M7.6 — Completion lock  

### POST-M7 VALIDATION RECORD — 2026-03-24  
(Team Play Delegation, No-Legal-Moves Contract, Team Victory)

• Delegated dice fully functional  
• No-legal-moves contract enforced  
• Team win detection verified  
• Game returns cleanly to lobby  

------------------------------------------------------------------------

## M8 — Game Completion & Results (Completion Record)

✓ M8.1 — Solo game-over overlay  
✓ M8.2 — Team game-over overlay  
✓ M8.3 — Owner-controlled return to lobby  
✓ M8.4 — `gameOver` / `ackGameOver` message contract

### M8 VALIDATION RECORD — 2026-03-25

• Solo results flow verified  
• Team results flow verified  
• Board remains visible at game end  
• Winner / winning team overlay renders correctly  
• Owner-only return-to-lobby flow verified  
• Post-game transition returns all players cleanly to lobby  

------------------------------------------------------------------------
