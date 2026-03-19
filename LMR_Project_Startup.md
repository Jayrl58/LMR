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

------------------------------------------------------------------------

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

------------------------------------------------------------------------

## Last Session Accomplishments

Completed during this session:

• Restored full multiplayer gameplay App.tsx (resolved file drift issues)

• Completed double-dice interaction loop:

  - die selection now triggers getLegalMoves correctly  
  - legalMoves scoped to selected die  
  - destination highlights update per die  
  - clicking destination sends correct move  
  - move uses explicitly selected die  
  - moveResult applies returned nextState to UI  

• Fixed pending dice lifecycle:

  - no overwrite from legalMoves  
  - full pending set preserved until move  
  - only spent die is removed after move  

• Fixed UI → server contract issues:

  - die-specific requests verified end-to-end  
  - handleMessage confirmed correct  
  - removed reliance on stale or inferred dice  

• Verified working behavior:

  - roll 1,6 → both dice appear  
  - select 1 vs 6 → different legal destinations  
  - click destination → peg moves  
  - only used die is consumed  
  - remaining die persists correctly  

Result:

The full gameplay loop (roll → select die → preview → move → update)
is now operational and stable.

------------------------------------------------------------------------

## Current Technical State

Operational live UI pipeline:

WebSocket  
→ App.tsx message handlers  
→ state mapping  
→ mapGameStateToUI  
→ mapPositionToBoardHole  
→ BoardRenderer  

Current graphical UI capabilities:

• Room creation and join (multi-client verified)  
• Lobby → Game transition  
• Player seating and color assignment  
• Start Game flow  
• Roll (single and double dice)  
• Explicit die selection  
• Die-specific legal move requests  
• Destination highlighting  
• Click-to-move (destination-based)  
• Move result state synchronization  

Renderer status:

• Board geometry validated for 4P / 6P / 8P  
• Peg rendering stable  
• Arm ownership coloring stable  
• Base and home rendering correct  
• Arrow affordance system implemented and functional  
• Destination highlighting functional  

Rules / engine validation:

• Double-dice lifecycle verified end-to-end  
• Die-specific legal move generation validated  
• Move application + state propagation confirmed  
• Partial die consumption working correctly  

Milestone state:

• M6 — Graphical Board UI complete  
• M7 — Gameplay Interaction Layer in progress  

------------------------------------------------------------------------

## Next Action

Continue M7 — Gameplay Interaction Layer.

Objective:

Refine interaction clarity now that the full gameplay loop is working.

Immediate next task (RECOMMENDED):

### Destination Highlight Visibility & Clarity

Accomplishes:
• Makes legal move targets unmistakably visible  
• Reduces reliance on debug panel  
• Aligns visual affordance with interaction model  

Impact:
• Directly improves usability of current working system  
• No changes to rules or engine  

Pros:
• Low risk  
• High clarity gain  
• Builds on working pipeline  

Cons:
• Requires tuning visual styling in BoardRenderer  

---

Secondary options:

### Option B — Arrow + Highlight Alignment

• Ensure arrows clearly point to highlighted destinations  
• Improve consistency between indicators  

### Option C — Turn / Active Player Visual Clarity

• Stronger indication of whose turn it is  
• Tie color + UI messaging together  

---

Constraint:

• Do not change rules authority  
• Do not change move generation  
• Maintain destination-click model  
• Maintain explicit die selection requirement  

------------------------------------------------------------------------