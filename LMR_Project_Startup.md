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

• Geometry verification sandbox implemented  
• Board geometry calibrated for 4-player, 6-player, and 8-player boards  
• Geometry authority consolidated into shared source  
• Sandbox renderer and gameplay renderer referencing same geometry definitions  
• Initial BoardRenderer component implemented  
• Renderer verified across all board sizes

Result:

Board geometry model and renderer foundation validated and ready for
gameplay board integration.

------------------------------------------------------------------------

## Next Action

Begin gameplay board renderer integration using the verified
BoardRenderer component and the shared geometry authority.

Initial objective:

Render the canonical board layout using the calibrated geometry
parameters and confirm correct peg and hole placement for all supported
board sizes.