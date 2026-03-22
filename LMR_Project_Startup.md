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

## Last Session Accomplishments

Completed during this session:

• Re-established a known-good App.tsx baseline after multiple unstable iterations

• Isolated and confirmed that the UI is NOT the root cause of the current issue

• Identified the actual failure source:

SERVER TURN CONTRACT INCONSISTENCY

* turn envelope sometimes missing:
  • pendingDice
  • bankedDice
  • awaitingDice

* UI behavior depends on all three being present and consistent

• Confirmed failure pattern:

* expectedRollCount = 2
* pendingDice = []
* bankedDice = 0
* awaitingDice inconsistent or missing

→ leads to:
• disappearing dice
• incorrect move targeting
• UI desynchronization
• “round and round” debugging loop

• Verified that UI fallback logic (effectivePendingDice, expectedRollCount overrides) is compensating for server inconsistency, not causing the issue

• Attempted server-side contract enforcement (computeTurn / enrichServerMessage), but:

* replacement broke server wiring due to incomplete file context
* confirmed need for controlled, in-place modification instead of full overwrite

• Confirmed server runtime still launches correctly after restoration:

WS server running on port 8787
HTTP console running on port 8788

Result:

The system is **functionally working**, but unstable due to inconsistent server turn envelopes.

The root cause is now **clearly identified and localized to wsServer turn construction**.

---

## Current Technical State

Stable baseline (must be preserved):

• App.tsx restored to last known-good checkpoint version 
• wsServer.ts restored to working repository version
• Multiplayer gameplay loop operational:

join → start → roll → select die → select peg → select destination → move → turn advance

Current issue:

• Turn envelope emitted by server is not consistently complete

Required invariant (NOT currently guaranteed):

turn: {
pendingDice: []
bankedDice: number
awaitingDice: boolean
}

Impact of violation:

• UI forced into fallback reconstruction logic
• Dice state becomes ambiguous
• Legal move targeting becomes unreliable

---

## Next Action

### PRIORITY: Fix Server Turn Contract (wsServer.ts)

Objective:

Enforce a **complete, deterministic turn envelope** in all outbound messages.

---

### Task: Normalize turn construction

Accomplishes:
• Guarantees all turn fields always exist
• Eliminates UI ambiguity
• Stabilizes entire turn lifecycle

Impact:
• Server-side change only
• No UI changes required
• Removes need for fallback logic in App.tsx

Pros:
• Fixes root cause
• Aligns with authoritative server model
• Prevents further UI churn

Cons:
• Must be done carefully inside existing server file
• Cannot overwrite server file without preserving wiring

---

### Implementation Constraints

• DO NOT replace entire wsServer.ts blindly
• Modify only turn construction logic
• Preserve:

* handleClientMessage integration
* room/session lifecycle
* connection handling

• Ensure every outbound message includes:

turn.pendingDice
turn.bankedDice
turn.awaitingDice

---

### Restart Instruction (CRITICAL)

At next session start:

1. Confirm baseline:

   * App.tsx = checkpoint version
   * wsServer.ts = repository working version

2. Do NOT modify UI

3. Begin directly with:
   → server turn contract normalization

---

### Explicit Stop Condition

Do NOT return to UI changes until:

• pendingDice
• bankedDice
• awaitingDice

are confirmed stable and consistent across:

* stateSync
* legalMoves
* moveResult

---
