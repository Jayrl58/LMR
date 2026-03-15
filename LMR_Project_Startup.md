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

• Corrected center-hole rendering so the center hole visually matches
  normal track holes

• Fixed peg rendering logic so a peg located in the center position
  appears correctly in the board renderer

• Verified correct graphical rendering for:

  - 4-player board
  - 6-player board
  - 8-player board

• Corrected board-size handling in the engine by replacing fixed
  TRACK_LENGTH assumptions with board-size–aware normalization using the
  14-spot arm module

• Implemented board-length–aware track normalization for 4, 6, and
  8-player boards

• Corrected center exit generation so a peg in the center can exit to
  every valid Point on the board

• Verified correct center-exit behavior on an 8-player board:

  13
  27
  41
  55
  69
  83
  97
  111

• Verified that center exits are correctly removed when those points are
  occupied by the player's own pegs

• Verified that pegs occupying their highest Home spot produce no legal
  moves

• Identified and corrected a startGame initialization defect where
  games with playerCount > 2 were starting with only two active players

• startGame now constructs a fresh engine state using makeState()
  rather than mutating a development state

• Verified correct player creation for multiplayer games:

  p0 → p1 → p2 → p3 → p4 → p5

• Verified correct turn progression across the full roster:

  p0 → p1 → p2 → p3 → p4 → p5 → p0

• Verified gameplay mechanics during validation:

  - Base entry on rolls 1 and 6
  - Normal track movement
  - Kill mechanics
  - UI rendering synchronized with authoritative server state

Result:

The graphical debug UI renders correctly for all supported board sizes,
the server engine correctly initializes multiplayer games, and the full
roll → move gameplay loop operates correctly across multiple players.

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

Rules / engine validation completed:

• Board-size–aware track normalization
• Center entry behavior
• Center exit generation for 8-player boards
• Own-peg blocking on center exits
• Finished peg immobility in home area
• Multiplayer start-state initialization
• Multiplayer turn sequencing

Milestone state:

• M6 — Graphical Board UI complete
• M7 — Gameplay Interaction Layer not yet started

------------------------------------------------------------------------

## Next Action

Begin M7 — Gameplay Interaction Layer.

Objective:

Transition from bounded debug-console interaction toward a more natural
gameplay interaction model built on top of the validated graphical board
UI and authoritative server engine.

Immediate next task:

Define and implement the first M7 interaction slice by replacing or
reducing debug-only controls in favor of gameplay-oriented interaction
flow, then verify the resulting turn interaction remains consistent with
the authoritative engine contract.

Initial focus:

• Decide the first M7 interaction slice to implement
• Reduce dependence on debug-only control flow where practical
• Preserve the validated roll → legalMoves → move → moveResult loop
• Keep the graphical board and rules engine behavior aligned during the
  transition