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

## Last Session Accomplishments (2026-03-27)

### M5 — Lobby UX & Interaction Stabilization

• Rebuilt lobby layout (side-by-side):
  - Lobby Seats (left)
  - Pre-Game Options + Start (right)

• Implemented fixed 8-seat table model
  - Rows always visible
  - Rows disabled based on player count

• Restored and stabilized Ready system
  - Checkbox for current player
  - Read-only indicators for others

• Implemented owner visibility (crown in seat column)

• Enforced Start conditions:
  - Room must be full
  - All players must be Ready
  - Owner-only start authority

• Implemented Start button UX contract:
  - Green text + green border + light green background when valid
  - Disabled for non-owner players
  - No misleading clickable states

• Added Players X/Y display

• Recovered from multiple UI regressions
  - Established safe modification approach (full-file replacement only)
  - Eliminated pattern-based replacements

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx  
  - Lobby layout stabilized  
  - Seat table behavior correct  
  - Ready system correct (checkbox + read-only)  
  - Owner-only start enforced (logic + UI)  
  - Start button visual contract correct  
  - Disabled rows functioning correctly  

• handleMessage.ts  
  - Delegation logic stable  
  - No-legal-moves contract working  
  - Team delegation validated  

• wsServer.ts  
  - gameOver emission implemented  
  - ackGameOver wired correctly  
  - No auto-reset to lobby  
  - Pending dice structure preserved  

System status:

• Multiplayer gameplay loop stable  
• Lobby flow stable (create → join → ready → start)  
• Ownership model functioning correctly  
• UI interaction contract aligned with server rules  

---

## Active Focus

Continue M5 refinement:

### Player Identity & Lobby Completion

---

## Next Action (START HERE)

### Player Naming Implementation

Define and implement:

• Player name input (replaces p0/p1/etc.)  
• Validation rules:
  - max length: 12 characters  
  - uniqueness (case-insensitive)  
  - trimmed input  

• UI placement:
  - within Lobby Seats table (Player column)

---

## Follow-on Scope (DO NOT IMPLEMENT YET)

• Color selection dropdown  
• Team selection control  
• Owner display in header (optional enhancement)  
• Lobby polish (centering / spacing)  

---

## Constraints (CRITICAL)

Do NOT:

• Modify gameplay loop  
• Modify server authority model  
• Introduce rematch logic  
• Change delegation or dice systems  

---

## Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline:
   - Run server
   - Open 2+ clients
   - Create room
   - Fill seats
   - Ready all players
   - Verify only owner can start

2. Begin with:
   → Player naming implementation

3. Do NOT touch:
   - start logic  
   - seat logic  
   - ready system  

Unless regression is observed  

---

## Explicit Stop Condition

Stop immediately if:

• Ready system breaks  
• Seat table desync occurs  
• Non-owner can start game  
• Start becomes clickable incorrectly  

Otherwise proceed
