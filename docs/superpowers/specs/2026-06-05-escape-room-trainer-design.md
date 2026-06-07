# Escape Room Brain Trainer — Design Spec

**Date:** 2026-06-05
**Status:** Approved, pending spec review

## Purpose

A personal brain-training web app that builds and primes the cognitive skills used to
solve escape-room puzzles. It serves two needs from one engine:

1. **Train** — practice a chosen skill with an endless, difficulty-adapting stream of puzzles.
2. **Warm-Up** — a timed (~7 min) mixed session run right before a real escape room,
   ending with a "readiness score" that primes the brain into puzzle-solving mode.

## Goals & Non-Goals

**Goals**
- Four skill modules: Ciphers & Codes, Pattern & Sequence, Observation & Memory, Logic & Lateral.
- Local-first: runs in the browser from a local dev server, no backend, no account.
- Progress persisted across sessions (per-skill accuracy, average solve time, best streak).
- Adaptive difficulty within a Train session based on recent accuracy.
- Architecture that makes adding a 5th game a single-module change.
- PWA-ready: structured so offline/installable support is a later config step, not a rewrite.

**Non-Goals (YAGNI)**
- No backend, database, server-side accounts, or auth.
- No multiplayer or leaderboards.
- No deployment in this iteration (local only; PWA/deploy is a future iteration).
- No full multi-step "simulated escape room" scenarios (explicitly deferred).

## Tech Stack

- **Vite + React + TypeScript** — fast local dev, simple SPA, no server needed.
- **Tailwind CSS** — quick, consistent, polished styling.
- **localStorage** — the entire persistence layer (stats + settings).
- **Vitest + React Testing Library** — unit tests for generators/checkers, light UI tests.
- PWA (`vite-plugin-pwa`) is **out of scope** here but the file layout anticipates it.

## Core Architecture

Everything reuses one interface. Each mini-game is a self-contained module exporting a
`PuzzleGenerator`. Modes (Train, Warm-Up) and stats are generic over this interface and
never special-case a specific game.

```ts
type Skill = 'cipher' | 'pattern' | 'observation' | 'logic';
type Difficulty = 1 | 2 | 3 | 4 | 5;

interface Puzzle {
  id: string;                       // unique per generated instance
  skill: Skill;
  prompt: string;                   // human-readable instruction
  data: unknown;                    // game-specific render payload
  checkAnswer(input: string): boolean;
  solution: string;                 // canonical answer, for reveal
  hint?: string;
}

interface PuzzleGenerator {
  id: string;                       // e.g. 'cipher'
  name: string;                     // e.g. 'Ciphers & Codes'
  skill: Skill;
  generate(difficulty: Difficulty): Puzzle;
}
```

**Design rules:**
- `generate(difficulty)` is a **pure function** (deterministic given an injected RNG;
  see Randomness below) — directly unit-testable.
- `checkAnswer` normalizes input (trim, case-fold, strip punctuation where appropriate)
  so near-correct answers count.
- Generators never touch the DOM, localStorage, or timers.

### Randomness

Generators take randomness via an injected `rng: () => number` (defaulting to `Math.random`)
so tests can pass a seeded RNG and assert exact puzzles. This keeps generators pure and
testable while staying ergonomic in production.

## Components

- **`App`** — routing between Home, Train, Warm-Up, Dashboard (simple state-based router; no router lib needed).
- **`Home`** — entry screen: Start Train (choose skill), Start Warm-Up, View Progress.
- **`GamePlayer`** — the generic engine. Given a generator + difficulty source, it:
  generates a puzzle → renders the matching puzzle view → accepts input → calls
  `checkAnswer` → records the result → advances. Used by both modes.
- **Puzzle views** — one presentational component per skill that renders `Puzzle.data`
  and collects input (e.g. `CipherView`, `PatternView`, `ObservationView`, `LogicView`).
  A registry maps `skill → view component`.
- **`WarmUpSession`** — wraps `GamePlayer`: fixed timer (~7 min, configurable), draws
  random generators across all skills, tracks score, shows readiness summary at the end.
- **`Dashboard`** — reads stats store, shows per-skill accuracy / avg time / best streak.

## The Four Skill Modules

1. **Ciphers & Codes** (`cipher`) — Caesar shift, simple substitution, A1Z26 (letter↔number),
   Morse, binary→text. Difficulty scales message length and cipher complexity. Answer is the
   decoded plaintext (or encoded text for reverse puzzles).
2. **Pattern & Sequence** (`pattern`) — next-in-sequence (numeric/symbolic), find-the-rule,
   odd-one-out. Difficulty scales rule complexity and sequence length.
3. **Observation & Memory** (`observation`) — flash a grid of symbols/colors for a few
   seconds, hide it, then ask a recall question ("how many red?", "what was at row 2 col 3?").
   Difficulty scales grid size and flash brevity.
4. **Logic & Lateral** (`logic`) — small logic-grid deduction puzzles generated from
   constraints, plus a curated set of lateral-thinking riddles. Difficulty scales grid
   dimensions / riddle obliqueness.

## Data Flow

```
Home → choose mode/skill
  → GamePlayer.generate(difficulty)
    → render matching puzzle view
      → user submits input
        → checkAnswer(input)
          → record result (correct?, timeMs) to StatsStore
          → adjust difficulty (Train) or advance round (Warm-Up)
          → next puzzle  (or end → summary)
```

## Persistence & Stats

`StatsStore` is a thin module over localStorage exposing:
- `recordAttempt({ skill, correct, timeMs, difficulty })`
- `getSkillStats(skill)` → `{ attempts, accuracy, avgTimeMs, bestStreak, currentStreak }`
- `getSettings()` / `setSettings()` (warm-up duration, sound on/off).

Stored under a single namespaced key (e.g. `ert:v1`). All reads guard against
absent/corrupt localStorage (try/catch → sane defaults) so a wiped or unavailable store
degrades gracefully rather than crashing.

## Adaptive Difficulty (Train mode)

Track a rolling window of the last N (default 5) attempts for the active skill.
- accuracy ≥ 80% over the window → difficulty + 1 (cap 5)
- accuracy ≤ 40% over the window → difficulty − 1 (floor 1)
- otherwise hold.
Warm-Up uses a fixed mid-level difficulty curve rather than adapting (it's a primer, not a tutor).

## Error Handling

- No network → no network error paths.
- localStorage absent/full/corrupt → caught; fall back to in-memory defaults, app still runs.
- Generators validate difficulty into the 1–5 range (clamp).
- `checkAnswer` always receives a string; empty input is simply "incorrect", never throws.

## Testing Strategy

- **Unit (TDD, primary):** every generator with a seeded RNG produces the expected puzzle;
  every `checkAnswer` accepts canonical + reasonable variants and rejects wrong answers;
  `StatsStore` math (accuracy, streaks, rolling difficulty) is correct; adaptive-difficulty
  logic moves the right direction at the thresholds.
- **Component (lighter):** `GamePlayer` advances on correct/incorrect; Warm-Up ends on timer;
  Dashboard renders stored stats.

## Proposed File Layout

```
src/
  main.tsx, App.tsx
  types.ts                       // Skill, Difficulty, Puzzle, PuzzleGenerator
  games/
    index.ts                     // generator registry
    cipher.ts  pattern.ts  observation.ts  logic.ts
    *.test.ts
  views/
    CipherView.tsx  PatternView.tsx  ObservationView.tsx  LogicView.tsx
    index.ts                     // skill → view registry
  engine/
    GamePlayer.tsx
    difficulty.ts  (+ test)
  modes/
    Train.tsx  WarmUpSession.tsx
  stats/
    StatsStore.ts  (+ test)
  components/
    Home.tsx  Dashboard.tsx
docs/superpowers/specs/2026-06-05-escape-room-trainer-design.md
```

## Build Sequence (for the implementation plan)

1. Scaffold Vite+React+TS+Tailwind+Vitest; define `types.ts`.
2. `StatsStore` + tests; `difficulty.ts` + tests.
3. One generator end-to-end (cipher) + tests; its view; `GamePlayer`; wire Train mode.
4. Remaining three generators + views + tests.
5. Warm-Up mode + readiness summary.
6. Dashboard + Home polish.
