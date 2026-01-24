# LMR SNAPSHOT MANIFEST

Snapshot: **LMR_SNAPSHOT_2026-01-23_SERVER_ENGINE_DOUBLE_DICE_GREEN_v0.2.8_FULL**

## Purpose
This snapshot is a **restart-safe, green-state reference** capturing the LMR server engine and debug HTTP console at a stable point, with Double Dice fully exercised and verified.

This snapshot is intended to allow a future session (or a new chat) to resume work **without re-deriving rules, contracts, or engine behavior**.

---

## Snapshot Status
- **ENGINE:** GREEN (all tests passing)
- **SERVER:** Stable (WS + HTTP console)
- **RULES AUTHORITY:** Locked (no changes in this snapshot)
- **DOUBLE DICE:** Implemented and verified
- **TEAM PLAY:** Present, not the focus of this snapshot

---

## Included Components

### Core Engine
- `src/engine/**`
- Turn, move resolution, dice lifecycle
- Double Dice contract enforced (exactly one die resolved per move)

### Server
- `src/server/wsServer.ts`
- `src/server/devServer.ts`
- `src/server/httpConsole.ts`

### Debug HTTP Console
Current console characteristics:
- Debug-only (not a production UI)
- Stable pending dice list
- One-die-per-move enforcement
- Auto-fetch legal moves for remaining die after a successful move
- Start button always visible
- Ready buttons always visible; disabled when auto-ready is ON

### Tests
- All unit, integration, scenario, and contract tests
- Double Dice lifecycle tests passing

---

## Explicit Exclusions
- Production UI
- Visual board rendering
- Animations
- Polished UX decisions (debug console only)

---

## Known Limitations / Deferred Items
- Ready / Start UX polish (debug console acceptable for now)
- Die forfeiture visual treatment (design agreed, not implemented)
- Greyed-out dice with zero legal moves (planned)

---

## Resume Guarantee
With this snapshot, a new session should:
1. Run `npm install` (if needed)
2. Run `npm test` → GREEN
3. Run `npm run dev:server`
4. Open `http://localhost:8788`

No rules or engine reinterpretation should be required.

