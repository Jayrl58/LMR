# LMR Project Startup

Purpose:
Provide the exact restart anchor for the next development session.

This document is the authoritative session restart reference and should
always answer three questions immediately:

1. Where is the project technically?
2. What was accomplished in the last session?
3. What is the exact next task to begin work?

Milestone tracking is maintained separately in:

Startup_Milestone_Frame.md

---

## Project Orientation

Project: Last Man Running (LMR)

Repository Root:
LMR Playpen

Primary Development Server Command:

npm run dev:server

Server Runtime Endpoints:

WebSocket server
ws://127.0.0.1:8787

HTTP console
http://127.0.0.1:8788

Architecture Notes:

• Node / TypeScript authoritative game engine  
• WebSocket server controls all game state transitions  
• UI clients act as state viewers and command senders only  
• Game state transitions occur exclusively through the server engine  

Board Geometry Authority:

Playpen/board_geometry/boardGeometry.ts

---

## Last Session Accomplishments (2026-03-23)

### M7 Completion + Final Interaction Polish

• Implemented **clear selected-die visual system**
  - Structural highlight (outer ring + separator + elevation + scale)
  - Works consistently across all palette colors

• Enforced **peg-driven interaction model**
  - No peg selected → no destination highlights
  - Background click fully clears selection state

• Finalized **movable peg highlighting**
  - Clear visibility across:
    - base
    - track
    - point
    - one spot
  - Adopted structural (not color-only) highlight approach

• Completed **dice panel interaction model**
  - Dynamic rows:
    - Roll row (pre-roll only)
    - In-play row (post-roll only)
  - Dice transition visually from roll → in-play
  - Player-colored dice inputs and in-play dice
  - Overlay positioned top-right (player-relative)

• Refactored **UI panel layout**
  - Status (top-left): Player + Turn only
  - Options (bottom-left): game configuration
  - Debug (right): full state visibility

• Fixed **peg deselection behavior**
  - Background click removes peg selection
  - Destination highlights correctly cleared

• Fixed **selected die clarity + selection UX**

• Fixed **critical server bug — option propagation**
  - startGame now merges `room.gameConfig` into active game config
  - Ensures:
    - killRoll
    - doubleDice
    - teamPlay
    - fastTrack
  - UI now reflects true game configuration

• Added **debug visibility for raw game config**
  - Eliminated ambiguity in client/server binding

---

### Result

• Gameplay interaction layer is **complete and stable**  
• UI clarity achieved across all interaction surfaces  
• Server/UI contract fully aligned  
• All known interaction ambiguities resolved  

→ **M7 COMPLETE**

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx (latest version with:
  - structural die selection highlight
  - peg-gated destination highlighting
  - dynamic dice panel
  - split status/options/debug panels)

• handleMessage.ts (zero-move fix intact)

• wsServer.ts (option propagation fix applied)

System status:

• Multiplayer gameplay loop working end-to-end  
• Interaction model finalized  
• Visual clarity validated  
• Server/UI contract aligned  
• Debug panel confirms correct state  

---

## Next Action

### PRIORITY: M8 — Game Completion & Results

Objective:

Define and implement end-of-game behavior and result presentation.

---

### Initial Task Options

Option A — End-of-game detection (recommended)

Accomplishes:
• Detect win condition (first player or team finished)
• Trigger game completion state

Impact:
• Server-side logic

Pros:
• Establishes core M8 foundation

Cons:
• Requires careful rule validation

---

Option B — Results UI

Accomplishes:
• Display winner and final standings

Impact:
• UI layer

Pros:
• Visible progress

Cons:
• Depends on completion detection

---

### Recommendation

Option A — implement end-of-game detection first.

---

## Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline:

   • App.tsx = latest M7-complete version  
   • handleMessage.ts = zero-move fix version  
   • wsServer.ts = option propagation fix version  

2. Start with:
   → M8 end-of-game detection

3. Do NOT revisit:
   • M7 interaction behavior  
   • highlight systems  
   • dice panel layout  
   unless regression is observed  

---

## Explicit Stop Condition

Do NOT modify server or UI core logic unless:

• pendingDice disappears incorrectly  
• bankedDice miscalculates  
• turn ownership desync reappears  
• option propagation fails again  

Otherwise proceed forward to M8.