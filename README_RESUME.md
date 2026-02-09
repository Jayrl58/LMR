# LMR Project — README_RESUME

## Snapshot Status
- **Branch:** master
- **State:** GREEN (all tests passing)
- **Scope:** Phase 5 — Turn & Dice lifecycle contract hardening (auto-pass timing, FIFO forfeiture, Team Play per-die delegation)

- **Last Commit:** df38f09 Phase 5: lock turn & dice lifecycle contracts (auto-pass, delegation, explicit no-legal-moves)

> Note: Full-suite test counts can vary as skipped/todo tests change. Treat GREEN status and contract tests as authoritative.

---

## What Was Completed (Latest Session)

### Phase 5: Turn & Dice lifecycle contracts
- Locked and enforced the “temporarily-illegal die” rule (double-dice opening 1+5 scenario).
- Locked and enforced auto-pass timing: auto-pass triggers only when **all** unresolved dice are illegal in the current state.
- Locked and enforced FIFO ordering for forced forfeiture.
- Locked and enforced explicit per-die forfeiture notifications suitable for UI display.

### Phase 5: Team Play (2 teams) — per-die delegation
- Bank ownership remains with the turn owner (`activeActorId`) regardless of who resolves a die.
- Delegation is per-die (not per-roll): different dice can be delegated to different teammates.
- Delegation is immutable until the die resolves.
- Deterministic stale/concurrent arbitration: first valid action wins; later stale actions rejected.

---

## Files Added / Modified (Latest Session)

- **Modified**
  - `src/engine/tryApply.ts` — explicit “no legal moves” reason for temporarily-illegal selection rejection
  - `test/contracts/turnDice.contract.test.ts` — Phase 5 contract test coverage (dice lifecycle + team delegation)

---

## How to Resume Work

### 1) Confirm clean + green
```powershell
git status
npm test
```

### 2) Next snapshot step
- Create **Restart-Complete Snapshot v3.0** (standard contents, no `node_modules`), then update this README and the snapshot manifest if contents change.

### 3) Next subsystem candidate
- UI integration of server-provided die/forfeit signaling and move previews (server-authoritative; UI does not invent rules).
