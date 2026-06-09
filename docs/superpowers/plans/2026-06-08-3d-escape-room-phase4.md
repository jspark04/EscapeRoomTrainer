# 3D Escape Room — Phase 4 Implementation Plan (Procedural Geometry)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Vary the room's furniture placement each playthrough — desk/bookshelf in different spots, the safe and door on different walls — while guaranteeing every layout is non-overlapping, in-bounds, and navigable (every station + the door reachable).

**Architecture:** A pure, deterministic `generateLayout(seed)` produces anchor transforms (position + rotation + collision box) for `desk`/`bookshelf`/`safe`/`door` plus a clear `playerStart`, using a constrained scheme (floor items in disjoint quadrants, wall items on distinct walls facing inward) so non-overlap and reachability hold by construction. A rigorous `validateLayout` re-checks the invariants (this is the safety net, since live movement can't be auto-tested). `EscapeRoom` threads the generated layout through furniture transforms, collision boxes, interactables, and the player start. The fixed `ANCHORS` constant is removed.

**Tech Stack:** Same as prior phases (Vite + React 19 + TS, R3F, Vitest).

**Spec:** `docs/superpowers/specs/2026-06-08-3d-escape-room-design.md` (Phase 4 / "level-3" dynamism).

---

### Task 1: `generateLayout` + `validateLayout` (pure, deterministic)

**Files:**
- Create: `src/escape/scene/layout.ts`, `src/escape/scene/layout.test.ts`

- [ ] **Step 1: Write the failing test `src/escape/scene/layout.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateLayout, validateLayout, ROOM_HALF_FOR_LAYOUT } from './layout';
import type { AABB } from './physics';

function overlaps(a: AABB, b: AABB, gap = 0): boolean {
  return (
    a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minZ - gap < b.maxZ && a.maxZ + gap > b.minZ
  );
}

describe('generateLayout', () => {
  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(generateLayout(42))).toBe(JSON.stringify(generateLayout(42)));
  });

  it('always produces the four anchors + a player start', () => {
    const l = generateLayout(3);
    expect(Object.keys(l.anchors).sort()).toEqual(['bookshelf', 'desk', 'door', 'safe']);
    expect(l.playerStart).toHaveLength(3);
  });

  it('passes validateLayout for many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = validateLayout(generateLayout(seed), ROOM_HALF_FOR_LAYOUT);
      expect(r.ok, `seed ${seed}: ${r.violations.join('; ')}`).toBe(true);
    }
  });

  it('keeps furniture boxes non-overlapping across seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = generateLayout(seed).anchors;
      const ids = Object.keys(a);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          expect(overlaps(a[ids[i]].box, a[ids[j]].box), `seed ${seed}: ${ids[i]}/${ids[j]}`).toBe(false);
        }
      }
    }
  });

  it('puts the safe and the door on different walls and varies placement', () => {
    const safeXZ = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const l = generateLayout(seed);
      // safe & door should not occupy the same wall position
      expect(`${l.anchors.safe.pos[0]},${l.anchors.safe.pos[2]}`).not.toBe(
        `${l.anchors.door.pos[0]},${l.anchors.door.pos[2]}`,
      );
      safeXZ.add(`${l.anchors.safe.pos[0].toFixed(1)},${l.anchors.safe.pos[2].toFixed(1)}`);
    }
    expect(safeXZ.size).toBeGreaterThan(2); // placement genuinely varies
  });
});

describe('validateLayout', () => {
  it('rejects a layout with overlapping furniture', () => {
    const l = generateLayout(1);
    const bad = {
      ...l,
      anchors: { ...l.anchors, bookshelf: { ...l.anchors.bookshelf, box: l.anchors.desk.box } },
    };
    expect(validateLayout(bad, ROOM_HALF_FOR_LAYOUT).ok).toBe(false);
  });

  it('rejects a box outside the room', () => {
    const l = generateLayout(1);
    const bad = {
      ...l,
      anchors: { ...l.anchors, desk: { ...l.anchors.desk, box: { minX: 90, maxX: 92, minZ: 0, maxZ: 1 } } },
    };
    expect(validateLayout(bad, ROOM_HALF_FOR_LAYOUT).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/scene/layout.test.ts`
Expected: FAIL — cannot find module './layout'.

- [ ] **Step 3: Write `src/escape/scene/layout.ts`**

```ts
import type { AABB } from './physics';
import { mulberry32, shuffle } from '../../rng';

// The room is a fixed square; geometry varies WITHIN it. Mirrors Room's ROOM_HALF (5).
export const ROOM_HALF_FOR_LAYOUT = 5;

export interface Anchor {
  pos: [number, number, number];
  rotation: [number, number, number];
  box: AABB;
}
export interface Layout {
  anchors: Record<string, Anchor>;
  playerStart: [number, number, number];
}

type Wall = 'north' | 'south' | 'east' | 'west';
const WALLS: Wall[] = ['north', 'south', 'east', 'west'];

// Four disjoint interior quadrant centers for floor furniture (kept away from the room
// center so the player always has clear central space and approach room).
const QUADRANTS: Array<{ cx: number; cz: number }> = [
  { cx: -2.6, cz: -2.6 },
  { cx: 2.6, cz: -2.6 },
  { cx: -2.6, cz: 2.6 },
  { cx: 2.6, cz: 2.6 },
];

const HALF_W = 0.9; // furniture footprint half-width (x)
const HALF_D = 0.6; // furniture footprint half-depth (z)

function floorAnchor(cx: number, cz: number): Anchor {
  return {
    pos: [cx, 0, cz],
    rotation: [0, 0, 0],
    box: { minX: cx - HALF_W, maxX: cx + HALF_W, minZ: cz - HALF_D, maxZ: cz + HALF_D },
  };
}

// A wall-mounted anchor (safe at y=1.5, door at y=0), facing inward, at offset `along` the wall.
function wallAnchor(wall: Wall, along: number, y: number): Anchor {
  const inset = 0.1;
  const t = 0.6; // half-thickness of the wall item's collision box
  switch (wall) {
    case 'north':
      return { pos: [along, y, -ROOM_HALF_FOR_LAYOUT + inset], rotation: [0, 0, 0], box: { minX: along - 0.75, maxX: along + 0.75, minZ: -ROOM_HALF_FOR_LAYOUT, maxZ: -ROOM_HALF_FOR_LAYOUT + t } };
    case 'south':
      return { pos: [along, y, ROOM_HALF_FOR_LAYOUT - inset], rotation: [0, Math.PI, 0], box: { minX: along - 0.75, maxX: along + 0.75, minZ: ROOM_HALF_FOR_LAYOUT - t, maxZ: ROOM_HALF_FOR_LAYOUT } };
    case 'east':
      return { pos: [ROOM_HALF_FOR_LAYOUT - inset, y, along], rotation: [0, -Math.PI / 2, 0], box: { minX: ROOM_HALF_FOR_LAYOUT - t, maxX: ROOM_HALF_FOR_LAYOUT, minZ: along - 0.75, maxZ: along + 0.75 } };
    case 'west':
      return { pos: [-ROOM_HALF_FOR_LAYOUT + inset, y, along], rotation: [0, Math.PI / 2, 0], box: { minX: -ROOM_HALF_FOR_LAYOUT, maxX: -ROOM_HALF_FOR_LAYOUT + t, minZ: along - 0.75, maxZ: along + 0.75 } };
  }
}

export function generateLayout(seed: number): Layout {
  const rng = mulberry32(seed);

  // Two distinct walls for the wall items; safe and door each get a small "along" jitter.
  const [safeWall, doorWall] = shuffle(rng, WALLS).slice(0, 2);
  const jitter = () => Math.round((rng() * 4 - 2) * 10) / 10; // [-2, 2]
  const safe = wallAnchor(safeWall, jitter(), 1.5);
  const door = wallAnchor(doorWall, jitter(), 0);

  // Two distinct quadrants for the floor items.
  const [qA, qB] = shuffle(rng, QUADRANTS).slice(0, 2);
  const desk = floorAnchor(qA.cx, qA.cz);
  const bookshelf = floorAnchor(qB.cx, qB.cz);

  return {
    anchors: { desk, bookshelf, safe, door },
    playerStart: [0, 1.6, 0], // room center is always clear (furniture lives in quadrants/walls)
  };
}

export interface LayoutValidation {
  ok: boolean;
  violations: string[];
}

const APPROACH = 1.2; // how far in front of an item the player stands to interact
const PLAYER_R = 0.35;

function boxesOverlap(a: AABB, b: AABB, gap: number): boolean {
  return a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minZ - gap < b.maxZ && a.maxZ + gap > b.minZ;
}
function pointInBox(x: number, z: number, b: AABB, pad: number): boolean {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
}

export function validateLayout(layout: Layout, half: number): LayoutValidation {
  const violations: string[] = [];
  const entries = Object.entries(layout.anchors);

  for (const [id, a] of entries) {
    if (a.box.minX < -half || a.box.maxX > half || a.box.minZ < -half || a.box.maxZ > half) {
      violations.push(`anchor "${id}" box is outside the room`);
    }
  }
  // Pairwise non-overlap (raw boxes must not intersect).
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (boxesOverlap(entries[i][1].box, entries[j][1].box, 0)) {
        violations.push(`anchors "${entries[i][0]}" and "${entries[j][0]}" overlap`);
      }
    }
  }
  // Player start must be clear.
  const [psx, , psz] = layout.playerStart;
  for (const [id, a] of entries) {
    if (pointInBox(psx, psz, a.box, PLAYER_R)) violations.push(`player start is inside "${id}"`);
  }
  // Each item must have a clear approach point toward the room center, inside the room and
  // not inside another item's box (so the player can stand there to interact).
  for (const [id, a] of entries) {
    const cx = (a.box.minX + a.box.maxX) / 2;
    const cz = (a.box.minZ + a.box.maxZ) / 2;
    const len = Math.hypot(cx, cz) || 1;
    const ax = cx - (cx / len) * APPROACH;
    const az = cz - (cz / len) * APPROACH;
    if (ax < -half + PLAYER_R || ax > half - PLAYER_R || az < -half + PLAYER_R || az > half - PLAYER_R) {
      violations.push(`approach point for "${id}" is out of bounds`);
    }
    for (const [oid, b] of entries) {
      if (oid !== id && pointInBox(ax, az, b.box, PLAYER_R)) {
        violations.push(`approach point for "${id}" is blocked by "${oid}"`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/scene/layout.test.ts`
Expected: PASS. If a seed fails `validateLayout` (e.g., a quadrant item's approach point collides with a wall item near a corner), tighten the scheme — reduce `jitter()` range or pull `QUADRANTS` centers slightly inward — until all 200 seeds pass. (The chosen constants are intended to pass; adjust only if a violation appears.)

- [ ] **Step 5: Commit**

```bash
git add src/escape/scene/layout.ts src/escape/scene/layout.test.ts
git commit -m "feat(escape): deterministic procedural room layout + navigability validator"
```

---

### Task 2: Use the generated layout in `EscapeRoom`

**Files:**
- Modify: `src/escape/EscapeRoom.tsx`, `src/escape/scene/furniture/ExitDoor.tsx` (accept a `rotation` prop)

- [ ] **Step 1: Read the current `src/escape/EscapeRoom.tsx` and `src/escape/scene/furniture/ExitDoor.tsx`** to ground the edits.

- [ ] **Step 2: Make `ExitDoor` accept a rotation** so it can sit flush on any wall

`ExitDoor` currently takes `position` + `open`. Add an optional `rotation?: [number, number, number]` and apply it to the root group (matching how `SafeAndPainting` already takes a `rotation`). Keep the existing geometry/open animation.

- [ ] **Step 3: Replace the fixed `ANCHORS` with a per-build generated layout in `EscapeRoom.tsx`**

- Remove the module-level `const ANCHORS = {...}` and the module-level `FURNITURE_BOXES` / `INTERACTABLES` derived from it. (Import `generateLayout` from `./scene/layout`.)
- Inside the component, derive the layout from the same nonce that drives the build:
```tsx
const layout = useMemo(() => generateLayout(SEED_BASE + seedNonce), [seedNonce]);
const furnitureBoxes = useMemo(() => Object.values(layout.anchors).map((a) => a.box), [layout]);
const interactables = useMemo(
  () => Object.entries(layout.anchors).map(([id, a]) => ({ id, x: a.pos[0], z: a.pos[2] })),
  [layout],
);
```
- The `InteractionBridge` currently reads a module-level `INTERACTABLES`. Add an `interactables` prop to `InteractionBridge` and pass `interactables` in; use the prop inside its `useFrame`. (Keep the throttle + ranges identical.)
- Pass `boxes={furnitureBoxes}` to `<Player>` (it already accepts `boxes`).
- Place furniture from the layout, including rotation:
```tsx
<Desk position={layout.anchors.desk.pos} rotation={layout.anchors.desk.rotation} />
<Bookshelf position={layout.anchors.bookshelf.pos} rotation={layout.anchors.bookshelf.rotation} />
<SafeAndPainting position={layout.anchors.safe.pos} rotation={layout.anchors.safe.rotation} revealed={safeSolved} />
<ExitDoor position={layout.anchors.door.pos} rotation={layout.anchors.door.rotation} open={escaped} />
```
(`Desk`/`Bookshelf` already spread group props, so `rotation` passes through; their `rotation` is `[0,0,0]` from the layout anyway.)
- Set the camera/player start from the layout. The `<Canvas camera>` `position` is static, so instead set the camera position on mount via the layout's `playerStart`. Simplest: change the `<Canvas>` camera to start at `layout.playerStart` by keying the Canvas on the layout or setting `camera={{ position: layout.playerStart, fov: 70 }}`. Since `playerStart` is currently always `[0,1.6,0]`, `camera={{ position: layout.playerStart, fov: 70 }}` is sufficient; the player can then walk from center.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: clean build; all tests pass (prior 161 + Task 1's ~7 = ~168).

- [ ] **Step 5: Commit**

```bash
git add src/escape/EscapeRoom.tsx src/escape/scene/furniture/ExitDoor.tsx
git commit -m "feat(escape): place furniture from a procedurally generated, validated layout"
```

---

## Self-Review Notes

**Spec coverage (Phase 4):** procedural geometry — object placement varies per playthrough (`generateLayout`) → Task 1; navigability/safety guaranteed by `validateLayout` (in-bounds, non-overlap, clear player start, reachable approach points) → Task 1; wired so every room uses a fresh validated layout, geometry now varies on top of the Phase-2 structural variation and Phase-3 Claude layer → Task 2. Room *shape* stays fixed (a square); only *placement* varies in 1.0, per the spec's open question resolved to "placement only". ✓

**Type consistency:** `generateLayout(seed): Layout` with `Anchor {pos, rotation, box}`; `validateLayout(layout, half)` returns `{ok, violations}` like the blueprint validator. `EscapeRoom` consumes `layout.anchors[id].{pos,rotation,box}`; `InteractionBridge` gains an `interactables` prop (was a module const); `Player` already takes `boxes`. `ExitDoor` gains an optional `rotation` matching `SafeAndPainting`.

**Why the validator is the safety net:** live movement/navigability can't be auto-tested (the headless preview pauses the frame loop), so `validateLayout` is unit-tested across a 200-seed sweep to guarantee every shipped layout is in-bounds, non-overlapping, and has reachable approach points. The controller will still browser-verify that a generated room mounts and renders furniture at varied positions.

**Note for the implementer:** keep the placement scheme conservative — if any seed trips `validateLayout` in Step 4, shrink `jitter()` or pull the quadrant centers inward rather than loosening the validator. Correctness (always-solvable, always-reachable) outranks placement variety.
