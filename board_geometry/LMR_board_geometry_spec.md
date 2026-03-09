# LMR Board Geometry Specification

Status: Provisional canonical geometry baseline
Date locked: 2026-03-09

This file preserves the numeric board geometry decisions established in the
2026-03-09 geometry session.

---

## 1) Canonical Arm Module Coordinates

The arm module is identical for all supported board sizes.

Coordinate system for the canonical arm module:

- `T6` is the origin `(0, 0)`
- Positive Y points from `T6` toward the center through the home column
- Positive X points from `T6` toward `T5` and `T4`
- Negative X points from `T6` toward `T7` and `T8`

### Track and Home Coordinates

| Spot | X | Y |
|---|---:|---:|
| T13 | -2 | 5 |
| T12 | -2 | 4 |
| T11 | -2 | 3 |
| T10 | -2 | 2 |
| T9  | -2 | 1 |
| T8  | -2 | 0 |
| T7  | -1 | 0 |
| T6  | 0  | 0 |
| T5  | 1  | 0 |
| T4  | 2  | 0 |
| T3  | 2  | 1 |
| T2  | 2  | 2 |
| T1  | 2  | 3 |
| T0  | 2  | 4 |
| H0  | 0  | 1 |
| H1  | 0  | 2 |
| H2  | 0  | 3 |
| H3  | 0  | 4 |

### Canonical Arm Invariants

- Home column is `T6 -> H0 -> H1 -> H2 -> H3 -> CENTER`
- `T4 -> T5 -> T6 -> T7 -> T8` is perpendicular to the home column
- Left branch is `T8 -> T9 -> T10 -> T11 -> T12 -> T13`
- Right branch is `T4 -> T3 -> T2 -> T1 -> T0`

---

## 2) Player Orientation Rule

Reference diagrams use this orientation rule:

- Player numbering proceeds clockwise
- `P0` is at the bottom / south of the board
- The player home column always points directly toward the center

---

## 3) Track Continuity Rule

Perimeter continuity rule for all board sizes:

`Pi T13 -> P(i+1) T0`

wrapping from the last player back to `P0`.

Examples:

### 4-player
- `P0 T13 -> P1 T0`
- `P1 T13 -> P2 T0`
- `P2 T13 -> P3 T0`
- `P3 T13 -> P0 T0`

### 6-player
- `P0 T13 -> P1 T0`
- `P1 T13 -> P2 T0`
- `P2 T13 -> P3 T0`
- `P3 T13 -> P4 T0`
- `P4 T13 -> P5 T0`
- `P5 T13 -> P0 T0`

### 8-player
- `P0 T13 -> P1 T0`
- `P1 T13 -> P2 T0`
- `P2 T13 -> P3 T0`
- `P3 T13 -> P4 T0`
- `P4 T13 -> P5 T0`
- `P5 T13 -> P6 T0`
- `P6 T13 -> P7 T0`
- `P7 T13 -> P0 T0`

---

## 4) 4-Player Board Geometry Baseline

Status: Locked visual baseline

Reference file:
- `LMR_board_reference_4p.png`

Board construction notes:

- Four arms
- Arm spacing: `90 degrees`
- Orthogonal board layout accepted as correct
- Home columns point directly toward center

Landmark rendering reference:
- `T8` = 1-spot
- `T13` = Point
- `H0-H3` = Home spots

---

## 5) 6-Player Board Geometry Baseline

Status: Locked geometry baseline

Reference file:
- `LMR_board_reference_6p.png`

Board construction notes:

- Six arms
- Arm spacing: `60 degrees`
- Home columns radial to center
- Provisional accepted construction parameters:
  - `T6 radius ~= 9.0`
  - symmetric branch swing `~= 2.5 degrees`
- Geometry accepted visually as close enough to lock

Landmark rendering reference:
- `T8` = 1-spot
- `T13` = Point
- `H0-H3` = Home spots

---

## 6) 8-Player Board Geometry Baseline

Status: Locked geometry baseline

Reference file:
- `LMR_board_reference_8p.png`

Board construction notes:

- Eight arms
- Arm spacing: `45 degrees`
- Home columns radial to center
- Provisional accepted construction parameters:
  - `T6 radius ~= 10.6`
  - symmetric branch swing `~= 4.0 degrees`
- Geometry accepted visually as close enough to lock

Landmark rendering reference:
- `T8` = 1-spot
- `T13` = Point
- `H0-H3` = Home spots

---

## 7) Authority Rule

These numeric and visual geometry baselines are now the project working
authority for board layout.

Future revisions must not change these values or the reference diagrams unless
the user explicitly reopens board geometry and approves a replacement baseline.
