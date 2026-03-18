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

This file contains:

• BOARD_GEOMETRY calibration constants  
• CANONICAL_ARM grid definition for the 14-spot arm module  
• TRACK_LOOP_ORDER traversal authority  

Both the sandbox renderer and gameplay renderer reference this shared
geometry authority.

------------------------------------------------------------------------

## Last Session Accomplishments

Completed during the previous session:

• Implemented M7 arrow affordance system  

• Built arrow indicator pipeline:

  - legalMoves → getArrowIndicators → App.tsx → BoardRenderer  

• Replaced direction-based arrows with geometry-based arrows:

  - fromHole → toHole  
  - direction derived in renderer from screen positions  

• Enabled multiple arrows per peg:

  - one arrow per legal move  
  - resolves point-with-1 and center-with-1 ambiguity  

• Fixed arrow gating:

  - no longer dependent on awaitingDice  
  - driven directly by legalMoveOptions  

• Preserved multi-die interaction rules:

  - no arrows when multiple dice exist and none selected  

• Resolved renderer issues:

  - fixed missing prop wiring in App.tsx  
  - resolved data-shape mismatch (direction → from/to)  
  - eliminated duplicate React keys  

• Verified behavior:

  - arrows appear only when legal moves exist  
  - multiple arrows render correctly per peg  
  - arrow direction matches board geometry  
  - destination click model unchanged  

Result:

M7 arrow affordance system is operational, stable, and aligned with
rules and board geometry.

------------------------------------------------------------------------

## Current Technical State

Operational live UI pipeline:

WebSocket  
→ App.tsx message handlers  
→ state mapping  
→ mapGameStateToUI  
→ mapPositionToBoardHole  
→ BoardRenderer  

Current graphical debug UI capabilities:

• Connect / Disconnect  
• Join Room / Leave Room  
• Start Game  
• Reset Game  
• Roll  
• Get Legal Moves  
• Pending die selection (explicit)  
• View Current Actor / Pending Dice / Banked Dice  

Renderer status:

• Board geometry validated for 4P / 6P / 8P  
• Peg rendering stable  
• Arm ownership coloring stable  
• Base and home highlighting implemented  
• Arrow affordance layer implemented (multi-arrow, directional)  

Rules / engine validation completed:

• Board-size–aware track normalization  
• Center entry behavior  
• Center exit generation for 8-player boards  
• Own-peg blocking on center exits  
• Finished peg immobility in home area  
• Multiplayer initialization and sequencing  
• Full double-dice lifecycle with bank behavior  

Milestone state:

• M6 — Graphical Board UI complete  
• M7 — Gameplay Interaction Layer in progress (arrow layer complete)  

------------------------------------------------------------------------

## Next Action

Continue M7 — Gameplay Interaction Layer.

Objective:

Refine and complete the gameplay interaction experience now that the
arrow affordance system is operational.

Immediate next task (choose one direction):

Option A — Arrow Visual Refinement  
• Improve spacing when multiple arrows originate from same peg  
• Adjust arrow length / thickness for readability  
• Add subtle fade or layering rules to reduce clutter  

Option B — Destination Highlight Alignment  
• Ensure destination highlights and arrows are visually coordinated  
• Validate that all arrow endpoints correspond to clickable targets  
• Improve clarity in dense move scenarios  

Option C — Interaction Feedback Polish  
• Add hover or focus feedback tied to arrows and pegs  
• Improve clarity of selected die state on board  
• Reduce reliance on debug panel for understanding state  

Constraint:

• Do not change rules authority or move generation  
• Do not introduce clickable arrows  
• Maintain strict multi-die gating model  

Next session should begin by selecting one refinement path and executing
a single focused improvement.

------------------------------------------------------------------------
