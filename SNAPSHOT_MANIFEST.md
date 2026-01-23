# LMR Server Snapshot Manifest

## Snapshot

- Date: 2026-01-20
- Source folder: `C:\Users\jayrl\OneDrive\Documents\My Games\Aggravation\LMR Playpen`
- ZIP name: `LMR_SNAPSHOT_2026-01-20_SERVER_ENGINE_GREEN_v0.2.5_FULL.zip`

## What this snapshot is

- Restart-safe backup of the LMR server + engine project (excluding `node_modules`).
- Captures: engine/server source, tests (scenario + contract hardening), and current authoritative rules docs.

## Snapshot status

- Test status: **GREEN** (`npm test` passed)
- Notes:
  - `git` is not installed/available in this environment (PowerShell reports command not found).
  - `_probe.centerShapes.test.ts` is intentionally absent (removed); do not expect it.

---

## Included (expected)

### Root / Docs
- `README_RESUME.md`
- `SNAPSHOT_MANIFEST.md`
- `TEST_COVERAGE.md` (or equivalent test coverage declaration doc)
- `LMR_Rules_Authority_v1.7.1.md`
- `LMR_RULES_ANCHOR_v1.7.1.md`

### Source
- `src/engine/**`
- `src/server/**`
- (If present) `src/ui/**` (source only; build output optional)

### Tests
- `test/**` including:
  - Scenario tests (rules validation)
  - Contract tests (API/shape stability and invariants)

---

## Key changes captured by this snapshot (2026-01-20)

### Rules
- Updated center rules wording to: **Center exit may go to any Point** (including unowned Points on a 4p board when playing 2p), excluding Points occupied by the moving player’s own peg.
- Clarified capture on Center exit: **exiting to a Point kills any other player’s peg on that Point** (not just opponents).
- Anchors updated to v1.7.1 to match rules text.

### Scenario coverage added/updated
- Center exit destinations and exclusions (v1.7.1)
- Center exit **not forced** when other legal moves exist
- Entry blocking + forced entry behaviors (roll=1)
- Entry on six scenarios (forced-entry cases on roll=6)
- Home exact-count behavior and related home-entry scenarios
- Home-entry “not forced” scenarios when other moves exist
- Home-entry landing capture consistency test (as allowed by rules: opponents cannot be in your home; any cross-home occupancy used in tests is an artificial capture-consistency probe)

### Contract hardening added/updated
- `tryApplyMoveWithResponse()` envelope stability:
  - ok=true includes `result.nextState`, `result.afterHash`, `result.replayEntry`, and `turn`
  - ok=false includes stable `error` and stable `turn` envelope
- `legalMoves()` contract: shape/invariants and stable filtering expectations
- Turn/dice semantics contract (`turnDice.contract.test.ts`):
  - verifies `turn` presence and minimal shape across ok=true/ok=false
  - verifies nextActorId validity on success paths

---

## Excluded (expected)

- `node_modules/`
- OS/editor temp files: `.DS_Store`, `Thumbs.db`, etc.
- Large build artifacts unless explicitly intended:
  - `dist/`, `build/`, `dist-ui/` (include only if you intentionally left them in the folder)

---

## Quick verification checklist (manual)

Before zipping:
- [ ] `npm test` is GREEN (already confirmed today)
- [ ] Rules docs present: `LMR_Rules_Authority_v1.7.1.md`, `LMR_RULES_ANCHOR_v1.7.1.md`
- [ ] Updated tests present under `test/` (scenario + contract)
- [ ] No `node_modules/` in the zip

ZIP naming:
- [ ] `LMR_SNAPSHOT_2026-01-20_SERVER_ENGINE_GREEN_v0.2.5_FULL.zip`
