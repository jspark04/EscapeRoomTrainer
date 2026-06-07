# Escape Room Brain Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first web app with four escape-room skill mini-games, a Train mode (adaptive difficulty) and a timed Warm-Up mode, with progress stored in localStorage.

**Architecture:** Vite + React + TS SPA. Every mini-game is a pure `PuzzleGenerator` producing a `Puzzle` (with a `checkAnswer` fn). A generic `GamePlayer` drives any generator; Train and Warm-Up are thin wrappers; a `StatsStore` over localStorage records results. State-based screen switching, no router lib.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS v4, Vitest + React Testing Library.

---

## File Structure

```
src/
  main.tsx                 // React entry
  App.tsx                  // screen switcher
  index.css                // Tailwind entry
  types.ts                 // Skill, Difficulty, Puzzle, PuzzleGenerator, Rng
  rng.ts                   // seeded RNG helper for tests/generators
  stats/StatsStore.ts      // localStorage persistence + stats math
  engine/difficulty.ts     // adaptive difficulty logic
  engine/GamePlayer.tsx    // generic generate→render→check→record loop
  games/index.ts           // generator registry
  games/cipher.ts          // Ciphers & Codes generator
  games/pattern.ts         // Pattern & Sequence generator
  games/observation.ts     // Observation & Memory generator
  games/logic.ts           // Logic & Lateral generator
  views/index.ts           // skill → view component registry
  views/CipherView.tsx
  views/PatternView.tsx
  views/ObservationView.tsx
  views/LogicView.tsx
  modes/Train.tsx
  modes/WarmUpSession.tsx
  components/Home.tsx
  components/Dashboard.tsx
```

Test files live next to source as `*.test.ts(x)`.

---

### Task 1: Scaffold project

**Files:**
- Create: project root config (Vite, Tailwind, Vitest)

- [ ] **Step 1: Scaffold Vite React-TS app**

Run (in `D:\Repos\EscapeRoomTrainer`):
```bash
npm create vite@latest . -- --template react-ts
npm install
```
If the directory is non-empty, choose "Ignore files and continue".

- [ ] **Step 2: Install Tailwind, Vitest, testing libs**

```bash
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Tailwind v4 + Vitest in `vite.config.ts`**

Replace `vite.config.ts` with:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Replace `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Add test script to `package.json`**

In `"scripts"`, add: `"test": "vitest"`.

- [ ] **Step 7: Verify dev server and tests boot**

Run: `npm run dev` (Ctrl-C after it prints a localhost URL), then `npx vitest run`.
Expected: dev server starts; vitest reports "No test files found" (exit 0) or runs cleanly.

- [ ] **Step 8: Init git and commit**

```bash
git init
printf "node_modules/\ndist/\n" > .gitignore
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

### Task 2: Core types and seeded RNG

**Files:**
- Create: `src/types.ts`, `src/rng.ts`, `src/rng.test.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export type Skill = 'cipher' | 'pattern' | 'observation' | 'logic';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Rng = () => number; // returns [0,1), like Math.random

export interface Puzzle {
  id: string;
  skill: Skill;
  prompt: string;
  data: unknown;
  checkAnswer: (input: string) => boolean;
  solution: string;
  hint?: string;
}

export interface PuzzleGenerator {
  id: string;
  name: string;
  skill: Skill;
  generate: (difficulty: Difficulty, rng?: Rng) => Puzzle;
}

export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

export function clampDifficulty(n: number): Difficulty {
  const c = Math.max(1, Math.min(5, Math.round(n)));
  return c as Difficulty;
}
```

- [ ] **Step 2: Write the failing test `src/rng.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, pick, randInt } from './rng';

describe('seeded rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it('randInt returns values within range inclusive', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = randInt(r, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('pick selects an element from the array', () => {
    const r = mulberry32(5);
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(pick(r, arr));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/rng.test.ts`
Expected: FAIL — cannot find module './rng'.

- [ ] **Step 4: Write `src/rng.ts`**

```ts
import type { Rng } from './types';

// Small deterministic PRNG (mulberry32) for reproducible puzzle generation in tests.
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let counter = 0;
export function uid(prefix = 'p'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/rng.ts src/rng.test.ts
git commit -m "feat: core types and seeded rng helpers"
```

---

### Task 3: StatsStore

**Files:**
- Create: `src/stats/StatsStore.ts`, `src/stats/StatsStore.test.ts`

- [ ] **Step 1: Write the failing test `src/stats/StatsStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStore } from './StatsStore';

beforeEach(() => localStorage.clear());

describe('StatsStore', () => {
  it('returns zeroed stats for an unseen skill', () => {
    const s = new StatsStore();
    const st = s.getSkillStats('cipher');
    expect(st.attempts).toBe(0);
    expect(st.accuracy).toBe(0);
    expect(st.bestStreak).toBe(0);
  });

  it('records attempts and computes accuracy and streaks', () => {
    const s = new StatsStore();
    s.recordAttempt({ skill: 'cipher', correct: true, timeMs: 1000, difficulty: 1 });
    s.recordAttempt({ skill: 'cipher', correct: true, timeMs: 3000, difficulty: 1 });
    s.recordAttempt({ skill: 'cipher', correct: false, timeMs: 2000, difficulty: 1 });
    const st = s.getSkillStats('cipher');
    expect(st.attempts).toBe(3);
    expect(st.accuracy).toBeCloseTo(2 / 3);
    expect(st.avgTimeMs).toBe(2000);
    expect(st.bestStreak).toBe(2);
    expect(st.currentStreak).toBe(0);
  });

  it('persists across instances via localStorage', () => {
    const s1 = new StatsStore();
    s1.recordAttempt({ skill: 'logic', correct: true, timeMs: 500, difficulty: 2 });
    const s2 = new StatsStore();
    expect(s2.getSkillStats('logic').attempts).toBe(1);
  });

  it('survives corrupt localStorage', () => {
    localStorage.setItem('ert:v1', '{not json');
    const s = new StatsStore();
    expect(s.getSkillStats('pattern').attempts).toBe(0);
  });

  it('round-trips settings', () => {
    const s = new StatsStore();
    s.setSettings({ warmUpSeconds: 300, sound: false });
    expect(new StatsStore().getSettings().warmUpSeconds).toBe(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stats/StatsStore.test.ts`
Expected: FAIL — cannot find module './StatsStore'.

- [ ] **Step 3: Write `src/stats/StatsStore.ts`**

```ts
import type { Skill, Difficulty } from '../types';

export interface SkillStats {
  attempts: number;
  correct: number;
  accuracy: number;       // 0..1
  avgTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

export interface Attempt {
  skill: Skill;
  correct: boolean;
  timeMs: number;
  difficulty: Difficulty;
}

export interface Settings {
  warmUpSeconds: number;
  sound: boolean;
}

interface SkillRecord {
  attempts: number;
  correct: number;
  totalTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

interface Persisted {
  skills: Partial<Record<Skill, SkillRecord>>;
  settings: Settings;
}

const KEY = 'ert:v1';
const DEFAULT_SETTINGS: Settings = { warmUpSeconds: 420, sound: true };

function emptyRecord(): SkillRecord {
  return { attempts: 0, correct: 0, totalTimeMs: 0, bestStreak: 0, currentStreak: 0 };
}

export class StatsStore {
  private data: Persisted;

  constructor() {
    this.data = this.load();
  }

  private load(): Persisted {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { skills: {}, settings: { ...DEFAULT_SETTINGS } };
      const parsed = JSON.parse(raw) as Persisted;
      return {
        skills: parsed.skills ?? {},
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch {
      return { skills: {}, settings: { ...DEFAULT_SETTINGS } };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable/full: keep running in-memory */
    }
  }

  recordAttempt(a: Attempt): void {
    const rec = this.data.skills[a.skill] ?? emptyRecord();
    rec.attempts += 1;
    rec.totalTimeMs += a.timeMs;
    if (a.correct) {
      rec.correct += 1;
      rec.currentStreak += 1;
      rec.bestStreak = Math.max(rec.bestStreak, rec.currentStreak);
    } else {
      rec.currentStreak = 0;
    }
    this.data.skills[a.skill] = rec;
    this.save();
  }

  getSkillStats(skill: Skill): SkillStats {
    const rec = this.data.skills[skill] ?? emptyRecord();
    return {
      attempts: rec.attempts,
      correct: rec.correct,
      accuracy: rec.attempts ? rec.correct / rec.attempts : 0,
      avgTimeMs: rec.attempts ? Math.round(rec.totalTimeMs / rec.attempts) : 0,
      bestStreak: rec.bestStreak,
      currentStreak: rec.currentStreak,
    };
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  setSettings(s: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...s };
    this.save();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stats/StatsStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stats/
git commit -m "feat: StatsStore with localStorage persistence and stats math"
```

---

### Task 4: Adaptive difficulty

**Files:**
- Create: `src/engine/difficulty.ts`, `src/engine/difficulty.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/difficulty.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { nextDifficulty } from './difficulty';

describe('nextDifficulty', () => {
  it('increases when recent accuracy is high', () => {
    expect(nextDifficulty(2, [true, true, true, true, true])).toBe(3);
  });
  it('decreases when recent accuracy is low', () => {
    expect(nextDifficulty(3, [false, false, false, true, false])).toBe(2);
  });
  it('holds in the middle band', () => {
    expect(nextDifficulty(3, [true, false, true, false, true])).toBe(3);
  });
  it('caps at 5 and floors at 1', () => {
    expect(nextDifficulty(5, [true, true, true, true, true])).toBe(5);
    expect(nextDifficulty(1, [false, false, false, false, false])).toBe(1);
  });
  it('holds until the window has at least 3 samples', () => {
    expect(nextDifficulty(2, [true, true])).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/difficulty.test.ts`
Expected: FAIL — cannot find module './difficulty'.

- [ ] **Step 3: Write `src/engine/difficulty.ts`**

```ts
import type { Difficulty } from '../types';
import { clampDifficulty } from '../types';

const WINDOW = 5;
const MIN_SAMPLES = 3;
const UP = 0.8;
const DOWN = 0.4;

// Adjusts difficulty from the rolling window of recent correctness.
export function nextDifficulty(current: Difficulty, recent: boolean[]): Difficulty {
  const window = recent.slice(-WINDOW);
  if (window.length < MIN_SAMPLES) return current;
  const acc = window.filter(Boolean).length / window.length;
  if (acc >= UP) return clampDifficulty(current + 1);
  if (acc <= DOWN) return clampDifficulty(current - 1);
  return current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/difficulty.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/difficulty.ts src/engine/difficulty.test.ts
git commit -m "feat: adaptive difficulty from rolling accuracy window"
```

---

### Task 5: Cipher generator

**Files:**
- Create: `src/games/cipher.ts`, `src/games/cipher.test.ts`

- [ ] **Step 1: Write the failing test `src/games/cipher.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cipherGenerator } from './cipher';
import { mulberry32 } from '../rng';

describe('cipherGenerator', () => {
  it('produces a puzzle whose solution passes checkAnswer', () => {
    const p = cipherGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('cipher');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('checkAnswer is case- and whitespace-insensitive', () => {
    const p = cipherGenerator.generate(2, mulberry32(11));
    expect(p.checkAnswer(`  ${p.solution.toUpperCase()}  `)).toBe(true);
  });

  it('rejects wrong answers', () => {
    const p = cipherGenerator.generate(3, mulberry32(3));
    expect(p.checkAnswer(p.solution + 'x')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = cipherGenerator.generate(2, mulberry32(99));
    const b = cipherGenerator.generate(2, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/games/cipher.test.ts`
Expected: FAIL — cannot find module './cipher'.

- [ ] **Step 3: Write `src/games/cipher.ts`**

```ts
import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, shuffle, uid } from '../rng';

const WORDS = [
  'KEY', 'LOCK', 'DOOR', 'CODE', 'CLUE', 'SAFE', 'EXIT', 'MAP',
  'CIPHER', 'PUZZLE', 'SECRET', 'HIDDEN', 'ESCAPE', 'RIDDLE', 'VAULT',
];
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

function caesar(text: string, shift: number): string {
  return text.replace(/[A-Z]/g, (ch) =>
    String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65),
  );
}

type Kind = 'caesar' | 'a1z26' | 'morse' | 'binary' | 'substitution';

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['caesar', 'a1z26'];
  if (d <= 2) return ['caesar', 'a1z26', 'morse'];
  if (d <= 3) return ['caesar', 'a1z26', 'morse', 'binary'];
  return ['caesar', 'morse', 'binary', 'substitution'];
}

function wordFor(d: Difficulty, rng: Rng): string {
  const pool = d <= 2 ? WORDS.filter((w) => w.length <= 4) : WORDS;
  return pick(rng, pool);
}

function build(kind: Kind, word: string, d: Difficulty, rng: Rng): { prompt: string; hint: string } {
  switch (kind) {
    case 'caesar': {
      const shift = randInt(rng, 1, 25);
      return {
        prompt: `Caesar cipher (each letter shifted). Decode: ${caesar(word, shift)}`,
        hint: `The shift is ${shift}.`,
      };
    }
    case 'a1z26': {
      const code = word.split('').map((c) => c.charCodeAt(0) - 64).join('-');
      return { prompt: `A1Z26 (A=1 … Z=26). Decode: ${code}`, hint: 'Convert each number to its letter.' };
    }
    case 'morse': {
      const code = word.split('').map((c) => MORSE[c]).join(' / ');
      return { prompt: `Morse code. Decode: ${code}`, hint: '. = dot, - = dash; / separates letters.' };
    }
    case 'binary': {
      const code = word
        .split('')
        .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
      return { prompt: `Binary (8-bit ASCII). Decode: ${code}`, hint: 'Each group is one ASCII character.' };
    }
    case 'substitution': {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const shuffled = shuffle(rng, alphabet);
      const map: Record<string, string> = {};
      alphabet.forEach((c, i) => (map[c] = shuffled[i]));
      const enc = word.split('').map((c) => map[c]).join('');
      const sample = `A→${map['A']}, E→${map['E']}, T→${map['T']}`;
      void d;
      return { prompt: `Substitution cipher. Decode: ${enc}`, hint: `Sample mappings: ${sample}` };
    }
  }
}

export const cipherGenerator: PuzzleGenerator = {
  id: 'cipher',
  name: 'Ciphers & Codes',
  skill: 'cipher',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const kind = pick(rng, kindsFor(d));
    const word = wordFor(d, rng);
    const { prompt, hint } = build(kind, word, d, rng);
    return {
      id: uid('cipher'),
      skill: 'cipher',
      prompt,
      data: { kind },
      solution: word,
      hint,
      checkAnswer: (input: string) => normalize(input) === normalize(word),
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/games/cipher.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/cipher.ts src/games/cipher.test.ts
git commit -m "feat: cipher generator (caesar/a1z26/morse/binary/substitution)"
```

---

### Task 6: Pattern generator

**Files:**
- Create: `src/games/pattern.ts`, `src/games/pattern.test.ts`

- [ ] **Step 1: Write the failing test `src/games/pattern.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { patternGenerator } from './pattern';
import { mulberry32 } from '../rng';

describe('patternGenerator', () => {
  it('solution satisfies checkAnswer', () => {
    const p = patternGenerator.generate(2, mulberry32(8));
    expect(p.skill).toBe('pattern');
    expect(p.checkAnswer(p.solution)).toBe(true);
  });
  it('accepts solution with surrounding spaces', () => {
    const p = patternGenerator.generate(1, mulberry32(2));
    expect(p.checkAnswer(` ${p.solution} `)).toBe(true);
  });
  it('rejects a clearly wrong answer', () => {
    const p = patternGenerator.generate(3, mulberry32(4));
    expect(p.checkAnswer('definitely-not')).toBe(false);
  });
  it('is deterministic for a seed', () => {
    const a = patternGenerator.generate(2, mulberry32(50));
    const b = patternGenerator.generate(2, mulberry32(50));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/games/pattern.test.ts`
Expected: FAIL — cannot find module './pattern'.

- [ ] **Step 3: Write `src/games/pattern.ts`**

```ts
import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

type Rule = 'arithmetic' | 'geometric' | 'fibonacci' | 'squares' | 'alternating';

function rulesFor(d: Difficulty): Rule[] {
  if (d <= 1) return ['arithmetic'];
  if (d <= 2) return ['arithmetic', 'geometric'];
  if (d <= 3) return ['arithmetic', 'geometric', 'squares'];
  return ['arithmetic', 'geometric', 'squares', 'fibonacci', 'alternating'];
}

function sequence(rule: Rule, rng: Rng): { terms: number[]; next: number } {
  const len = 5;
  switch (rule) {
    case 'arithmetic': {
      const start = randInt(rng, 1, 9);
      const step = randInt(rng, 2, 9);
      const terms = Array.from({ length: len }, (_, i) => start + i * step);
      return { terms, next: start + len * step };
    }
    case 'geometric': {
      const start = randInt(rng, 1, 4);
      const ratio = randInt(rng, 2, 3);
      const terms = Array.from({ length: len }, (_, i) => start * ratio ** i);
      return { terms, next: start * ratio ** len };
    }
    case 'squares': {
      const start = randInt(rng, 1, 4);
      const terms = Array.from({ length: len }, (_, i) => (start + i) ** 2);
      return { terms, next: (start + len) ** 2 };
    }
    case 'fibonacci': {
      const a0 = randInt(rng, 1, 4);
      const b0 = randInt(rng, 1, 4);
      const terms = [a0, b0];
      while (terms.length < len) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
      return { terms, next: terms[len - 1] + terms[len - 2] };
    }
    case 'alternating': {
      const a = randInt(rng, 1, 5);
      const b = randInt(rng, 1, 5);
      const stepA = randInt(rng, 2, 5);
      const stepB = randInt(rng, 2, 5);
      const terms: number[] = [];
      let va = a;
      let vb = b;
      for (let i = 0; i < len; i++) {
        if (i % 2 === 0) { terms.push(va); va += stepA; }
        else { terms.push(vb); vb += stepB; }
      }
      const next = len % 2 === 0 ? va : vb;
      return { terms, next };
    }
  }
}

export const patternGenerator: PuzzleGenerator = {
  id: 'pattern',
  name: 'Pattern & Sequence',
  skill: 'pattern',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const rule = pick(rng, rulesFor(d));
    const { terms, next } = sequence(rule, rng);
    const solution = String(next);
    return {
      id: uid('pattern'),
      skill: 'pattern',
      prompt: `What number comes next?  ${terms.join(', ')}, ?`,
      data: { terms },
      solution,
      hint: 'Look at how each term changes from the one before it.',
      checkAnswer: (input: string) => normalize(input).replace(/[, ]/g, '') === solution,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/games/pattern.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/pattern.ts src/games/pattern.test.ts
git commit -m "feat: pattern/sequence generator with rule families"
```

---

### Task 7: Observation generator

**Files:**
- Create: `src/games/observation.ts`, `src/games/observation.test.ts`

- [ ] **Step 1: Write the failing test `src/games/observation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { observationGenerator, type ObservationData } from './observation';
import { mulberry32 } from '../rng';

describe('observationGenerator', () => {
  it('builds a grid and an answerable question', () => {
    const p = observationGenerator.generate(2, mulberry32(6));
    const data = p.data as ObservationData;
    expect(data.grid.length).toBeGreaterThan(0);
    expect(data.flashMs).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });
  it('grid grows with difficulty', () => {
    const small = observationGenerator.generate(1, mulberry32(1)).data as ObservationData;
    const big = observationGenerator.generate(5, mulberry32(1)).data as ObservationData;
    expect(big.grid.length).toBeGreaterThanOrEqual(small.grid.length);
  });
  it('rejects a wrong count', () => {
    const p = observationGenerator.generate(2, mulberry32(6));
    expect(p.checkAnswer(String(Number(p.solution) + 1))).toBe(false);
  });
  it('is deterministic for a seed', () => {
    const a = observationGenerator.generate(3, mulberry32(21));
    const b = observationGenerator.generate(3, mulberry32(21));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/games/observation.test.ts`
Expected: FAIL — cannot find module './observation'.

- [ ] **Step 3: Write `src/games/observation.ts`**

```ts
import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, uid } from '../rng';

const SYMBOLS = ['🔑', '🗝️', '🔒', '💡', '📜', '⭐', '❌', '🔴', '🔵', '🟢'];

export interface ObservationData {
  grid: string[];     // flattened row-major
  cols: number;
  flashMs: number;
  target: string;     // the symbol being counted
}

function dims(d: Difficulty): { cols: number; rows: number; flashMs: number } {
  const cols = 2 + d;          // 3..7
  const rows = 2 + Math.ceil(d / 2);
  const flashMs = Math.max(1200, 4000 - d * 500);
  return { cols, rows, flashMs };
}

export const observationGenerator: PuzzleGenerator = {
  id: 'observation',
  name: 'Observation & Memory',
  skill: 'observation',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const { cols, rows, flashMs } = dims(d);
    const palette = SYMBOLS.slice(0, Math.min(SYMBOLS.length, 3 + d));
    const grid = Array.from({ length: cols * rows }, () => pick(rng, palette));
    const target = pick(rng, palette);
    const count = grid.filter((c) => c === target).length;
    const solution = String(count);
    return {
      id: uid('obs'),
      skill: 'observation',
      prompt: `Memorize the grid. How many ${target} did you see?`,
      data: { grid, cols, flashMs, target } satisfies ObservationData,
      solution,
      hint: 'Scan row by row before the grid hides.',
      checkAnswer: (input: string) => input.trim() === solution,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/games/observation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/observation.ts src/games/observation.test.ts
git commit -m "feat: observation/memory grid generator"
```

---

### Task 8: Logic & Lateral generator

**Files:**
- Create: `src/games/logic.ts`, `src/games/logic.test.ts`

- [ ] **Step 1: Write the failing test `src/games/logic.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { logicGenerator } from './logic';
import { mulberry32 } from '../rng';

describe('logicGenerator', () => {
  it('solution satisfies checkAnswer', () => {
    const p = logicGenerator.generate(2, mulberry32(9));
    expect(p.skill).toBe('logic');
    expect(p.checkAnswer(p.solution)).toBe(true);
  });
  it('checkAnswer accepts case-insensitive answers', () => {
    const p = logicGenerator.generate(1, mulberry32(13));
    expect(p.checkAnswer(p.solution.toUpperCase())).toBe(true);
  });
  it('rejects empty input', () => {
    const p = logicGenerator.generate(2, mulberry32(9));
    expect(p.checkAnswer('')).toBe(false);
  });
  it('is deterministic for a seed', () => {
    const a = logicGenerator.generate(2, mulberry32(77));
    const b = logicGenerator.generate(2, mulberry32(77));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/games/logic.test.ts`
Expected: FAIL — cannot find module './logic'.

- [ ] **Step 3: Write `src/games/logic.ts`**

A curated riddle set (low difficulties) plus a generated "who-owns-what" deduction (higher difficulties).

```ts
import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, shuffle, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

interface Riddle { q: string; a: string[]; hint: string }

const RIDDLES: Riddle[] = [
  { q: 'The more you take, the more you leave behind. What am I?', a: ['footsteps', 'steps'], hint: 'You make them when you walk.' },
  { q: 'What has keys but no locks, space but no room, and you can enter but not go in?', a: ['keyboard', 'a keyboard'], hint: 'You are using one now.' },
  { q: 'What has hands but cannot clap?', a: ['clock', 'a clock'], hint: 'It tells you something all day.' },
  { q: 'What gets wetter the more it dries?', a: ['towel', 'a towel'], hint: 'You use it after a shower.' },
  { q: 'I have cities but no houses, mountains but no trees, water but no fish. What am I?', a: ['map', 'a map'], hint: 'You unfold it to find your way.' },
  { q: 'What can travel around the world while staying in a corner?', a: ['stamp', 'a stamp'], hint: 'It goes on an envelope.' },
  { q: 'What has a neck but no head?', a: ['bottle', 'a bottle'], hint: 'You drink from it.' },
  { q: 'Forward I am heavy, backward I am not. What am I?', a: ['ton'], hint: 'Spell it backward.' },
];

// Generated deduction: N people each own one distinct item; clues fix the arrangement.
const PEOPLE = ['Ava', 'Ben', 'Cara', 'Dan', 'Eve'];
const ITEMS = ['the key', 'the map', 'the candle', 'the note', 'the coin'];

function deduction(d: Difficulty, rng: Rng): { prompt: string; solution: string; hint: string } {
  const n = Math.min(5, 2 + d); // 4..5 at high difficulty
  const people = PEOPLE.slice(0, n);
  const items = shuffle(rng, ITEMS.slice(0, n));
  // assignment[i] = item owned by people[i]
  const assignment = items;
  const clues: string[] = [];
  for (let i = 0; i < n; i++) {
    clues.push(`${people[i]} owns ${assignment[i]}.`);
  }
  // Hide one fact and ask for it; give the rest as clues.
  const hideIdx = Math.floor(rng() * n);
  const shownClues = clues.filter((_, i) => i !== hideIdx);
  const target = people[hideIdx];
  const answer = assignment[hideIdx].replace(/^the /, '');
  const prompt =
    `Each person owns exactly one distinct item. Given:\n` +
    shownClues.map((c) => `• ${c}`).join('\n') +
    `\nWhat does ${target} own? (one word)`;
  return { prompt, solution: answer, hint: 'By elimination, find the only item left.' };
}

export const logicGenerator: PuzzleGenerator = {
  id: 'logic',
  name: 'Logic & Lateral',
  skill: 'logic',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    if (d <= 2) {
      const r = pick(rng, RIDDLES);
      const accept = r.a.map(normalize);
      return {
        id: uid('logic'),
        skill: 'logic',
        prompt: r.q,
        data: { kind: 'riddle' },
        solution: r.a[0],
        hint: r.hint,
        checkAnswer: (input: string) => accept.includes(normalize(input)),
      };
    }
    const { prompt, solution, hint } = deduction(d, rng);
    return {
      id: uid('logic'),
      skill: 'logic',
      prompt,
      data: { kind: 'deduction' },
      solution,
      hint,
      checkAnswer: (input: string) => normalize(input) === normalize(solution),
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/games/logic.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/logic.ts src/games/logic.test.ts
git commit -m "feat: logic/lateral generator (riddles + deduction)"
```

---

### Task 9: Generator registry

**Files:**
- Create: `src/games/index.ts`, `src/games/index.test.ts`

- [ ] **Step 1: Write the failing test `src/games/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { GENERATORS, getGenerator } from './index';

describe('generator registry', () => {
  it('contains all four skills', () => {
    expect(GENERATORS.map((g) => g.skill).sort()).toEqual(
      ['cipher', 'logic', 'observation', 'pattern'],
    );
  });
  it('looks up by skill', () => {
    expect(getGenerator('cipher').id).toBe('cipher');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/games/index.test.ts`
Expected: FAIL — cannot find module './index' exports.

- [ ] **Step 3: Write `src/games/index.ts`**

```ts
import type { PuzzleGenerator, Skill } from '../types';
import { cipherGenerator } from './cipher';
import { patternGenerator } from './pattern';
import { observationGenerator } from './observation';
import { logicGenerator } from './logic';

export const GENERATORS: PuzzleGenerator[] = [
  cipherGenerator,
  patternGenerator,
  observationGenerator,
  logicGenerator,
];

export function getGenerator(skill: Skill): PuzzleGenerator {
  const g = GENERATORS.find((x) => x.skill === skill);
  if (!g) throw new Error(`No generator for skill: ${skill}`);
  return g;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/games/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/index.ts src/games/index.test.ts
git commit -m "feat: generator registry"
```

---

### Task 10: Puzzle views + registry

**Files:**
- Create: `src/views/CipherView.tsx`, `src/views/PatternView.tsx`, `src/views/ObservationView.tsx`, `src/views/LogicView.tsx`, `src/views/index.ts`

These are presentational. `CipherView`, `PatternView`, `LogicView` only render the prompt (the `GamePlayer` owns the input box). `ObservationView` is special: it flashes the grid, then hides it.

- [ ] **Step 1: Write `src/views/CipherView.tsx`**

```tsx
import type { Puzzle } from '../types';

export function CipherView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-800 p-4 text-lg text-emerald-300">
      {puzzle.prompt}
    </pre>
  );
}
```

- [ ] **Step 2: Write `src/views/PatternView.tsx`**

```tsx
import type { Puzzle } from '../types';

export function PatternView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <p className="rounded-lg bg-slate-800 p-4 text-2xl font-mono text-sky-300">
      {puzzle.prompt}
    </p>
  );
}
```

- [ ] **Step 3: Write `src/views/LogicView.tsx`**

```tsx
import type { Puzzle } from '../types';

export function LogicView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-slate-800 p-4 text-lg text-amber-200">
      {puzzle.prompt}
    </pre>
  );
}
```

- [ ] **Step 4: Write `src/views/ObservationView.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Puzzle } from '../types';
import type { ObservationData } from '../games/observation';

export function ObservationView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as ObservationData;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), data.flashMs);
    return () => clearTimeout(t);
  }, [puzzle.id, data.flashMs]);

  return (
    <div className="rounded-lg bg-slate-800 p-4">
      {visible ? (
        <div
          className="grid gap-2 text-3xl"
          style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))` }}
        >
          {data.grid.map((sym, i) => (
            <span key={i} className="text-center">{sym}</span>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-lg text-slate-300">{puzzle.prompt}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/views/index.ts`**

```ts
import type { ComponentType } from 'react';
import type { Puzzle, Skill } from '../types';
import { CipherView } from './CipherView';
import { PatternView } from './PatternView';
import { ObservationView } from './ObservationView';
import { LogicView } from './LogicView';

export const VIEWS: Record<Skill, ComponentType<{ puzzle: Puzzle }>> = {
  cipher: CipherView,
  pattern: PatternView,
  observation: ObservationView,
  logic: LogicView,
};
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/views/
git commit -m "feat: puzzle views and skill->view registry"
```

---

### Task 11: GamePlayer engine

**Files:**
- Create: `src/engine/GamePlayer.tsx`, `src/engine/GamePlayer.test.tsx`

`GamePlayer` is generic: it takes a function that supplies the next puzzle (`nextPuzzle`) and an `onResult` callback, renders the puzzle's view, an input box, Submit / Hint / Reveal, and a Next button after answering.

- [ ] **Step 1: Write the failing test `src/engine/GamePlayer.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GamePlayer } from './GamePlayer';
import { cipherGenerator } from '../games/cipher';
import { mulberry32 } from '../rng';

function fixedPuzzle() {
  return cipherGenerator.generate(1, mulberry32(7));
}

describe('GamePlayer', () => {
  it('reports a correct result when the right answer is submitted', () => {
    const puzzle = fixedPuzzle();
    const onResult = vi.fn();
    render(<GamePlayer nextPuzzle={() => puzzle} onResult={onResult} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: puzzle.solution } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, skill: 'cipher' }));
  });

  it('shows the solution after reveal', () => {
    const puzzle = fixedPuzzle();
    render(<GamePlayer nextPuzzle={() => puzzle} onResult={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText(new RegExp(puzzle.solution, 'i'))).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/GamePlayer.test.tsx`
Expected: FAIL — cannot find module './GamePlayer'.

- [ ] **Step 3: Write `src/engine/GamePlayer.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { Puzzle, Skill, Difficulty } from '../types';
import { VIEWS } from '../views';

export interface GameResult {
  skill: Skill;
  correct: boolean;
  timeMs: number;
  difficulty: Difficulty;
}

interface Props {
  nextPuzzle: () => Puzzle;
  difficulty?: Difficulty;
  onResult: (r: GameResult) => void;
  onAdvance?: () => void; // called when user clicks Next
}

export function GamePlayer({ nextPuzzle, difficulty = 1, onResult, onAdvance }: Props) {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle());
  const [input, setInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const View = VIEWS[puzzle.skill];
  const answered = verdict !== null || revealed;

  function submit() {
    if (answered) return;
    const correct = puzzle.checkAnswer(input);
    setVerdict(correct);
    onResult({ skill: puzzle.skill, correct, timeMs: Date.now() - startedAt, difficulty });
  }

  function reveal() {
    if (verdict === null) {
      onResult({ skill: puzzle.skill, correct: false, timeMs: Date.now() - startedAt, difficulty });
    }
    setRevealed(true);
  }

  function next() {
    setPuzzle(nextPuzzle());
    setInput('');
    setShowHint(false);
    setRevealed(false);
    setVerdict(null);
    setStartedAt(Date.now());
    onAdvance?.();
  }

  const key = useMemo(() => puzzle.id, [puzzle]);

  return (
    <div key={key} className="flex flex-col gap-4">
      <View puzzle={puzzle} />

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Your answer"
        className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-lg text-white"
        disabled={answered}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={submit}
          disabled={answered}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Submit
        </button>
        <button
          onClick={() => setShowHint(true)}
          className="rounded-lg bg-slate-600 px-4 py-2 text-white"
        >
          Hint
        </button>
        <button
          onClick={reveal}
          className="rounded-lg bg-slate-600 px-4 py-2 text-white"
        >
          Reveal
        </button>
        {answered && (
          <button
            onClick={next}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white"
          >
            Next
          </button>
        )}
      </div>

      {showHint && puzzle.hint && <p className="text-sm text-amber-300">💡 {puzzle.hint}</p>}
      {verdict === true && <p className="font-semibold text-emerald-400">Correct! 🎉</p>}
      {verdict === false && !revealed && <p className="font-semibold text-rose-400">Not quite.</p>}
      {revealed && <p className="text-slate-200">Answer: <strong>{puzzle.solution}</strong></p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/GamePlayer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/GamePlayer.tsx src/engine/GamePlayer.test.tsx
git commit -m "feat: generic GamePlayer engine"
```

---

### Task 12: Train mode

**Files:**
- Create: `src/modes/Train.tsx`

Train wires a single skill's generator into `GamePlayer`, tracks recent correctness, and adapts difficulty.

- [ ] **Step 1: Write `src/modes/Train.tsx`**

```tsx
import { useRef, useState } from 'react';
import type { Skill, Difficulty } from '../types';
import { getGenerator } from '../games';
import { GamePlayer, type GameResult } from '../engine/GamePlayer';
import { nextDifficulty } from '../engine/difficulty';
import { StatsStore } from '../stats/StatsStore';

const store = new StatsStore();

export function Train({ skill, onExit }: { skill: Skill; onExit: () => void }) {
  const generator = getGenerator(skill);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const recent = useRef<boolean[]>([]);
  const [solved, setSolved] = useState(0);

  function handleResult(r: GameResult) {
    store.recordAttempt({ skill: r.skill, correct: r.correct, timeMs: r.timeMs, difficulty });
    recent.current = [...recent.current, r.correct].slice(-5);
    setDifficulty((d) => nextDifficulty(d, recent.current));
    if (r.correct) setSolved((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{generator.name}</h2>
        <div className="text-sm text-slate-300">
          Level {difficulty} · Solved {solved}
        </div>
      </header>
      <GamePlayer
        nextPuzzle={() => generator.generate(difficulty)}
        difficulty={difficulty}
        onResult={handleResult}
      />
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        ← Back to home
      </button>
    </div>
  );
}
```

> Note: `useRef` is imported from `react` — fix the import to `import { useRef, useState } from 'react';` (already shown). Confirm React's `useRef` is used, not a typo.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modes/Train.tsx
git commit -m "feat: Train mode with adaptive difficulty"
```

---

### Task 13: Warm-Up mode

**Files:**
- Create: `src/modes/WarmUpSession.tsx`

Warm-Up draws random generators across all skills for a fixed time, then shows a readiness summary.

- [ ] **Step 1: Write `src/modes/WarmUpSession.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../types';
import { GENERATORS } from '../games';
import { GamePlayer, type GameResult } from '../engine/GamePlayer';
import { StatsStore } from '../stats/StatsStore';

const store = new StatsStore();
const WARMUP_DIFFICULTY: Difficulty = 3;

function pickGenerator() {
  return GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
}

export function WarmUpSession({ onExit }: { onExit: () => void }) {
  const totalSeconds = store.getSettings().warmUpSeconds;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [done, setDone] = useState(false);
  const stats = useRef({ attempts: 0, correct: 0 });

  useEffect(() => {
    if (done) return;
    if (remaining <= 0) { setDone(true); return; }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, done]);

  function handleResult(r: GameResult) {
    store.recordAttempt({ skill: r.skill, correct: r.correct, timeMs: r.timeMs, difficulty: WARMUP_DIFFICULTY });
    stats.current.attempts += 1;
    if (r.correct) stats.current.correct += 1;
  }

  if (done) {
    const { attempts, correct } = stats.current;
    const score = attempts ? Math.round((correct / attempts) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h2 className="text-2xl font-bold text-white">Warm-Up Complete</h2>
        <p className="mt-4 text-6xl font-black text-emerald-400">{score}</p>
        <p className="text-slate-300">readiness score · {correct}/{attempts} solved</p>
        <p className="mt-4 text-slate-400">
          {score >= 70 ? 'Sharp and primed — go crush that escape room! 🔓' : 'Brain is warming up. Take a breath and trust your instincts.'}
        </p>
        <button onClick={onExit} className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-white">
          Done
        </button>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Warm-Up</h2>
        <span className="font-mono text-lg text-amber-300">{mm}:{ss}</span>
      </header>
      <GamePlayer
        nextPuzzle={() => pickGenerator().generate(WARMUP_DIFFICULTY)}
        difficulty={WARMUP_DIFFICULTY}
        onResult={handleResult}
      />
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        End early
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modes/WarmUpSession.tsx
git commit -m "feat: timed Warm-Up mode with readiness score"
```

---

### Task 14: Dashboard

**Files:**
- Create: `src/components/Dashboard.tsx`

- [ ] **Step 1: Write `src/components/Dashboard.tsx`**

```tsx
import type { Skill } from '../types';
import { GENERATORS } from '../games';
import { StatsStore } from '../stats/StatsStore';

const store = new StatsStore();

export function Dashboard({ onExit }: { onExit: () => void }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-bold text-white">Your Progress</h2>
      <div className="grid gap-3">
        {GENERATORS.map((g) => {
          const s = store.getSkillStats(g.skill as Skill);
          return (
            <div key={g.id} className="rounded-lg bg-slate-800 p-4">
              <h3 className="font-semibold text-white">{g.name}</h3>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-sm text-slate-300">
                <div><dt>Attempts</dt><dd className="text-lg text-white">{s.attempts}</dd></div>
                <div><dt>Accuracy</dt><dd className="text-lg text-white">{Math.round(s.accuracy * 100)}%</dd></div>
                <div><dt>Avg time</dt><dd className="text-lg text-white">{(s.avgTimeMs / 1000).toFixed(1)}s</dd></div>
                <div><dt>Best streak</dt><dd className="text-lg text-white">{s.bestStreak}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        ← Back to home
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: progress dashboard"
```

---

### Task 15: Home + App wiring

**Files:**
- Create: `src/components/Home.tsx`
- Modify: `src/App.tsx` (replace), `src/main.tsx` (verify imports index.css)

- [ ] **Step 1: Write `src/components/Home.tsx`**

```tsx
import type { Skill } from '../types';
import { GENERATORS } from '../games';

interface Props {
  onTrain: (skill: Skill) => void;
  onWarmUp: () => void;
  onDashboard: () => void;
}

export function Home({ onTrain, onWarmUp, onDashboard }: Props) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-black text-white">🔓 Escape Room Brain Trainer</h1>
      <p className="mt-2 text-slate-300">Train the skills. Prime your brain. Beat the room.</p>

      <button
        onClick={onWarmUp}
        className="mt-6 w-full rounded-xl bg-amber-500 p-5 text-left text-lg font-bold text-slate-900"
      >
        ⏱️ Start Warm-Up
        <span className="block text-sm font-normal text-slate-800">~7 min mixed primer before a real room</span>
      </button>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-white">Train a skill</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            onClick={() => onTrain(g.skill as Skill)}
            className="rounded-xl bg-slate-800 p-4 text-left text-white hover:bg-slate-700"
          >
            {g.name}
          </button>
        ))}
      </div>

      <button onClick={onDashboard} className="mt-8 text-sm text-sky-400 underline">
        View progress →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useState } from 'react';
import type { Skill } from './types';
import { Home } from './components/Home';
import { Train } from './modes/Train';
import { WarmUpSession } from './modes/WarmUpSession';
import { Dashboard } from './components/Dashboard';

type Screen =
  | { name: 'home' }
  | { name: 'train'; skill: Skill }
  | { name: 'warmup' }
  | { name: 'dashboard' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

  return (
    <main className="min-h-screen bg-slate-950">
      {screen.name === 'home' && (
        <Home
          onTrain={(skill) => setScreen({ name: 'train', skill })}
          onWarmUp={() => setScreen({ name: 'warmup' })}
          onDashboard={() => setScreen({ name: 'dashboard' })}
        />
      )}
      {screen.name === 'train' && <Train skill={screen.skill} onExit={home} />}
      {screen.name === 'warmup' && <WarmUpSession onExit={home} />}
      {screen.name === 'dashboard' && <Dashboard onExit={home} />}
    </main>
  );
}
```

- [ ] **Step 3: Verify `src/main.tsx` imports `./index.css`**

Open `src/main.tsx`; ensure it contains `import './index.css';`. If missing, add it.

- [ ] **Step 4: Run full test suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the URL. Verify: Home renders; each skill's Train works (submit/hint/reveal/next); Observation grid flashes then hides; Warm-Up counts down and shows a score; Dashboard shows updated stats after playing.

- [ ] **Step 6: Commit**

```bash
git add src/components/Home.tsx src/App.tsx src/main.tsx
git commit -m "feat: Home screen and app screen routing"
```

---

## Self-Review Notes

**Spec coverage check:**
- Two modes (Train + Warm-Up) → Tasks 12, 13. ✓
- Four skill modules → Tasks 5–8. ✓
- Local-first, no backend → no server tasks; localStorage only. ✓
- Progress persistence + dashboard → Tasks 3, 14. ✓
- Adaptive difficulty (Train) → Task 4 + wired in Task 12. ✓
- PuzzleGenerator/Puzzle interface as the shared unit → Task 2 + every generator. ✓
- Seeded RNG for testable pure generators → Task 2; used in every generator test. ✓
- Graceful localStorage degradation → Task 3 (try/catch). ✓
- PWA-ready file layout (no PWA build) → layout matches spec; PWA deferred. ✓

**Type consistency check:**
- `GameResult` (Task 11) fields `{skill, correct, timeMs, difficulty}` match `StatsStore.recordAttempt`'s `Attempt` (Task 3). ✓
- `ObservationData` exported from `games/observation.ts` (Task 7) and imported by `ObservationView` (Task 10). ✓
- `getGenerator` / `GENERATORS` (Task 9) used by Train, WarmUp, Dashboard, Home. ✓
- `nextDifficulty(current, recent)` signature (Task 4) matches call in Train (Task 12). ✓

**Note for implementer:** `Date.now()` is used in `GamePlayer`/`WarmUpSession` for real timing — this is correct in production app code (the no-`Date.now()` restriction applies only to workflow scripts, not to the app being built).
