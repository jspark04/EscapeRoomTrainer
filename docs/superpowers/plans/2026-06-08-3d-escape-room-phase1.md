# 3D Escape Room — Phase 1 Implementation Plan (Playable Deterministic Room)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable, fully deterministic first-person 3D escape room (one detective's study) where the player walks around, solves a hand-authored chain of puzzles (reusing the existing engine) via 2D overlays plus one diegetic safe, and escapes against a timer — offline and free, no Claude.

**Architecture:** A new `escape3d` screen renders a React Three Fiber `<Canvas>`. The room is described by a hand-authored **blueprint** (data). Pure logic units (collision clamp, raycast target selection, session state machine, blueprint validation, token resolver, dial-lock check) are unit-tested with Vitest; the 3D scene/furniture and presenters are built as React components and verified in-browser. The existing `PuzzleGenerator`/`checkAnswer` engine is reused unchanged via an `OverlayPresenter`.

**Tech Stack:** Vite + React 19 + TypeScript, `three` + `@react-three/fiber` + `@react-three/drei`, Tailwind v4, Vitest. (This plan covers Phase 1 only; Phases 2–4 from the spec get their own plans.)

**Spec:** `docs/superpowers/specs/2026-06-08-3d-escape-room-design.md`

---

## File Structure (Phase 1)

```
src/escape/
  EscapeRoom.tsx                 # mode entry: <Canvas> + session + presenter host
  blueprint/
    types.ts                     # Station, Blueprint, Token (Phase-1 subset)
    studyBlueprint.ts            # the hand-authored detective-study blueprint
    validate.ts (+ validate.test.ts)   # validateBlueprint (solvability guarantee)
    resolver.ts (+ resolver.test.ts)   # solved puzzle → produced token values + chain state
  session/
    RoomSession.ts (+ RoomSession.test.ts)  # state machine, timer, win/lose, stats
  scene/
    physics.ts (+ physics.test.ts)     # pure AABB collision clamp + movement math
    interaction.ts (+ interaction.test.ts)  # pure raycast-target selection
    Room.tsx                     # walls/floor/ceiling shell + lights
    Player.tsx                   # camera rig: controls + movement (uses physics.ts)
    Crosshair.tsx                # center reticle + interaction prompt (DOM overlay)
    furniture/
      Desk.tsx  Bookshelf.tsx  SafeAndPainting.tsx  ExitDoor.tsx
  presenters/
    OverlayPresenter.tsx         # reuses existing GamePlayer/VIEWS in a modal
    DialLockPresenter.tsx (+ dialLock.test.ts)  # diegetic 3-dial safe
  ui/
    EscapeHUD.tsx                # timer + objective + results/lose screens
src/components/Home.tsx          # add an "Escape Room" entry (modify)
src/App.tsx                      # add 'escape3d' screen (modify)
```

Phase 1 uses a **hand-authored** blueprint (the procedural generator is Phase 2), but the
`types.ts` + `validate.ts` are written now so Phase 2 plugs in cleanly.

---

### Task 1: Install 3D deps and render an empty room screen (toolchain spike)

**Files:**
- Modify: `package.json` (deps), `src/App.tsx`, `src/components/Home.tsx`
- Create: `src/escape/EscapeRoom.tsx`

**Rationale:** De-risk the new toolchain first — get a `<Canvas>` rendering with pointer-lock before writing downstream code that assumes the API.

- [ ] **Step 1: Confirm current R3F/drei API + versions**

Use the context7 MCP (resolve `@react-three/fiber` and `@react-three/drei`) to confirm current import names for `Canvas`, `useFrame`, `useThree`, `PointerLockControls`, `KeyboardControls`, `useTexture`, and that they support React 19. Note any deltas from the code in this plan and adjust as you implement.

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 3: Create a minimal `src/escape/EscapeRoom.tsx`**

```tsx
import { Canvas } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';

export function EscapeRoom({ onExit }: { onExit: () => void }) {
  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 70 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 2]} intensity={20} castShadow color="#ffd9a0" />
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#a87b4a" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#2a1d12" />
        </mesh>
        <PointerLockControls />
      </Canvas>
      <button
        onClick={onExit}
        className="absolute left-4 top-4 z-10 rounded bg-slate-800/80 px-3 py-1 text-sm text-white"
      >
        ← Exit (Esc)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Wire a screen into `src/App.tsx`**

Add `escape3d` to the `Screen` union, import `EscapeRoom`, and render it:
```tsx
import { EscapeRoom } from './escape/EscapeRoom';
// in Screen union: | { name: 'escape3d' }
// in JSX:
{screen.name === 'escape3d' && <EscapeRoom onExit={home} />}
```
And pass an `onEscapeRoom` handler into `<Home>` (added next).

- [ ] **Step 5: Add a Home entry**

In `src/components/Home.tsx`, add a prop `onEscapeRoom: () => void` to `Props` and a button below the Warm-Up CTA:
```tsx
<button
  onClick={onEscapeRoom}
  className="mt-3 w-full rounded-xl bg-gradient-to-r from-stone-700 to-amber-900 p-5 text-left text-lg font-bold text-amber-100 transition hover:from-stone-600 hover:to-amber-800"
>
  🕵️ Enter the Escape Room
  <span className="block text-sm font-normal text-amber-200/80">
    A first-person room to escape using everything you've trained
  </span>
</button>
```
Wire `App.tsx`'s `<Home>` to pass `onEscapeRoom={() => setScreen({ name: 'escape3d' })}`.

- [ ] **Step 6: Verify build + manual render**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.
Then `npm run dev`, open the app, click "Enter the Escape Room": a brown cube on a dark floor renders; clicking the canvas locks the pointer and mouse-look orbits; the Exit button returns Home.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/escape/EscapeRoom.tsx src/App.tsx src/components/Home.tsx
git commit -m "feat(escape): scaffold 3D escape room screen with R3F canvas"
```

---

### Task 2: Blueprint types, hand-authored study blueprint, and validator

**Files:**
- Create: `src/escape/blueprint/types.ts`, `src/escape/blueprint/studyBlueprint.ts`, `src/escape/blueprint/validate.ts`, `src/escape/blueprint/validate.test.ts`

- [ ] **Step 1: Write `src/escape/blueprint/types.ts`**

```ts
import type { Skill, Difficulty } from '../../types';

export type PresenterKind = 'overlay' | 'diegetic';

/** A token is a named value that flows along the puzzle chain (e.g. 'safeDigits' -> "47"). */
export type Token = string;

export interface Station {
  id: string;
  skill: Skill;
  difficulty: Difficulty;
  anchor: string; // physical slot id: 'desk' | 'bookshelf' | 'safe'
  presenter: PresenterKind;
  produces: Token[]; // tokens yielded when solved
  consumes: Token[]; // tokens required before attemptable (empty = available from start)
  narrativeKey: string;
}

export interface Blueprint {
  theme: string;
  seed: number;
  stations: Station[];
  finalLock: { anchor: 'door'; consumes: Token[] };
}
```

- [ ] **Step 2: Write `src/escape/blueprint/studyBlueprint.ts`**

```ts
import type { Blueprint } from './types';

// Phase-1 hand-authored chain: desk (cipher) -> bookshelf (anagram) -> safe (combination) -> door.
export const studyBlueprint: Blueprint = {
  theme: 'detective-study',
  seed: 1,
  stations: [
    {
      id: 'desk',
      skill: 'cipher',
      difficulty: 2,
      anchor: 'desk',
      presenter: 'overlay',
      produces: ['deskClue'],
      consumes: [],
      narrativeKey: 'desk',
    },
    {
      id: 'bookshelf',
      skill: 'anagram',
      difficulty: 2,
      anchor: 'bookshelf',
      presenter: 'overlay',
      produces: ['safeDigitsA'],
      consumes: ['deskClue'],
      narrativeKey: 'bookshelf',
    },
    {
      id: 'safe',
      skill: 'combination',
      difficulty: 3,
      anchor: 'safe',
      presenter: 'diegetic',
      produces: ['safeDigitsB'],
      consumes: ['safeDigitsA'],
      narrativeKey: 'safe',
    },
  ],
  finalLock: { anchor: 'door', consumes: ['safeDigitsB'] },
};
```

- [ ] **Step 3: Write the failing test `src/escape/blueprint/validate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateBlueprint } from './validate';
import { studyBlueprint } from './studyBlueprint';
import type { Blueprint } from './types';

describe('validateBlueprint', () => {
  it('accepts the hand-authored study blueprint', () => {
    expect(validateBlueprint(studyBlueprint)).toEqual({ ok: true, violations: [] });
  });

  it('rejects a consumed token that is never produced', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s) =>
        s.id === 'desk' ? { ...s, consumes: ['ghost'] } : s,
      ),
    };
    const r = validateBlueprint(bp);
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/ghost/);
  });

  it('rejects when the final lock consumes an unproduced token', () => {
    const bp: Blueprint = { ...studyBlueprint, finalLock: { anchor: 'door', consumes: ['nope'] } };
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('rejects a decreasing difficulty ramp', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s, i) =>
        i === 1 ? { ...s, difficulty: 1 } : s,
      ),
    };
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('rejects duplicate anchors', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s) => ({ ...s, anchor: 'desk' })),
    };
    expect(validateBlueprint(bp).ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/escape/blueprint/validate.test.ts`
Expected: FAIL — cannot find module './validate'.

- [ ] **Step 5: Write `src/escape/blueprint/validate.ts`**

```ts
import type { Blueprint } from './types';

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

// Guarantees a blueprint is solvable: every consumed token is produced upstream, the
// chain reaches the final lock, difficulties never decrease, and anchors are unique.
export function validateBlueprint(bp: Blueprint): ValidationResult {
  const violations: string[] = [];
  const producedSoFar = new Set<string>();
  const anchors = new Set<string>();
  let prevDifficulty = 0;

  for (const s of bp.stations) {
    for (const c of s.consumes) {
      if (!producedSoFar.has(c)) {
        violations.push(`station "${s.id}" consumes "${c}" before it is produced`);
      }
    }
    if (s.difficulty < prevDifficulty) {
      violations.push(`station "${s.id}" difficulty ${s.difficulty} is below the prior ${prevDifficulty}`);
    }
    prevDifficulty = s.difficulty;
    if (anchors.has(s.anchor)) violations.push(`duplicate anchor "${s.anchor}"`);
    anchors.add(s.anchor);
    for (const p of s.produces) producedSoFar.add(p);
  }

  for (const c of bp.finalLock.consumes) {
    if (!producedSoFar.has(c)) {
      violations.push(`final lock consumes "${c}" which is never produced`);
    }
  }
  if (bp.finalLock.consumes.length === 0) {
    violations.push('final lock consumes nothing — the room cannot be completed');
  }

  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/escape/blueprint/validate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/escape/blueprint/
git commit -m "feat(escape): blueprint types, study blueprint, and solvability validator"
```

---

### Task 3: Token resolver (chain state)

**Files:**
- Create: `src/escape/blueprint/resolver.ts`, `src/escape/blueprint/resolver.test.ts`

The resolver tracks which stations are unlocked (their `consumes` are satisfied), records produced token values when a station is solved, and reports when the final lock is satisfied.

- [ ] **Step 1: Write the failing test `src/escape/blueprint/resolver.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createResolver } from './resolver';
import { studyBlueprint } from './studyBlueprint';

describe('createResolver', () => {
  it('only the first station (no consumes) is initially unlocked', () => {
    const r = createResolver(studyBlueprint);
    expect(r.isUnlocked('desk')).toBe(true);
    expect(r.isUnlocked('bookshelf')).toBe(false);
    expect(r.isUnlocked('safe')).toBe(false);
    expect(r.isComplete()).toBe(false);
  });

  it('solving a station unlocks the next and stores its tokens', () => {
    const r = createResolver(studyBlueprint);
    r.solve('desk', { deskClue: 'OWL' });
    expect(r.isUnlocked('bookshelf')).toBe(true);
    expect(r.tokenValue('deskClue')).toBe('OWL');
    r.solve('bookshelf', { safeDigitsA: '47' });
    expect(r.isUnlocked('safe')).toBe(true);
    r.solve('safe', { safeDigitsB: '13' });
    expect(r.isComplete()).toBe(true);
  });

  it('ignores solving a locked station', () => {
    const r = createResolver(studyBlueprint);
    r.solve('safe', { safeDigitsB: '13' });
    expect(r.isComplete()).toBe(false);
    expect(r.tokenValue('safeDigitsB')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/blueprint/resolver.test.ts`
Expected: FAIL — cannot find module './resolver'.

- [ ] **Step 3: Write `src/escape/blueprint/resolver.ts`**

```ts
import type { Blueprint, Token } from './types';

export interface Resolver {
  isUnlocked: (stationId: string) => boolean;
  isSolved: (stationId: string) => boolean;
  solve: (stationId: string, produced: Record<Token, string>) => void;
  tokenValue: (token: Token) => string | undefined;
  isComplete: () => boolean;
}

export function createResolver(bp: Blueprint): Resolver {
  const solved = new Set<string>();
  const tokens = new Map<Token, string>();
  const byId = new Map(bp.stations.map((s) => [s.id, s]));

  const isUnlocked = (id: string): boolean => {
    const s = byId.get(id);
    if (!s) return false;
    return s.consumes.every((c) => tokens.has(c));
  };

  return {
    isUnlocked,
    isSolved: (id) => solved.has(id),
    tokenValue: (t) => tokens.get(t),
    solve(id, produced) {
      if (!isUnlocked(id) || solved.has(id)) return;
      solved.add(id);
      for (const [k, v] of Object.entries(produced)) tokens.set(k, v);
    },
    isComplete: () => bp.finalLock.consumes.every((c) => tokens.has(c)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/blueprint/resolver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/blueprint/resolver.ts src/escape/blueprint/resolver.test.ts
git commit -m "feat(escape): token resolver tracks chain unlock + completion"
```

---

### Task 4: Collision + movement math (pure)

**Files:**
- Create: `src/escape/scene/physics.ts`, `src/escape/scene/physics.test.ts`

Pure functions so movement/collision are testable without a 3D context. The room is an
axis-aligned box; furniture are AABBs the player cannot enter.

- [ ] **Step 1: Write the failing test `src/escape/scene/physics.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { clampToRoom, blockedByBoxes, type AABB } from './physics';

describe('clampToRoom', () => {
  it('keeps the player inside the room minus the wall margin', () => {
    // room half-extents 5 (x,z), margin 0.3
    expect(clampToRoom({ x: 10, z: 0 }, 5, 0.3)).toEqual({ x: 4.7, z: 0 });
    expect(clampToRoom({ x: -10, z: -10 }, 5, 0.3)).toEqual({ x: -4.7, z: -4.7 });
    expect(clampToRoom({ x: 1, z: 2 }, 5, 0.3)).toEqual({ x: 1, z: 2 });
  });
});

describe('blockedByBoxes', () => {
  const boxes: AABB[] = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  it('reports a position inside a furniture box (plus radius) as blocked', () => {
    expect(blockedByBoxes({ x: 0, z: 0 }, 0.3, boxes)).toBe(true);
    expect(blockedByBoxes({ x: 1.2, z: 0 }, 0.3, boxes)).toBe(true); // within radius
  });
  it('reports a clear position as not blocked', () => {
    expect(blockedByBoxes({ x: 3, z: 3 }, 0.3, boxes)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/scene/physics.test.ts`
Expected: FAIL — cannot find module './physics'.

- [ ] **Step 3: Write `src/escape/scene/physics.ts`**

```ts
export interface Vec2 {
  x: number;
  z: number;
}
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Clamp a position to stay inside a square room of the given half-extent, minus a margin. */
export function clampToRoom(p: Vec2, halfExtent: number, margin: number): Vec2 {
  const limit = halfExtent - margin;
  return {
    x: Math.max(-limit, Math.min(limit, p.x)),
    z: Math.max(-limit, Math.min(limit, p.z)),
  };
}

/** True if the player's circle (position + radius) overlaps any furniture box. */
export function blockedByBoxes(p: Vec2, radius: number, boxes: AABB[]): boolean {
  return boxes.some(
    (b) =>
      p.x > b.minX - radius &&
      p.x < b.maxX + radius &&
      p.z > b.minZ - radius &&
      p.z < b.maxZ + radius,
  );
}

/** Resolve a desired move: clamp to room; if it would enter a box, slide per-axis. */
export function resolveMove(from: Vec2, to: Vec2, halfExtent: number, radius: number, boxes: AABB[]): Vec2 {
  const margin = radius;
  const tryX = clampToRoom({ x: to.x, z: from.z }, halfExtent, margin);
  const x = blockedByBoxes(tryX, radius, boxes) ? from.x : tryX.x;
  const tryZ = clampToRoom({ x, z: to.z }, halfExtent, margin);
  const z = blockedByBoxes(tryZ, radius, boxes) ? from.z : tryZ.z;
  return { x, z };
}
```

- [ ] **Step 4: Add a `resolveMove` test**

Append to `physics.test.ts`:
```ts
import { resolveMove } from './physics';

describe('resolveMove', () => {
  const boxes: AABB[] = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  it('slides along Z when X is blocked', () => {
    const out = resolveMove({ x: 1.5, z: 1.5 }, { x: 0, z: 1.5 }, 5, 0.3, boxes);
    expect(out.x).toBe(1.5); // X move into the box is rejected
    expect(out.z).toBe(1.5); // Z unchanged here
  });
  it('allows a clear move', () => {
    expect(resolveMove({ x: 3, z: 3 }, { x: 3, z: 2 }, 5, 0.3, boxes)).toEqual({ x: 3, z: 2 });
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/escape/scene/physics.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/escape/scene/physics.ts src/escape/scene/physics.test.ts
git commit -m "feat(escape): pure collision + movement resolution"
```

---

### Task 5: Interaction target selection (pure)

**Files:**
- Create: `src/escape/scene/interaction.ts`, `src/escape/scene/interaction.test.ts`

Choosing which interactable the player is looking at is pure: given the player position,
look direction, and the interactables' positions, pick the closest within range and within
an aim cone.

- [ ] **Step 1: Write the failing test `src/escape/scene/interaction.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pickTarget, type Interactable } from './interaction';

const items: Interactable[] = [
  { id: 'desk', x: 0, z: -3 },
  { id: 'safe', x: 3, z: 0 },
];

describe('pickTarget', () => {
  it('selects the interactable the player faces within range', () => {
    // facing -Z toward the desk
    expect(pickTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, items, 4, 0.6)?.id).toBe('desk');
  });
  it('returns null when nothing is within the aim cone', () => {
    // facing +X but only desk is in front-ish; safe is at +X though
    expect(pickTarget({ x: 0, z: 0 }, { x: 1, z: 0 }, items, 4, 0.6)?.id).toBe('safe');
    expect(pickTarget({ x: 0, z: 0 }, { x: -1, z: 0 }, items, 4, 0.6)).toBeNull();
  });
  it('returns null when the target is out of range', () => {
    expect(pickTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, items, 2, 0.6)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/scene/interaction.test.ts`
Expected: FAIL — cannot find module './interaction'.

- [ ] **Step 3: Write `src/escape/scene/interaction.ts`**

```ts
export interface Interactable {
  id: string;
  x: number;
  z: number;
}
interface Vec2 {
  x: number;
  z: number;
}

/**
 * Pick the closest interactable that is within `range` and whose direction from the player
 * is within an aim cone of the look direction (dot product >= minDot). Returns null if none.
 */
export function pickTarget(
  pos: Vec2,
  look: Vec2,
  items: Interactable[],
  range: number,
  minDot: number,
): Interactable | null {
  const ll = Math.hypot(look.x, look.z) || 1;
  const lx = look.x / ll;
  const lz = look.z / ll;

  let best: Interactable | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    const dx = it.x - pos.x;
    const dz = it.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range || dist === 0) continue;
    const dot = (dx / dist) * lx + (dz / dist) * lz;
    if (dot < minDot) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = it;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/scene/interaction.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/scene/interaction.ts src/escape/scene/interaction.test.ts
git commit -m "feat(escape): pure interaction target selection"
```

---

### Task 6: RoomSession state machine (timer, win/lose, stats)

**Files:**
- Create: `src/escape/session/RoomSession.ts`, `src/escape/session/RoomSession.test.ts`

Framework-agnostic session logic driven by explicit `tick(deltaMs)` and `recordSolved()`
calls (so it is unit-testable without React/timers).

- [ ] **Step 1: Write the failing test `src/escape/session/RoomSession.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSession } from './RoomSession';
import { studyBlueprint } from '../blueprint/studyBlueprint';

describe('RoomSession', () => {
  it('starts playing with the full duration remaining', () => {
    const s = createSession(studyBlueprint, 120_000);
    expect(s.getState().status).toBe('playing');
    expect(s.getState().remainingMs).toBe(120_000);
  });

  it('counts down and fails at zero', () => {
    const s = createSession(studyBlueprint, 1_000);
    s.tick(600);
    expect(s.getState().remainingMs).toBe(400);
    s.tick(500);
    expect(s.getState().status).toBe('failed');
    expect(s.getState().remainingMs).toBe(0);
  });

  it('escapes when the final lock is satisfied and reports elapsed time', () => {
    const s = createSession(studyBlueprint, 120_000);
    s.solve('desk', { deskClue: 'OWL' });
    s.solve('bookshelf', { safeDigitsA: '47' });
    s.tick(5_000);
    s.solve('safe', { safeDigitsB: '13' });
    s.submitFinal('4713'); // door consumes safeDigitsB; final code accepted by the door logic
    expect(s.getState().status).toBe('escaped');
    expect(s.getState().elapsedMs).toBe(5_000);
  });

  it('records each solved station to the provided stats sink', () => {
    const record = vi.fn();
    const s = createSession(studyBlueprint, 120_000, { recordSolved: record });
    s.solve('desk', { deskClue: 'OWL' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ skill: 'cipher' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/session/RoomSession.test.ts`
Expected: FAIL — cannot find module './RoomSession'.

- [ ] **Step 3: Write `src/escape/session/RoomSession.ts`**

```ts
import type { Blueprint, Token } from '../blueprint/types';
import type { Skill } from '../../types';
import { createResolver } from '../blueprint/resolver';

export type SessionStatus = 'playing' | 'escaped' | 'failed';

export interface SessionState {
  status: SessionStatus;
  remainingMs: number;
  elapsedMs: number;
}

export interface SolvedEvent {
  stationId: string;
  skill: Skill;
}

interface Hooks {
  recordSolved?: (e: SolvedEvent) => void;
}

export interface Session {
  getState: () => SessionState;
  tick: (deltaMs: number) => void;
  solve: (stationId: string, produced: Record<Token, string>) => void;
  submitFinal: (code: string) => boolean;
  isUnlocked: (stationId: string) => boolean;
}

export function createSession(bp: Blueprint, durationMs: number, hooks: Hooks = {}): Session {
  const resolver = createResolver(bp);
  const byId = new Map(bp.stations.map((s) => [s.id, s]));
  let status: SessionStatus = 'playing';
  let remainingMs = durationMs;
  let elapsedMs = 0;

  return {
    getState: () => ({ status, remainingMs, elapsedMs }),
    tick(deltaMs) {
      if (status !== 'playing') return;
      elapsedMs += deltaMs;
      remainingMs = Math.max(0, remainingMs - deltaMs);
      if (remainingMs === 0) status = 'failed';
    },
    isUnlocked: (id) => resolver.isUnlocked(id),
    solve(id, produced) {
      if (status !== 'playing') return;
      const station = byId.get(id);
      if (!station || !resolver.isUnlocked(id) || resolver.isSolved(id)) return;
      resolver.solve(id, produced);
      hooks.recordSolved?.({ stationId: id, skill: station.skill });
    },
    submitFinal() {
      if (status !== 'playing') return false;
      if (resolver.isComplete()) {
        status = 'escaped';
        return true;
      }
      return false;
    },
  };
}
```

> Note: `submitFinal(code)` accepts the assembled code; in Phase 1 the door is satisfied once
> the chain is complete (the safe produced the final token). The literal code-entry UX lives in
> the door keypad presenter (Task 9); `submitFinal` only gates on chain completion here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/session/RoomSession.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/session/
git commit -m "feat(escape): RoomSession state machine with timer and stats hook"
```

---

### Task 7: DialLock check (diegetic safe logic)

**Files:**
- Create: `src/escape/presenters/dialLock.test.ts`, and the logic in `src/escape/presenters/DialLockPresenter.tsx` (logic-only export tested here; 3D dials added + verified in Task 8 wiring).

- [ ] **Step 1: Write the failing test `src/escape/presenters/dialLock.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dialsMatch, normalizeDials } from './DialLockPresenter';

describe('dial lock', () => {
  it('matches when dials equal the target code', () => {
    expect(dialsMatch([4, 7, 3], '473')).toBe(true);
  });
  it('does not match a wrong combination', () => {
    expect(dialsMatch([4, 7, 2], '473')).toBe(false);
  });
  it('normalizes dial wrap-around (0-9)', () => {
    expect(normalizeDials([10, -1, 13])).toEqual([0, 9, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/presenters/dialLock.test.ts`
Expected: FAIL — cannot find module './DialLockPresenter'.

- [ ] **Step 3: Create `src/escape/presenters/DialLockPresenter.tsx` (logic + minimal shell)**

```tsx
import { useState } from 'react';

export function normalizeDials(dials: number[]): number[] {
  return dials.map((d) => ((d % 10) + 10) % 10);
}

export function dialsMatch(dials: number[], target: string): boolean {
  return normalizeDials(dials).join('') === target.replace(/\D/g, '');
}

interface Props {
  /** The combination puzzle's solution (digit string), e.g. "473". */
  target: string;
  onSolved: () => void;
  onClose: () => void;
}

/** A simple DOM dial lock (the 3D dial mesh is wired in Task 8; this is the interactive core). */
export function DialLockPresenter({ target, onSolved, onClose }: Props) {
  const [dials, setDials] = useState<number[]>(() => target.replace(/\D/g, '').split('').map(() => 0));
  const bump = (i: number, delta: number) =>
    setDials((d) => d.map((v, j) => (j === i ? ((v + delta + 10) % 10) : v)));

  const solved = dialsMatch(dials, target);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-stone-900 p-6 text-amber-100">
      <h3 className="font-bold">Safe — set the combination</h3>
      <div className="flex gap-3">
        {dials.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <button onClick={() => bump(i, +1)} className="px-3 text-xl">▲</button>
            <div className="w-10 rounded bg-black/60 py-2 text-center font-mono text-2xl">{v}</div>
            <button onClick={() => bump(i, -1)} className="px-3 text-xl">▼</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={!solved}
          onClick={onSolved}
          className="rounded bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-40"
        >
          Open
        </button>
        <button onClick={onClose} className="rounded bg-stone-700 px-4 py-2">Close</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/presenters/dialLock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/presenters/DialLockPresenter.tsx src/escape/presenters/dialLock.test.ts
git commit -m "feat(escape): diegetic dial-lock interactive core + tests"
```

---

### Task 8: OverlayPresenter (reuse the 2D engine)

**Files:**
- Create: `src/escape/presenters/OverlayPresenter.tsx`, `src/escape/presenters/OverlayPresenter.test.tsx`

Wraps the existing puzzle engine: given a `skill` + `difficulty`, it generates a puzzle and
renders it in a modal using the existing `VIEWS` + answer entry, reporting the produced
token (the solution) on a correct answer.

- [ ] **Step 1: Write the failing test `src/escape/presenters/OverlayPresenter.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayPresenter } from './OverlayPresenter';
import { mulberry32 } from '../../rng';
import { cipherGenerator } from '../../games/cipher';

describe('OverlayPresenter', () => {
  it('reports solved with the produced token when the right answer is entered', () => {
    const puzzle = cipherGenerator.generate(2, mulberry32(7));
    const onSolved = vi.fn();
    render(
      <OverlayPresenter
        puzzle={puzzle}
        produces={['deskClue']}
        onSolved={onSolved}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: puzzle.solution } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSolved).toHaveBeenCalledWith({ deskClue: puzzle.solution });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/presenters/OverlayPresenter.test.tsx`
Expected: FAIL — cannot find module './OverlayPresenter'.

- [ ] **Step 3: Write `src/escape/presenters/OverlayPresenter.tsx`**

```tsx
import { useState } from 'react';
import type { Puzzle, Token } from '../../types';
import { VIEWS } from '../../views';

interface Props {
  puzzle: Puzzle;
  produces: Token[];
  onSolved: (produced: Record<Token, string>) => void;
  onClose: () => void;
}

// Reuses the existing per-skill view; on a correct answer, maps every produced token to the
// puzzle's solution string (Phase 1 stations produce a single token = the solution/code).
export function OverlayPresenter({ puzzle, produces, onSolved, onClose }: Props) {
  const View = VIEWS[puzzle.skill];
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  function submit() {
    if (puzzle.checkAnswer(input)) {
      const produced: Record<Token, string> = {};
      for (const t of produces) produced[t] = puzzle.solution;
      onSolved(produced);
    } else {
      setWrong(true);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6">
        <View puzzle={puzzle} />
        <input
          type="text"
          value={input}
          autoFocus
          onChange={(e) => { setInput(e.target.value); setWrong(false); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your answer"
          className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-lg text-white"
        />
        {wrong && <p className="mt-2 text-rose-400">Not quite.</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Submit</button>
          <button onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-white">Close</button>
        </div>
      </div>
    </div>
  );
}
```

Also add the `Token` re-export used above: in `src/escape/blueprint/types.ts` it is already
exported; import it from there instead if you prefer (`import type { Token } from '../blueprint/types'`).
Update the import in this file to `import type { Token } from '../blueprint/types';` and keep
`import type { Puzzle } from '../../types';`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/presenters/OverlayPresenter.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/escape/presenters/OverlayPresenter.tsx src/escape/presenters/OverlayPresenter.test.tsx
git commit -m "feat(escape): overlay presenter reuses the 2D puzzle engine"
```

---

### Task 9: Build the room scene, furniture, player, HUD, and wire the full loop

**Files:**
- Create: `src/escape/scene/Room.tsx`, `src/escape/scene/Player.tsx`, `src/escape/scene/Crosshair.tsx`, `src/escape/scene/furniture/Desk.tsx`, `Bookshelf.tsx`, `SafeAndPainting.tsx`, `ExitDoor.tsx`, `src/escape/ui/EscapeHUD.tsx`
- Modify: `src/escape/EscapeRoom.tsx` (assemble everything)

This task is component-heavy and verified in-browser (3D rendering isn't meaningfully unit-testable). The pure logic it relies on (Tasks 4–6) is already tested.

- [ ] **Step 1: Write `src/escape/scene/Room.tsx`** (shell + lights)

```tsx
import { useTexture } from '@react-three/drei';

export const ROOM_HALF = 5; // half-extent of the square room

export function Room() {
  const wood = useTexture('/textures/wood.jpg'); // add a CC0 wood texture under public/textures/
  return (
    <group>
      <ambientLight intensity={0.35} color="#ffe9c8" />
      <pointLight position={[0, 3.2, 0]} intensity={28} distance={18} castShadow color="#ffce8a" />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial map={wood} color="#6b4a2b" />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, 3.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#1c140d" />
      </mesh>
      {/* four walls */}
      {[
        { p: [0, 1.7, -ROOM_HALF] as const, r: [0, 0, 0] as const },
        { p: [0, 1.7, ROOM_HALF] as const, r: [0, Math.PI, 0] as const },
        { p: [-ROOM_HALF, 1.7, 0] as const, r: [0, Math.PI / 2, 0] as const },
        { p: [ROOM_HALF, 1.7, 0] as const, r: [0, -Math.PI / 2, 0] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.p} rotation={w.r} receiveShadow>
          <planeGeometry args={[ROOM_HALF * 2, 3.4]} />
          <meshStandardMaterial color="#3a2818" />
        </mesh>
      ))}
    </group>
  );
}
```

> Add a CC0 wood texture at `public/textures/wood.jpg` (e.g. from ambientCG/Poly Haven, CC0).
> If you skip the texture for now, drop the `map={wood}` prop and the `useTexture` call.

- [ ] **Step 2: Write `src/escape/scene/Player.tsx`** (controls + movement via physics.ts)

```tsx
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { resolveMove, type AABB } from './physics';
import { ROOM_HALF } from './Room';

const MAP = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'back', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
];

function Movement({ boxes }: { boxes: AABB[] }) {
  const { camera } = useThree();
  const [, get] = useKeyboardControls();
  const dir = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const { forward, back, left, right } = get();
    const speed = 2.6 * dt;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    dir.current.set(0, 0, 0);
    if (forward) dir.current.add(fwd);
    if (back) dir.current.sub(fwd);
    if (right) dir.current.add(side);
    if (left) dir.current.sub(side);
    if (dir.current.lengthSq() === 0) return;
    dir.current.normalize().multiplyScalar(speed);
    const to = { x: camera.position.x + dir.current.x, z: camera.position.z + dir.current.z };
    const next = resolveMove({ x: camera.position.x, z: camera.position.z }, to, ROOM_HALF, 0.35, boxes);
    camera.position.x = next.x;
    camera.position.z = next.z;
    camera.position.y = 1.6;
  });
  return null;
}

export function Player({ boxes }: { boxes: AABB[] }) {
  return (
    <KeyboardControls map={MAP}>
      <Movement boxes={boxes} />
      <PointerLockControls />
    </KeyboardControls>
  );
}
```

- [ ] **Step 3: Write the furniture components**

`src/escape/scene/furniture/Desk.tsx` (others follow the same primitive-mesh pattern at their anchor positions; give each an `onSelect`-able mesh tagged for interaction):
```tsx
import type { ThreeElements } from '@react-three/fiber';

export function Desk(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[1.6, 0.1, 0.8]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {[[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.3], [0.7, 0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]} castShadow>
          <boxGeometry args={[0.1, 0.75, 0.1]} />
          <meshStandardMaterial color="#3a2615" />
        </mesh>
      ))}
    </group>
  );
}
```
Create `Bookshelf.tsx`, `SafeAndPainting.tsx`, `ExitDoor.tsx` analogously (a tall box of shelves; a wall box with a smaller safe door + a painting plane in front; a door plane with a small keypad box). Keep them primitive; each is placed by `EscapeRoom.tsx` at its anchor and exposes its world position for interaction.

- [ ] **Step 4: Write `src/escape/scene/Crosshair.tsx`** (DOM overlay reticle + prompt)

```tsx
export function Crosshair({ prompt }: { prompt: string | null }) {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/80" />
      {prompt && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-10 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm text-amber-100">
          {prompt}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Write `src/escape/ui/EscapeHUD.tsx`** (timer + objective + end screens)

```tsx
interface Props {
  remainingMs: number;
  status: 'playing' | 'escaped' | 'failed';
  objective: string;
  elapsedMs: number;
  onRetry: () => void;
  onExit: () => void;
}

function mmss(ms: number) {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function EscapeHUD({ remainingMs, status, objective, elapsedMs, onRetry, onExit }: Props) {
  if (status !== 'playing') {
    const won = status === 'escaped';
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 text-center text-amber-100">
        <h2 className="text-3xl font-black">{won ? '🔓 You escaped!' : "⏳ Time's up"}</h2>
        {won && <p className="mt-2">Escaped in {mmss(elapsedMs)}</p>}
        <div className="mt-6 flex gap-3">
          <button onClick={onRetry} className="rounded bg-amber-500 px-5 py-2 font-semibold text-stone-900">Play again</button>
          <button onClick={onExit} className="rounded bg-stone-700 px-5 py-2">Exit</button>
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 text-amber-100">
      <span className="rounded bg-black/50 px-3 py-1 text-sm">{objective}</span>
      <span className="rounded bg-black/50 px-3 py-1 font-mono text-lg">{mmss(remainingMs)}</span>
    </div>
  );
}
```

- [ ] **Step 6: Assemble everything in `src/escape/EscapeRoom.tsx`**

Replace the Task-1 stub with the full assembly: build the session from `studyBlueprint` + the Warm-Up duration setting; generate a puzzle per station (seeded by the blueprint seed + station index) using `getGenerator`; place furniture at anchor positions; track the looked-at interactable via `pickTarget` (fed by camera position/direction each frame through a small bridge component that lifts those values to React state at a throttled rate); on `E`/click open the station's presenter (`OverlayPresenter` for overlay stations, `DialLockPresenter` for the safe — release pointer lock while a presenter is open); on solve, call `session.solve(...)` with the produced token; the ExitDoor keypad opens an overlay to enter the 4-digit code and calls `session.submitFinal(code)`; record solved stations to `StatsStore`; show `EscapeHUD`. Wire `onRetry` to rebuild the session with a fresh seed.

```tsx
// Key structure (abridged for the plan; fill in the furniture placement + presenter host):
import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { Room, ROOM_HALF } from './scene/Room';
import { Player } from './scene/Player';
import { Crosshair } from './scene/Crosshair';
import { EscapeHUD } from './ui/EscapeHUD';
import { studyBlueprint } from './blueprint/studyBlueprint';
import { createSession } from './session/RoomSession';
import { getGenerator } from '../games';
import { statsStore } from '../stats/sharedStore';
import type { AABB } from './scene/physics';

const ANCHORS: Record<string, { pos: [number, number, number]; box: AABB }> = {
  desk: { pos: [-3, 0, -3], box: { minX: -4, maxX: -2, minZ: -4, maxZ: -2.5 } },
  bookshelf: { pos: [3.5, 0, 3.5], box: { minX: 2.8, maxX: 4.2, minZ: 2.8, maxZ: 4.2 } },
  safe: { pos: [3.5, 1.4, -4.6], box: { minX: 3, maxX: 4, minZ: -4.9, maxZ: -4.4 } },
  door: { pos: [0, 1.2, -ROOM_HALF + 0.05], box: { minX: -1, maxX: 1, minZ: -5, maxZ: -4.7 } },
};

export function EscapeRoom({ onExit }: { onExit: () => void }) {
  const [seedNonce, setSeedNonce] = useState(0);
  const durationMs = statsStore.getSettings().warmUpSeconds * 1000;
  const session = useMemo(
    () => createSession(studyBlueprint, durationMs, {
      recordSolved: (e) => statsStore.recordAttempt({ skill: e.skill, correct: true, timeMs: 0, difficulty: 3 }),
    }),
    [durationMs, seedNonce],
  );
  // ... per-station puzzle generation via getGenerator(station.skill).generate(station.difficulty, seeded rng) ...
  // ... interaction bridge + presenter host + HUD; furniture boxes = Object.values(ANCHORS).map(a => a.box) ...

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 70 }}>
        <Room />
        <Player boxes={Object.values(ANCHORS).map((a) => a.box)} />
        {/* furniture placed at ANCHORS[...].pos */}
      </Canvas>
      <Crosshair prompt={/* from pickTarget */ null} />
      <EscapeHUD
        remainingMs={session.getState().remainingMs}
        status={session.getState().status}
        elapsedMs={session.getState().elapsedMs}
        objective="Find a way out."
        onRetry={() => setSeedNonce((n) => n + 1)}
        onExit={onExit}
      />
      <button onClick={onExit} className="absolute left-4 bottom-4 z-10 rounded bg-slate-800/80 px-3 py-1 text-sm text-white">← Exit</button>
    </div>
  );
}
```

> Implementer note: the timer needs a render loop — drive `session.tick(delta)` from a
> `useFrame` bridge inside the Canvas that also lifts `remainingMs`/`status` to React state
> (e.g. via a `useState` updated on an interval or each second) so the HUD re-renders. Keep
> the session instance in a ref so ticks accumulate correctly.

- [ ] **Step 7: Verify build + full manual playthrough**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: clean build, all tests pass.
Then `npm run dev` and play: walk to the desk → solve the cipher overlay → walk to the bookshelf → solve the anagram → walk to the safe → turn the dials to the combination → walk to the door → enter the 4-digit code → "You escaped!" with a time. Let the timer hit zero on a retry to confirm the lose screen. Confirm the Dashboard shows new attempts.

- [ ] **Step 8: Commit**

```bash
git add src/escape/ public/textures
git commit -m "feat(escape): assemble playable first-person room with chained puzzles + HUD"
```

---

## Self-Review Notes

**Spec coverage (Phase 1 scope):**
- New `escape3d` mode reachable from Home → Tasks 1, 9. ✓
- First-person WASD + pointer-lock + crosshair interaction → Tasks 4, 5, 9 (Player, Crosshair). ✓
- Warm study aesthetic from primitives + a CC0 texture → Task 9 (Room/furniture). ✓
- Chained puzzles → final door lock (cipher → anagram → combination → keypad) → Tasks 2, 3, 6, 8, 9. ✓
- Dynamic puzzle *instances* (fresh per playthrough) → Task 9 (seeded generation + retry nonce). ✓
- Hybrid presenters: overlay default + one diegetic safe → Tasks 7, 8. ✓
- Blueprint + `validateBlueprint` written now for Phase 2 seam → Task 2. ✓
- Timer + win/lose + stats wiring → Tasks 6, 9 (HUD, StatsStore). ✓
- Deterministic/offline, no Claude → entire plan (no network). ✓

**Deferred to later phases (correctly out of Phase 1):** procedural blueprint generation (Phase 2), the Claude layer (Phase 3), procedural geometry (Phase 4).

**Type consistency:** `Station`/`Blueprint`/`Token` (Task 2) are used by `validate` (2), `resolver` (3), `RoomSession` (6), presenters (7, 8), and `EscapeRoom` (9). `Resolver` interface (3) is consumed by `createSession` (6). `AABB`/`resolveMove` (4) used by `Player`/`EscapeRoom` (9). `pickTarget`/`Interactable` (5) used by the interaction bridge (9). `OverlayPresenter` produces `Record<Token,string>` matching `session.solve` (6). `dialsMatch` (7) gates the safe's `onSolved`. Consistent.

**Note on the dial-lock + combination puzzle:** the safe station generates a `combination`
puzzle; its `solution` (digit string) is passed to `DialLockPresenter` as `target`, and the
produced token (`safeDigitsB`) is that solution. The final keypad compares the entered code
against the assembled produced tokens (Phase 1: the safe's solution is the door code).
