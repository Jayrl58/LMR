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

## Last Session Accomplishments (2026-03-25)

### M8 — Results & Post-Game Flow (Completed)

• Implemented on-board **Results Overlay**  
• Implemented `gameOver` server message  
• Implemented `ackGameOver` client acknowledgment  
• Implemented **owner-controlled return to lobby**  
• Removed automatic lobby return  
• Removed rematch from scope  
• Validated **solo and team flows end-to-end**  

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx  
  - WebSocket lifecycle stabilized (no reconnect loop)  
  - Correct gameOver payload mapping  
  - Results overlay fully functional  
  - Proper phase gating (active + ended)  

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

• Multiplayer gameplay loop fully stable  
• Team play fully validated  
• Delegation working correctly  
• End-of-game flow complete  
• Post-game return to lobby controlled by owner  

---

## Active Focus Shift

Next milestone focus:

### M5 — Player Entry & Access (Refinement)

Goal:

Make the system usable for **external players**, not just internal testing.

---

## Next Action

### M5 — Entry Flow Definition (START HERE NEXT SESSION)

Define the exact external player experience before coding.

---

### Immediate Task

Decide:

• Player naming rule:
  - optional on join  
  - required before Ready  (recommended baseline)

---

### Follow-on Scope (DO NOT IMPLEMENT YET)

• Room join clarity (code entry UX)  
• Player identity display in lobby  
• Owner visibility clarity  
• Reconnect expectations  
• External usability validation  

---

## Constraints (CRITICAL)

Do NOT:

• Modify core gameplay loop  
• Introduce rematch logic  
• Add player communication yet  
• Change server authority model  

---

## Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline stability:
   - Run server
   - Join room (2 clients)
   - Verify full game → results → return to lobby

2. Begin with:
   → Player naming decision (M5)

3. Do NOT touch:
   - delegation logic  
   - dice system  
   - results flow  

Unless regression is observed  

---

## Explicit Stop Condition

Stop immediately if:

• Join flow breaks  
• Lobby state desync occurs  
• Game no longer reaches gameOver correctly  
• Return-to-lobby fails  

Otherwise proceed
