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

• Stabilized current graphical gameplay interaction loop after multiple App.tsx regressions

• Completed and verified peg-first destination flow:

  - pegs are clickable again  
  - destination click is blocked until a peg is selected  
  - selected peg filters legal destinations correctly  
  - background click clears peg selection  
  - accidental destination-first moves are prevented  

• Completed destination highlight clarity pass:

  - crosshair destination markers retained  
  - crosshair renders correctly on normal track spots, points, 1-spots, and home spots  
  - existing board rings remain underneath special spaces  
  - old home-destination ring override removed from active behavior  

• Improved board-piece readability:

  - peg size increased so pegs fill their holes more appropriately  
  - no persistent selected-peg visual anchor added (by user preference)  

• Restored and verified colored pending-die rendering:

  - reusable die-face renderer direction confirmed in standalone preview  
  - pending dice now render as colored dice faces in live UI  
  - pip layout confirmed correct  
  - pending dice remain visually distinct from plain buttons  

• Restored and verified single-die convenience behavior:

  - when exactly one pending die exists, UI auto-selects it  
  - legal moves auto-fetch without requiring an extra die click  

• Verified multiplayer identity and turn progression:

  - four distinct browser identities successfully joined one room as p0 / p1 / p2 / p3  
  - turn order advanced correctly through all four players and returned to p0  
  - client-side moveResult turn handling was corrected so nextActorId is respected  

• Captured future UI criterion for later work:

  - each player must get a rotated personal board view with that player's own arm/color at 6 o'clock  
  - 4-player example locked conceptually:
    - p0 sees blue bottom
    - p1 sees red bottom
    - p2 sees green bottom
    - p3 sees yellow bottom

• Attempted dynamic per-die roll inputs, but this work is NOT stable and should be treated as unfinished / quarantined for restart

Result:

The core live gameplay UI is working again and verified in multiplayer:
join → start → roll → select die → select peg → select destination → move →
turn advance.

The dynamic roll-input replacement is the only active UI thread left in an
unstable state from this session.

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
• Roll submission (current stable version still preferred over today's unfinished dynamic-input variant)  
• Pending dice rendered as colored die faces  
• Single-die auto-selection and auto-fetch  
• Explicit die selection when multiple dice are pending  
• Peg-first interaction model  
• Destination crosshair highlighting  
• Click-to-move after peg selection  
• Move result state synchronization  
• Multiplayer turn advancement verified across four players  

Renderer status:

• Board geometry validated for 4P / 6P / 8P  
• Peg rendering stable  
• Peg size improved  
• Arm ownership coloring stable  
• Base and home rendering correct  
• Destination crosshair system stable  
• Home destinations now use crosshair overlay correctly  

Rules / engine validation:

• Turn advancement verified in multi-client play  
• nextActorId client handling corrected  
• Die-specific legal move requests working  
• Single-pending-die convenience flow working  
• Peg-selection gating working as intended  

Milestone state:

• M6 — Graphical Board UI complete  
• M7 — Gameplay Interaction Layer in progress  

------------------------------------------------------------------------

## Next Action

Continue M7 — Gameplay Interaction Layer.

Objective:

Resume from the last known-good App.tsx baseline and re-approach dynamic
per-die roll inputs in a smaller, controlled pass.

Immediate next task (RECOMMENDED):

### Dynamic Roll Inputs — Restart Cleanly

Accomplishes:
• Replaces the single free-form roll box with one input per die  
• Preserves the current stable gameplay flow  
• Sets up later conversion from typed inputs to dropdown dice selectors  

Impact:
• UI-only change  
• Must not disturb current die selection, peg selection, destination gating, or multiplayer flow  

Pros:
• Natural next step after current interaction work  
• Supports double-dice and future larger roll counts  
• Can be implemented in two phases:
  - Step 1: dynamic typed per-die inputs
  - Step 2: convert each input to dropdown 1–6 selectors

Cons:
• Today's attempt proved this is easy to destabilize if done too broadly  
• Input-count source must be chosen carefully and validated before broader refactor  

---

Constraint:

• Start from the last known-good App.tsx before today's unstable dynamic-input attempts  
• Do not change peg-first interaction behavior  
• Do not change die-face rendering  
• Do not change moveResult / turn-handling logic  
• Treat dynamic input work as a bounded UI task only  

------------------------------------------------------------------------
