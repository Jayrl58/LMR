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

• Stabilized UI interaction model for multi-die scenarios  

• Eliminated implicit die selection behavior  

• Implemented strict die-selection gating:

  - No legal move preview when multiple dice exist and none selected  
  - No peg interaction allowed without selected die  
  - No fallback to “first die”  

• Fixed stale selectedDie persistence across state transitions  

• Ensured legalMoves are only displayed when:

  - Exactly one die exists, OR  
  - A die is explicitly selected  

• Verified correct behavior:

  - Multi-die roll → neutral board  
  - Selecting a die → correct move preview  
  - Peg click without die → explicit instruction message  

• Restored stable App.tsx baseline using last known-good commit  

Result:

The UI interaction model is now deterministic, rule-aligned, and free of
implicit or hidden state behavior.

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
• No visual move affordance layer currently active  

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
• M7 — Gameplay Interaction Layer ready to begin  

------------------------------------------------------------------------

## Next Action

Begin M7 — Gameplay Interaction Layer.

Objective:

Introduce a clear, intuitive, and unambiguous visual interaction model
for move selection that replaces debug-driven workflows.

Immediate next task:

Implement **peg-based affordance signaling using directional arrows**.

Initial focus:

• Identify pegs with legal moves (based on selected die)  
• Render directional arrows originating from those pegs  
• Arrows indicate “this peg can move”  
• Do NOT use rings, outlines, or color-only differentiation  
• Keep board readable and uncluttered  

Constraints:

• No visual output when multiple dice exist and no die is selected  
• Arrows must be subtle and not overwhelm board readability  
• Must map directly to legalMoves (no derived/guessed state)  
• Must not introduce ambiguity between peg selection and destination  

Next session should begin by:

1. Defining arrow rendering contract (source, direction, size)  
2. Mapping legalMoves → movable pegs  
3. Rendering minimal arrow indicators on those pegs only  
4. Verifying clarity before adding destination-level visuals  

------------------------------------------------------------------------