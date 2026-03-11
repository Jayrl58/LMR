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

• UI render pipeline successfully integrated
• BoardRenderer now renders peg placements derived from real GameState
• Verified mapping pipeline:

GameState
→ mapGameStateToUI
→ mapPositionToBoardHole
→ BoardRenderer

• Demo UI message feed isolated into `makeDemoUiState.ts`
• `App.tsx` reduced to renderer composition layer
• Offline UI simulator updated to current `UiController` API
• Node type definitions installed to stabilize TypeScript compilation

Result:

The graphical board UI now renders peg positions derived from the real
engine state pipeline. The UI architecture is prepared for future
WebSocket-driven state updates.

------------------------------------------------------------------------

## Current Technical State

Operational rendering pipeline:

GameState
→ mapGameStateToUI
→ mapPositionToBoardHole
→ BoardRenderer

Current UI structure:

App.tsx
→ makeDemoUiState.ts
→ BoardRenderer

Demo messages currently simulate server events through the
`UiController`.

This structure intentionally mirrors the future architecture where
WebSocket messages will drive the same controller.

------------------------------------------------------------------------

## Next Action

Replace the demo UI state generator with a live WebSocket message feed.

Objective:

Connect the UI layer to the running server so that incoming server
messages drive the `UiController` directly.

Target architecture:

WebSocket
→ UiController.applyServerMessage()
→ UI state update
→ BoardRenderer

Initial task:

Implement a WebSocket connection in the UI client that receives server
messages and forwards them to the `UiController` message handler.