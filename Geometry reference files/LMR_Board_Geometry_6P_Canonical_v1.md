# LMR Board Geometry — 6-Player Canonical v1

## Canonical artifacts
- **Source of truth (coordinates):** `LMR_Board_Geometry_6P_Canonical_v1.json`
- **Reference render (image):** `LMR_Board_Geometry_6P_Canonical_v1.png`

The JSON file is authoritative. The PNG is a visual reference generated from the same geometry.

## Scope
This canon defines the **6-player board geometry only**:
- Outer track spot coordinates (0–83)
- Center coordinate
- Per-player landmarks (arm start, home corner, home entry, one spot, point)
- Home entry + 4 home spot coordinates per player
- Base spot coordinates per player

## Invariants
- **Arm module size is fixed:** 14 spots per arm (never changes across boards).
- **6-player track length:** 84 spots total (`14 × 6`).
- **Coordinate system (from JSON meta):** units are inches; X increases right; Y increases up; origin is the min-x/min-y of extracted Slide 6 content.

## Constraint intent (what is locked)
This canonical geometry enforces:
- **Uniform neighbor spacing** around the outer track.
- Straight-run intent consistent with the 14-spot arm module:
  - `HOME_CORNER → ONE_SPOT`
  - `ONE_SPOT → POINT`
  - `POINT → next HOME_CORNER`
- **Three opposing home-entry diameter axes** through Center:
  - **0° axis:** Green → Center → Blue (top to bottom)
  - **60° axis:** Brown → Center → Yellow
  - **120° axis:** Orange → Center → Purple
- **Home stacks are collinear** on their home-entry → Center axes.
- **Bases are aligned** parallel to each player’s bottom run and evenly spaced (render-independent).

## Not locked (render-only)
These are explicitly non-canonical and may change without a geometry version bump:
- Dot/spot radius and stroke thickness
- Labeling, fonts, and colors used for diagrams
- Gridlines/axes visibility and any stylistic rendering choices

## Orientation rules
- **Diagrams/examples:** may use a consistent reference orientation (e.g., Blue at 6 o’clock) for clarity.
- **In-game UI:** each player’s view rotates so the local player’s chosen color/arm is at the bottom (6 o’clock). Geometry is shared; viewpoint is per-client.

## Versioning rule
- Increment geometry version (v1 → v2) **only** when the coordinate source of truth changes (the JSON changes).
- PNG-only styling changes do **not** bump geometry version unless they reflect coordinate changes.

