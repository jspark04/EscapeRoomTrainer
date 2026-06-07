# 🔓 Escape Room Brain Trainer

A local-first web app that **builds and primes the cognitive skills you use to crack escape-room puzzles**. Practice eight puzzle types, run a timed pre-game warm-up, and — most importantly — learn the *techniques* so you recognize and solve puzzles faster next time.

No account, no backend, no tracking. Everything runs in your browser and your progress is saved locally.

---

## Why it exists

Escape rooms reward a recognizable set of mental skills: spotting ciphers, finding patterns, observing details, deducing from clues, cracking combination locks, unscrambling words, fast mental math, and spatial reasoning. This app trains each of those in isolation **and** teaches you how to attack them — so you walk into a real room already primed.

## Features

### 🎯 Two ways to play
- **Train** — pick a skill and get an endless stream of puzzles. Difficulty **adapts** to your accuracy (or hold it fixed in Settings). Hints and full reveals are always available.
- **Warm-Up** — a timed mixed session (3–10 min, configurable) that pulls random puzzles from every skill and ends with a **readiness score** plus a per-skill breakdown. Run it right before a real escape room.

### 🧠 Eight skill trainers
| Skill | What it trains |
|---|---|
| 🔐 **Ciphers & Codes** | Caesar, Atbash, substitution, Vigenère, A1Z26, Morse, binary, phone-keypad, rail-fence |
| 🔢 **Pattern & Sequence** | Arithmetic/geometric/square/Fibonacci/alternating number runs + letter sequences |
| 👁️ **Observation & Memory** | Flash-grid recall: count a symbol, name a position, or spot what changed |
| 🧩 **Logic & Lateral** | Riddles, verbal analogies, and one-to-one deduction grids |
| 🔒 **Combination Locks** | Deduce a numeric code from a set of true clues (uniquely solvable) |
| 🔤 **Anagrams & Words** | Unscramble themed letters into a word |
| ➗ **Mental Math** | Order-of-operations chains, solve-for-?, percentages, sequence sums |
| 🧭 **Spatial Reasoning** | Compass turns, relative directions, and grid-path counting |

### 📖 Teach-the-technique coaching
- After you answer any puzzle, a **“How to crack it”** panel explains the method used on that specific instance.
- The **Technique Library** is a standalone reference: for every skill it lists *what to look for*, a step-by-step *how to crack it*, and a *worked example*.

### ✨ Feel
- Per-puzzle elapsed timer, smooth transitions, keyboard-first flow (Enter to submit, then Enter to advance).
- Optional sound cues (off by default), configurable warm-up length, and adaptive-vs-fixed difficulty — all in **Settings**.
- Progress **Dashboard**: attempts, accuracy, average solve time, and best streak per skill.

## Tech stack

- **Vite + React 19 + TypeScript** — fast SPA, no server.
- **Tailwind CSS v4** — styling.
- **Vitest + React Testing Library** — 100+ tests.
- **localStorage** — the entire persistence layer.

## Architecture

Everything is built on one small contract. Each puzzle type is a pure `PuzzleGenerator` that, given a difficulty and a (seedable) random source, returns a `Puzzle`:

```ts
interface Puzzle {
  id: string;
  skill: Skill;
  prompt: string;
  data: unknown;                       // game-specific render payload
  checkAnswer: (input: string) => boolean;
  solution: string;
  hint?: string;
  explanation?: string;                // shown after answering — the teaching moment
}

interface PuzzleGenerator {
  id: string; name: string; skill: Skill;
  generate: (difficulty: Difficulty, rng?: Rng) => Puzzle;
}
```

Because generators are **pure functions** (randomness is injected, so tests can seed it), they’re trivially unit-testable. A single generic `GamePlayer` drives any generator; Train mode, Warm-Up mode, the Dashboard, and stats are all generic over the contract — adding a ninth skill is one new module plus three registry lines.

```
src/
  types.ts                 # Skill, Difficulty, Puzzle, PuzzleGenerator, Technique
  rng.ts                   # seeded mulberry32 PRNG + helpers
  sound.ts                 # optional Web Audio cues (no-op without AudioContext)
  games/                   # one PuzzleGenerator per skill (+ tests) and the registry
  views/                   # one presentational view per skill (+ registry)
  engine/
    GamePlayer.tsx         # generic generate → render → check → explain → next loop
    difficulty.ts          # adaptive difficulty from a rolling accuracy window
  modes/
    Train.tsx              # single-skill practice
    WarmUpSession.tsx      # timed mixed session + readiness score
  coach/
    techniques.ts          # the Technique Library content
  components/
    Home.tsx  Dashboard.tsx  Techniques.tsx  Settings.tsx
  stats/
    StatsStore.ts          # localStorage persistence + stats math
    sharedStore.ts         # single shared instance used app-wide
```

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite prints a localhost URL)
```

Then open the printed URL in your browser.

### Other commands
```bash
npm test           # run the test suite (Vitest)
npm run build      # type-check and produce a production build in dist/
npm run preview    # serve the production build locally
```

## Testing

Every puzzle generator is tested for the core invariants:
- `checkAnswer(solution)` accepts the puzzle’s own answer,
- generation is **deterministic** for a given seed,
- wrong answers are rejected,
- each puzzle *kind* is exercised and carries a non-empty explanation.

`StatsStore`, the adaptive-difficulty logic, the `GamePlayer` engine, the Dashboard data flow, and the Technique Library coverage are all covered as well.

## Roadmap

- Installable PWA / offline support (deferred).
- Optional progression layer (daily challenge, achievements) — intentionally left out for now.
- More puzzle kinds and a fifth+ skill category.

## License

Personal project — no license specified.
