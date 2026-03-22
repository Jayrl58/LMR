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

## Last Session Accomplishments (2026-03-22)

• Identified and fixed **server-side multi-die zero-move bug**
  - Removed incorrect auto-pass behavior in handleMessage.ts
  - Ensured pendingDice persist until explicitly resolved

• Stabilized **die selection → legalMoves request path**
  - Bound die click directly to getLegalMoves
  - Eliminated reliance on effect-based dispatch

• Implemented **auto-select + auto-request for final die**
  - When one die remains, legal moves now display automatically

• Fixed **turn ownership desynchronization**
  - Merged authoritative turn envelope into UI gameState
  - Ensured nextActorId is the single source of truth

• Validated full gameplay loop across multiple players:
  - roll → select die → move → consume die → chain rolls → turn advance

• Confirmed correct behavior for:
  - pendingDice lifecycle
  - banked dice accumulation and consumption
  - expectedRollCount transitions
  - cross-client turn synchronization

Result:

The gameplay loop is now **functionally stable and deterministic**.

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx (latest merged version with:
  - turn-envelope merge
  - direct die selection requests
  - auto-select final die behavior)

• handleMessage.ts (zero-move fix applied)

• wsServer.ts unchanged and functioning correctly

System status:

• Multiplayer gameplay loop working end-to-end
• Server/UI contract aligned
• No fallback UI reconstruction required

---

## Next Action

### PRIORITY: M7 Refinement Completion

Objective:

Complete remaining interaction-layer refinements and prepare for M7 completion lock.

---

### Task Options

Option A — Interaction polish (recommended)

Accomplishes:
• Improve UX clarity and responsiveness
• Reduce cognitive load during move selection

Impact:
• UI-only refinements
• No server changes required

Pros:
• Safe
• Visible improvement
• Builds on stable foundation

Cons:
• Does not advance milestone boundary directly

---

Option B — M7 Completion Lock

Accomplishes:
• Declare M7 complete
• Transition to M8 planning

Impact:
• Formal milestone transition

Pros:
• Moves project forward structurally

Cons:
• May skip minor polish opportunities

---

### Recommendation

Option A — perform light refinement pass, then lock M7.

---

## Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline:

   • App.tsx = latest merged version (turn-envelope fix included)
   • handleMessage.ts = zero-move fix version
   • wsServer.ts = unchanged working version

2. Start with:
   → M7 refinement OR completion decision

3. Do NOT revisit:
   • turn envelope bugs
   • multi-die lifecycle bugs
   unless regression is observed

---

## Explicit Stop Condition

Do NOT modify server or UI core logic unless:

• pendingDice disappears incorrectly  
• bankedDice miscalculates  
• turn ownership desync reappears  

Otherwise proceed forward to refinement and milestone completion.
