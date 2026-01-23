# LMR Project Resume

## Snapshot Identity

- Snapshot name: LMR_SNAPSHOT_2026-01-20_SERVER_ENGINE_GREEN_v0.2.5_FULL
- Rules authority: LMR_Rules_Authority_v1.7.1.md
- Engine status: GREEN (full test suite passing)

---

## Purpose

This ZIP is a restart-safe snapshot of the LMR server/engine project.

Extracting this archive and following the steps below will return the project
to the exact state it was in when this snapshot was created.

There are no hidden or implied steps.

---

## Included

- TypeScript engine and server source
- All scenario tests and contract tests
- Canonical rules and rules anchor
- Test coverage declaration
- Restart-safe project structure

---

## Not Included

- node_modules
- UI build output
- Deprecated or probe tests (e.g. _probe.*)

---

## Requirements

- Node.js v20.x (or compatible)
- npm (bundled with Node)

---

## Resume Steps

### Step 1: Install dependencies

From the project root:

npm install

---

### Step 2: Verify snapshot (mandatory)

Run the full test suite:

npm test

Expected result:
- All tests pass
- If tests fail, the snapshot is not valid

Stop here unless you explicitly want to run the server.

---

### Step 3 (Optional): Run the dev server

Only if you want to manually exercise the engine:

npm run dev:server

---

### Step 4 (Optional): Run ws text client

Only if you want an end-to-end smoke test:

npm run ws:client

This step is not required to validate the snapshot.

---

## Project State at This Snapshot

- Rules v1.7.1 are locked and test-enforced
- Center rules, entry rules, and forced-move rules verified
- Contract coverage exists for:
  - tryApplyMoveWithResponse
  - legalMoves
  - turn and dice semantics
- Engine/server boundary is stable

This snapshot is suitable as a baseline for UI integration and replay tooling.

---

## How to Resume in a New Chat

Resume from:
LMR_SNAPSHOT_2026-01-20_SERVER_ENGINE_GREEN_v0.2.5_FULL

Notes for the assistant:
- Tests are green
- Rules authority is v1.7.1
- No patches — full file replacements only
- Work step by step and wait for confirmation between steps

---

## Working Rules

- No patches; full file replacements only
- One step at a time
- Always state exact commands to run
- Do not assume optional steps are required
