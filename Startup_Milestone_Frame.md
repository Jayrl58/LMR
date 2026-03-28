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
○ M9 — Production Readiness

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
✓ M5.11 — Player Naming & Identity System  
✓ M5.12 — Invite Flow & Remote Access Foundation  

------------------------------------------------------------------------

### M5.12 — Invite Flow & Remote Access Foundation

• Pre-join naming required before Create / Join  
• Client-side name validation enforced  
• Name propagation across lobby and status displays  
• Browser tab title reflects player name + room  

• URL room prefill implemented (`?room=ROOMCODE`)  
• URL room overrides stored room on first load  
• Manual invite baseline validated  

• Copy Invite Link implemented  
  - Includes correct origin (LAN / ngrok / localhost)  
  - Appends room code reliably  

• LAN invite flow validated  
  - Multiple devices join via shared URL  

• ngrok remote access established  
  - Single-tunnel architecture (5173 only)  
  - Vite proxy routes `/ws` to server  
  - App uses same-origin WebSocket path  
  - Public invite links function end-to-end  

• Stable checkpoint achieved and committed  

------------------------------------------------------------------------

### M5.11 — Player Naming & Identity System

• Pre-join name input implemented  
• Name validation rules enforced:
  - required
  - max length
  - allowed characters
  - uniqueness (case-insensitive)  

• Name synchronization across clients  
• Name displayed in:
  - lobby seats table  
  - status panel  
  - browser tab  

• Ready gated by valid local name  

------------------------------------------------------------------------

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

(unchanged — preserved)

------------------------------------------------------------------------

## M7 — Gameplay Interaction Layer (Expanded Status)

✓ M7.1 — Multi-die interaction gating stabilization  
✓ M7.2 — Peg arrow affordance pipeline  
✓ M7.3 — Directional arrow rendering  
✓ M7.4 — Multi-arrow support  
✓ M7.5 — Interaction refinements  
✓ M7.6 — Completion lock  

------------------------------------------------------------------------

## M8 — Game Completion & Results (Completion Record)

✓ M8.1 — Solo game-over overlay  
✓ M8.2 — Team game-over overlay  
✓ M8.3 — Owner-controlled return to lobby  
✓ M8.4 — `gameOver` / `ackGameOver` message contract  

------------------------------------------------------------------------
