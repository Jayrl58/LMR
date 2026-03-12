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

• Replaced demo-only UI flow with a live WebSocket-connected graphical
  debug client
• Verified board rendering from live server state rather than demo data
• Verified end-to-end interaction loop inside the graphical UI:

connect
joinRoom
startGame
roll
legalMoves
move
moveResult

• Added bounded debug-console controls to App.tsx for:
  - Connect / Disconnect
  - Join Room / Leave Room
  - Start Game
  - Reset Game
  - Roll
  - Get Legal Moves
• Added state-driven display for:
  - Current Actor
  - Awaiting Dice
  - Pending Dice
  - Banked Dice
• Added legal-move buttons for direct move execution
• Added pending-die selection buttons so individual pending dice can be
  inspected intentionally
• Added multi-die input support for roll/getLegalMoves/move payloads
• Refactored App.tsx into message-router style handlers for server
  messages
• Resolved compile issues in mapPositionToBoardHole.ts and stabilized
  the current debug UI build

Result:

The graphical UI now functions as a bounded debug client capable of
joining a room, starting a game, rolling, requesting legal moves,
submitting moves, and rendering live peg movement from the authoritative
server.

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
• Click legal move buttons to submit moves
• View Current Actor / Pending Dice / Banked Dice
• Inspect pending dice individually

Current known limitation:

The debug UI still makes it too easy to reconnect into a previously used
active room, which can make the client appear to resume mid-game instead
of starting from a clean test state.

------------------------------------------------------------------------

## Next Action

Refine debug UI room/session lifecycle behavior.

Objective:

Prevent accidental reconnection into stale active room state and make
fresh-room startup behavior explicit and reliable.

Immediate next task:

Update the graphical debug client so room handling is cleaner and less
error-prone, then re-verify the fresh-room startup flow using a newly
created lobby room.

Initial focus:

• Prevent accidental reuse of stale room state
• Clarify room lifecycle controls in the debug client
• Re-verify clean new-room start flow
• Preserve current working gameplay loop while refining the UX