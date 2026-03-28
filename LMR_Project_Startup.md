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

## Last Session Accomplishments (2026-03-28)

### M5 — Lobby Identity, Invite Flow, and Remote Access Foundation

• Completed player naming flow end-to-end
  - Pre-join name required before Create Room / Join Room
  - Name validation active on client
  - Names carry into lobby seats table
  - Names sync globally across clients
  - Names display in status line
  - Browser tab title uses player name + room code
  - Ready is blocked when local player name is invalid

• Stabilized owner / join button behavior
  - Create Room visible but enabled only in valid owner / pre-join states
  - Join Room disabled once already joined
  - Lobby entry button-state behavior now matches locked contract

• Established working pre-join flow
  - Pre-join state acts as player entry screen
  - Name field and Room Code field live before lobby join
  - Join/create transition into joined lobby remains stable

• Implemented invite / room entry improvements
  - URL room-code prefill works with ?room=ROOMCODE
  - URL room value now overrides stale stored room value on first load
  - Manual invite baseline validated
  - Copy Invite Link button now works

• Established LAN invite flow
  - Host can create room locally
  - LAN URL works with room query string
  - Other devices on same network can join using shared URL

• Established remote testing foundation via ngrok
  - Vite configured for single-tunnel remote access
  - /ws proxied through Vite to local server
  - App.tsx uses same-origin websocket path
  - ngrok public URL now works for remote invite flow
  - Public invite links can be copied in correct format

• Reached and committed a stable checkpoint
  - Remote invite flow complete
  - URL prefill stable
  - Copy Invite Link stable
  - No regression to lobby naming / ready / start behavior

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx  
  - Pre-join name field implemented  
  - Client-side name validation active  
  - Create / Join gated by valid name  
  - Global player-name sync working  
  - Status line shows player name  
  - Browser tab title shows name + room  
  - URL room prefill stable  
  - Copy Invite Link working for LAN and ngrok depending on current origin  
  - WebSocket now uses same-origin /ws path  

• wsServer.ts  
  - Authoritative name handling working  
  - Lobby name propagation working  
  - Ready guard for invalid local name working  
  - Existing lobby / gameplay behavior preserved  

• vite.config.ts  
  - host enabled  
  - /ws proxy to ws://127.0.0.1:8787  
  - allowed host configured for ngrok testing  
  - Single ngrok tunnel model working  

System status:

• Multiplayer lobby flow stable  
• Player naming flow stable  
• LAN invite flow stable  
• ngrok remote invite flow stable  
• Ownership model functioning correctly  
• UI interaction contract aligned with server rules  

---

## Active Focus

Continue M5 refinement:

### Lobby Completion After Naming

Primary next step:
• Color selection after join

---

## Next Action (START HERE)

### Color Selection Contract and Implementation

Define and implement:

• How a player selects color after joining  
• Whether colors must be unique / exclusive  
• Whether only the local player can edit their own color  
• Exact UI placement for the color control in the lobby table  

Begin with contract lock before code.

---

## Follow-on Scope (DO NOT IMPLEMENT YET)

• Team selection control  
• Invite page (Option C, future)  
• Additional lobby polish  
• Public deployment planning  

---

## Remote Test Notes

Current remote testing setup:

1. Server:
   npm run dev:server

2. UI:
   npm run dev -- --host

3. ngrok:
   ngrok http 5173

4. Public URL:
   Use the current ngrok forwarding URL

Behavior:
• The ngrok URL can host the app directly
• Create Room on the ngrok-hosted page if you want Copy Invite Link to produce a public ngrok invite
• Create Room on LAN / localhost page if you want LAN-local invite output instead

---

## Constraints (CRITICAL)

Do NOT:

• Modify gameplay loop  
• Modify server authority model  
• Rework invite flow again unless regression is observed  
• Introduce rematch logic  
• Change delegation or dice systems  

---

## Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline:
   - Run server
   - Run UI with --host
   - Open 2+ clients
   - Create room
   - Verify pre-join naming still gates Create / Join
   - Verify names sync globally
   - Verify Ready is blocked on invalid local name
   - Verify Copy Invite Link works
   - Verify ngrok invite works if remote testing is needed

2. Begin with:
   → Color selection contract

3. Do NOT touch:
   - gameplay loop
   - start logic
   - ready logic
   - invite flow

Unless regression is observed

---

## Explicit Stop Condition

Stop immediately if:

• Name sync breaks  
• Ready gating breaks  
• URL room prefill regresses  
• Copy Invite Link regresses  
• Remote ngrok join stops working  
• Non-owner can start game  

Otherwise proceed
