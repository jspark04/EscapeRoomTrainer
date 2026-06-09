# 3D Escape Room — Phase 2 Implementation Plan (Procedural Blueprints)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the escape room's puzzle chain procedurally generated — every playthrough draws a fresh, validated `Blueprint` with varying skills and a difficulty ramp — while keeping the fixed room geometry from Phase 1.

**Architecture:** Add a deterministic `generateBlueprint(seed)` that always uses the existing anchor slots (desk, bookshelf = overlay puzzles; safe = the diegetic combination finale; door = final lock) but varies which skills land on desk/bookshelf and the difficulty ramp. Then thread the generated blueprint through `EscapeRoom` (puzzles, session, lookups) instead of the static `studyBlueprint`. Geometry stays fixed (procedural geometry is Phase 4).

**Tech Stack:** Same as Phase 1 (Vite + React 19 + TS, R3F, Vitest).

**Spec:** `docs/superpowers/specs/2026-06-08-3d-escape-room-design.md` (Subsystem 2).

---

### Task 1: Deterministic `generateBlueprint`

**Files:**
- Create: `src/escape/blueprint/generate.ts`, `src/escape/blueprint/generate.test.ts`

The generator must always produce a blueprint that (a) passes `validateBlueprint`, (b) uses anchors `desk`/`bookshelf`/`safe` with the safe as the diegetic `combination` finale, (c) varies the two overlay skills, (d) has a non-decreasing difficulty ramp, and (e) wires a linear token chain ending in `exitCode` consumed by the door.

- [ ] **Step 1: Write the failing test `src/escape/blueprint/generate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateBlueprint } from './generate';
import { validateBlueprint } from './validate';

describe('generateBlueprint', () => {
  it('is deterministic for a given seed', () => {
    const a = generateBlueprint(42);
    const b = generateBlueprint(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a valid (solvable) blueprint for many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const bp = generateBlueprint(seed);
      const r = validateBlueprint(bp);
      expect(r.ok, `seed ${seed}: ${r.violations.join('; ')}`).toBe(true);
    }
  });

  it('uses the fixed anchor slots with the safe as the combination finale', () => {
    const bp = generateBlueprint(7);
    expect(bp.stations.map((s) => s.anchor)).toEqual(['desk', 'bookshelf', 'safe']);
    const safe = bp.stations[2];
    expect(safe.skill).toBe('combination');
    expect(safe.presenter).toBe('diegetic');
    expect(bp.stations[0].presenter).toBe('overlay');
    expect(bp.stations[1].presenter).toBe('overlay');
  });

  it('varies the two overlay skills (distinct, never combination) across seeds', () => {
    const pairs = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const bp = generateBlueprint(seed);
      const a = bp.stations[0].skill;
      const b = bp.stations[1].skill;
      expect(a).not.toBe('combination');
      expect(b).not.toBe('combination');
      expect(a).not.toBe(b);
      pairs.add(`${a}/${b}`);
    }
    expect(pairs.size).toBeGreaterThan(3); // genuinely varies
  });

  it('chains tokens to the door and ramps difficulty', () => {
    const bp = generateBlueprint(99);
    expect(bp.stations[0].consumes).toEqual([]);
    expect(bp.stations[1].consumes).toEqual(bp.stations[0].produces);
    expect(bp.stations[2].consumes).toEqual(bp.stations[1].produces);
    expect(bp.finalLock.consumes).toEqual(bp.stations[2].produces);
    expect(bp.stations[2].produces).toEqual(['exitCode']);
    expect(bp.stations[1].difficulty).toBeGreaterThanOrEqual(bp.stations[0].difficulty);
    expect(bp.stations[2].difficulty).toBeGreaterThanOrEqual(bp.stations[1].difficulty);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/blueprint/generate.test.ts`
Expected: FAIL — cannot find module './generate'.

- [ ] **Step 3: Write `src/escape/blueprint/generate.ts`**

```ts
import type { Blueprint, Station } from './types';
import type { Skill } from '../../types';
import { clampDifficulty } from '../../types';
import { mulberry32, shuffle } from '../../rng';

// Skills that work as 2D overlay puzzles (everything except the diegetic combination safe).
const OVERLAY_SKILLS: Skill[] = [
  'cipher',
  'anagram',
  'pattern',
  'logic',
  'math',
  'spatial',
  'observation',
];

/**
 * Deterministically assemble a solvable detective-study blueprint. Geometry is fixed
 * (desk + bookshelf overlay slots, safe = diegetic combination finale, door = final lock);
 * the two overlay skills and the difficulty ramp vary by seed. Always passes validateBlueprint.
 */
export function generateBlueprint(seed: number): Blueprint {
  const rng = mulberry32(seed);
  const [skillA, skillB] = shuffle(rng, OVERLAY_SKILLS).slice(0, 2);
  const base = 1 + Math.floor(rng() * 2); // 1 or 2

  const stations: Station[] = [
    {
      id: 'desk',
      skill: skillA,
      difficulty: clampDifficulty(base),
      anchor: 'desk',
      presenter: 'overlay',
      produces: ['clue0'],
      consumes: [],
      narrativeKey: 'desk',
    },
    {
      id: 'bookshelf',
      skill: skillB,
      difficulty: clampDifficulty(base + 1),
      anchor: 'bookshelf',
      presenter: 'overlay',
      produces: ['clue1'],
      consumes: ['clue0'],
      narrativeKey: 'bookshelf',
    },
    {
      id: 'safe',
      skill: 'combination',
      difficulty: clampDifficulty(base + 2),
      anchor: 'safe',
      presenter: 'diegetic',
      produces: ['exitCode'],
      consumes: ['clue1'],
      narrativeKey: 'safe',
    },
  ];

  return {
    theme: 'detective-study',
    seed,
    stations,
    finalLock: { anchor: 'door', consumes: ['exitCode'] },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/blueprint/generate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/blueprint/generate.ts src/escape/blueprint/generate.test.ts
git commit -m "feat(escape): deterministic procedural blueprint generator"
```

---

### Task 2: Use the generated blueprint in `EscapeRoom`

**Files:**
- Modify: `src/escape/EscapeRoom.tsx`

Replace the static `studyBlueprint` with a per-playthrough `generateBlueprint(...)`, threading the single generated instance through puzzles, session, and all station lookups. Geometry/furniture stays exactly as-is. `studyBlueprint.ts` remains as a test fixture (do not delete; it's imported by `validate.test.ts`, `resolver.test.ts`, `RoomSession.test.ts`).

- [ ] **Step 1: Read the current `src/escape/EscapeRoom.tsx`** to ground the edits below.

- [ ] **Step 2: Swap the blueprint source and derive everything from it**

Make these changes:
- Replace `import { studyBlueprint } from './blueprint/studyBlueprint';` with `import { generateBlueprint } from './blueprint/generate';`.
- Keep `const SEED_BASE = 1000;` (replace the `studyBlueprint.seed * 1000` definition with a plain constant `1000`).
- Add a memoized blueprint keyed on the nonce, and derive the session and puzzles from THAT instance:

```tsx
const blueprint = useMemo(() => generateBlueprint(SEED_BASE + seedNonce), [seedNonce]);

const puzzles = useMemo(() => {
  const map = new Map<string, Puzzle>();
  blueprint.stations.forEach((station, index) => {
    const rng = mulberry32(SEED_BASE + index + seedNonce * 100);
    map.set(station.id, getGenerator(station.skill).generate(station.difficulty, rng));
  });
  return map;
}, [blueprint, seedNonce]);

const safeStation = blueprint.stations.find((s) => s.skill === 'combination')!;
const exitCode = puzzles.get(safeStation.id)!.solution;

// Session rebuilt whenever the blueprint changes (i.e., on retry).
const session = useMemo(
  () =>
    createSession(blueprint, statsStore.getSettings().warmUpSeconds * 1000, {
      recordSolved: (e) =>
        statsStore.recordAttempt({ skill: e.skill, correct: true, timeMs: 0, difficulty: 3 }),
    }),
  [blueprint],
);
const sessionRef = useRef(session);
useEffect(() => {
  sessionRef.current = session;
}, [session]);
```
Remove the old `makeSession`/`useState(makeSession)`/`setSession` wiring (the session is now a `useMemo` of `blueprint`).

- Replace every remaining `studyBlueprint.stations` reference with `blueprint.stations` (in `engage`'s `.find`, and `prompt`'s `.find`). Add `blueprint` to the dependency arrays of the `useCallback`/`useMemo` that now close over it (`engage`, `prompt`, `puzzles`).

- [ ] **Step 3: Generalize the diegetic-solve produced token**

In `handleSolve`'s dial branch the produced token was hardcoded `{ safeDigitsB: target }`. Change the dial `onSolved` to use the safe station's declared token so it matches the generated blueprint:
```tsx
onSolved={() =>
  handleSolve(activeModal.station, { [activeModal.station.produces[0]]: activeModal.target })
}
```
(The generator sets the safe's `produces` to `['exitCode']`, which `finalLock.consumes` matches, so `session.submitFinal` still gates correctly.)

- [ ] **Step 4: Fix `onRetry`** so it no longer calls the removed `setSession`/`makeSession`; it should reset UI state and bump `seedNonce` (which recreates `blueprint` → `session` → `puzzles`):
```tsx
const onRetry = useCallback(() => {
  setSolvedIds(new Set());
  setSafeSolved(false);
  setEscaped(false);
  setStatus('playing');
  setActiveModal(null);
  targetRef.current = null;
  setTargetId(null);
  setRemainingMs(statsStore.getSettings().warmUpSeconds * 1000);
  setSeedNonce((n) => n + 1);
}, []);
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: clean build, all tests pass (Phase 1's 140 + Task 1's 5 = 145).

- [ ] **Step 6: Commit**

```bash
git add src/escape/EscapeRoom.tsx
git commit -m "feat(escape): drive the room from a procedurally generated blueprint"
```

---

## Self-Review Notes

**Spec coverage (Phase 2):** procedural blueprint generation gated by the solvability validator (`generateBlueprint` + existing `validateBlueprint`) → Task 1; rooms vary structurally each run (varying overlay skills + difficulty ramp) → Tasks 1–2; creates the seam Claude (Phase 3) plugs into (a `generateBlueprint` function that returns a validated `Blueprint`) → Task 1. Geometry stays fixed (Phase 4 owns procedural geometry). ✓

**Type consistency:** `generateBlueprint(seed): Blueprint` returns the same `Blueprint`/`Station` shape Phase 1 consumes; `validateBlueprint` (Phase 1) is reused unchanged; the safe's `produces: ['exitCode']` matches `finalLock.consumes: ['exitCode']` and the generalized dial `onSolved` token. `studyBlueprint` is retained only as a test fixture.

**Note for the implementer:** the furniture (`Desk`/`Bookshelf`/`SafeAndPainting`/`ExitDoor`) and the `ANCHORS` map are unchanged — only the *skills/puzzles* surfaced at the desk and bookshelf vary. The furniture-flavored prompt labels ("Read the cipher" etc.) are cosmetic; optionally generalize them to skill-neutral text ("[E] Inspect the desk", "[E] Examine the books", "[E] Work the safe dial") since the desk/bookshelf skill now varies — do this to avoid a cipher-specific label on a non-cipher puzzle.
