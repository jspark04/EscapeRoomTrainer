# Meaty Enhancements — Design Spec

**Date:** 2026-06-07
**Status:** Approved (puzzle variety + teaching coaching + visual polish; no gamification, no PWA)

## Purpose

Make the Escape Room Brain Trainer substantial: more puzzle variety and depth, built-in
"teach me the technique" coaching so the user actually learns to crack puzzles (the real
"prime my brain" goal), and a polished feel. Explicitly out of scope: progression/gamification
(XP, badges, daily challenge, streak-as-game) and the PWA/mobile build.

## Three workstreams

### 1. Puzzle variety & depth

**Expand the four existing generators** (keep all existing kinds + tests green; add variants gated by difficulty; populate `explanation` on every puzzle):
- **cipher**: add `atbash`, `reverse`, `railfence`, `keypad` (phone T9), and `vigenere` (high difficulty) to the existing caesar/a1z26/morse/binary/substitution.
- **pattern**: add `letters` (alphabet sequences, e.g. A,C,E,G→I), `alternating-op`, and `repeat-step` rules to the existing numeric rules.
- **observation**: add `whatchanged` (grid shown, hidden, re-shown with one change — name the change) and `position` (recall the symbol at row R col C) to the existing `count` kind. Requires `ObservationView` to render multiple sub-kinds.
- **logic**: add `analogy` (A:B :: C:?) and more riddles + an extra deduction shape to the existing riddle/deduction split.

**Add four new skills** (new generator + test + view + technique entry each):
- **combination** (`Combination Locks`): deduce a numeric code from clues ("3 digits", "all even", "sum is 12", "no repeats", "the 2nd digit is larger than the 1st"). Solution is the code string.
- **anagram** (`Anagrams & Words`): unscramble a themed word; solution is the word. Accepts case-insensitively.
- **math** (`Mental Math`): timed arithmetic and "what value makes this true" (e.g. `7 × ? = 56`). Solution numeric.
- **spatial** (`Spatial Reasoning`): directional reasoning ("facing North, turn right twice — which way are you facing?") and grid-path counting. Solution a direction word or a number.

→ **8 skills total.** All flow automatically through Train, Warm-Up, Dashboard, and stats because they share the `PuzzleGenerator` contract.

### 2. Teach-the-technique coaching

- **Per-puzzle explanation:** add optional `explanation?: string` to `Puzzle`. Every generator fills it with the method for *that instance* ("Caesar shift 5 — shift each letter back until words appear; ROT13 is the classic shift-13 variant"). `GamePlayer` shows it once the puzzle is answered or revealed.
- **Techniques screen:** `src/coach/techniques.ts` holds one `Technique` per skill: `{ skill, title, whatToLookFor[], howToCrack[], example{puzzle,solution,walkthrough} }`. A `Techniques` screen (reachable from Home) renders them as expandable cards. This is the standalone reference/primer.

### 3. Visual & feel polish

- Cohesive dark theme refresh, smooth puzzle-to-puzzle transitions (CSS only — no new heavy deps).
- **Per-puzzle elapsed timer** shown in `GamePlayer`.
- **Keyboard-first flow:** Enter submits; once answered, Enter advances to Next.
- **Optional sound cues:** tiny Web Audio helper (`src/sound.ts`), correct/incorrect blips, **off by default**, toggled in Settings.
- **Settings panel:** sound on/off, warm-up duration, difficulty mode (adaptive vs fixed level). Persisted via existing `StatsStore` settings (extend `Settings`).
- **Warm-Up results breakdown by skill:** the end-of-session summary lists correct/total per skill category attempted.

## Architecture & contract changes

`src/types.ts`:
- `Skill` union extended to: `'cipher' | 'pattern' | 'observation' | 'logic' | 'combination' | 'anagram' | 'math' | 'spatial'`.
- `Puzzle` gains `explanation?: string`.
- New `Technique` interface (or in `coach/techniques.ts`).

`StatsStore.Settings` gains `difficultyMode: 'adaptive' | 'fixed'` and `fixedLevel: Difficulty` (sound + warmUpSeconds already exist).

**Isolation discipline:** the only shared files touched are `types.ts`, `games/index.ts`, `views/index.ts`. Each skill owns its own generator + test + view files, so the eight skills can be built independently and in parallel without conflict. Shared-file wiring is done serially after.

## Build sequence

1. Extend `types.ts` (Skill union + `explanation`) and commit — unblocks all generator work.
2. Parallel: build/expand all 8 generators + tests + views; each returns its technique content + registry info. No shared-file edits, no commits (controller commits).
3. Serial wiring: `games/index.ts`, `views/index.ts`, `coach/techniques.ts`, `Techniques` screen, `GamePlayer` (explanation + timer + keyboard), `sound.ts`, `Settings` panel + `Settings` type, Warm-Up breakdown, Home + App routing, visual polish.
4. Verify: full `vitest`, `tsc --noEmit`, `npm run build`, browser smoke test. Adversarial review.
5. Write README documenting the finished app.

## Testing

- Every generator: seeded-RNG determinism, `checkAnswer(solution) === true`, wrong-answer rejection, and (where applicable) per-kind coverage. Same TDD discipline as v1.
- `coach/techniques.ts`: a test asserting every `Skill` has a technique entry.
- A `GamePlayer` test asserting the explanation appears after answering.
- Regression-guard the Dashboard/shared-store behavior remains intact.

## Non-Goals

- No XP, badges, achievements, daily challenge, or streak-as-game mechanics.
- No PWA / installable / offline build.
- No backend; localStorage remains the only persistence.
