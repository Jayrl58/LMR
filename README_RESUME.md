# LMR Project — Resume & Working Contract

## Snapshot Resume (2026-01-27)

This snapshot captures a **server messaging milestone** in the LMR project.

### What Is Locked and Verified

- **Rules Authority** remains locked (v1.7.3).  
  No gameplay rule changes are introduced in this snapshot.
- **Engine dice lifecycle** is verified and GREEN:
  - Double-dice resolution
  - Pending dice preservation
  - `awaitingDice` invariants
- **Server messaging contract** is fixed and locked:
  - `moveResult.response.turn` is now consistent with engine-derived turn state
  - Pending dice cannot be silently dropped
- A **server-level regression test** enforces this contract.

### What This Snapshot Is *Not*

- Not a UI polish snapshot
- Not an HTTP console snapshot
- Not a rules or geometry change

The HTTP debug console may diverge visually and is **non-authoritative**.

### How to Resume From This Snapshot

1. Start the server (`npm run dev:server`)
2. Prefer **WS-level tools** (`wsClient.ts`) for authoritative inspection
3. Trust engine + tests as canonical for dice lifecycle behavior

### Recommended Next Focus

- UI reconciliation against `stateSync.turn`, **or**
- Proceed with additional engine features (e.g., kill-roll UX, banking UX)

---

## Working Mode (Unchanged)

- Be brief by default
- Full file replacement only
- One step at a time
- Engine and tests are authoritative
- UI is secondary unless explicitly promoted

**End of README_RESUME**
