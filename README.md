# 🔓 Escape Room Brain Trainer

[![CI](https://github.com/jspark04/EscapeRoomTrainer/actions/workflows/ci.yml/badge.svg)](https://github.com/jspark04/EscapeRoomTrainer/actions/workflows/ci.yml)

A local-first web app that **builds and primes the cognitive skills you use to crack escape-room puzzles** — and then lets you apply them in a first-person **3D escape room**. Practice eight puzzle types, run a timed pre-game warm-up, learn the *techniques*, and escape a procedurally-assembled room against the clock.

No account, no backend required, no tracking. Everything runs in your browser and your progress is saved locally.

---

## Why it exists

Escape rooms reward a recognizable set of mental skills: spotting ciphers, finding patterns, observing details, deducing from clues, cracking combination locks, unscrambling words, fast mental math, and spatial reasoning. This app trains each of those in isolation, teaches you how to attack them — and then drops you into a 3D room where you have to use them under pressure.

## Features

### 🎯 Two ways to train
- **Train** — pick a skill and get an endless stream of puzzles. Difficulty **adapts** to your accuracy (or hold it fixed in Settings). Hints and full reveals are always available.
- **Warm-Up** — a timed mixed session (3–10 min, configurable) that pulls random puzzles from every skill and ends with a **readiness score** plus a per-skill breakdown. Run it right before a real escape room.

### 🕵️ 3D Escape Room
A first-person, walk-around **detective's study** where you apply the skills you've trained:
- **First-person navigation** — WASD + mouse-look (pointer-lock), with a crosshair; aim at an object and press **E** to interact.
- **Chained puzzles → escape** — solve a sequence of puzzles (reusing the trainer's engine via 2D overlays, plus a **diegetic 3-dial safe** you physically turn) to find the exit code and crack the door keypad before the timer runs out.
- **Procedurally assembled** — every playthrough draws a **fresh, validated puzzle chain** (varying skills + difficulty ramp) *and* a **fresh room layout** (furniture and the safe/door placed on different walls and spots, always guaranteed solvable and navigable).
- **Optional AI layer (Claude)** — when a local proxy is running with your credentials, Claude adds room narrative, an adaptive hint "detective sidekick," and AI-generated/judged room blueprints. **The room is fully playable, offline and free, without it** (deterministic generation + canned narrative/hints kick in automatically).

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
- After you answer any puzzle, a **"How to crack it"** panel explains the method used on that specific instance.
- The **Technique Library** is a standalone reference: for every skill it lists *what to look for*, a step-by-step *how to crack it*, and a *worked example*.

### ✨ Feel
- Per-puzzle elapsed timer, smooth transitions, keyboard-first flow (Enter to submit, then Enter to advance).
- Optional sound cues (off by default), configurable warm-up length, and adaptive-vs-fixed difficulty — all in **Settings**.
- Progress **Dashboard**: attempts, accuracy, average solve time, and best streak per skill (the 3D room feeds it too).

## Tech stack

- **Vite + React 19 + TypeScript** — fast SPA.
- **React Three Fiber + drei (Three.js)** — the 3D escape room.
- **Tailwind CSS v4** — styling.
- **Vitest + React Testing Library** — 160+ tests.
- **localStorage** — the client persistence layer.
- **Hono (Node)** — the *optional* local Claude proxy in `server/` (only needed for the AI layer).

## Architecture

The trainer is built on one small contract — every puzzle is a pure `PuzzleGenerator` that, given a difficulty and a (seedable) random source, returns a `Puzzle`:

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

Because generators are **pure functions** (randomness is injected, so tests can seed it), they're trivially unit-testable. The 3D escape room is a *spatial skin* over this same engine: a declarative **Blueprint** (a validated chain of stations) is rendered by the 3D scene, filled by the puzzle engine, and optionally generated/judged by Claude. `checkAnswer` and `validateBlueprint`/`validateLayout` always govern correctness — the LLM only proposes.

```
src/
  games/                   # one PuzzleGenerator per skill (+ tests) and the registry
  views/                   # one presentational view per skill (+ registry)
  engine/                  # generic GamePlayer + adaptive difficulty
  modes/                   # Train + Warm-Up
  coach/                   # the Technique Library content
  components/              # Home, Dashboard, Techniques, Settings
  stats/                   # localStorage persistence (shared instance)
  escape/                  # the 3D escape room
    blueprint/             #   Blueprint types + validate + procedural generate + resolver
    scene/                 #   Room, Player, furniture, physics, interaction, procedural layout
    presenters/            #   2D overlay + diegetic dial-lock + door keypad
    session/               #   RoomSession state machine (timer, win/lose)
    claude/                #   client + orchestration + canned offline fallbacks
    ui/                    #   HUD
server/                    # optional local Claude proxy (Hono) — see server/README.md
```

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite prints a localhost URL)
```

Then open the printed URL. The 3D escape room and everything else work out of the box, fully offline.

### Optional: enable the Claude AI layer
The escape room's AI narrative/hints/generation are off by default. To enable them locally (personal use), run the proxy with your own credentials:

```bash
cd server
npm install
# either a Claude subscription token…
export CLAUDE_CODE_OAUTH_TOKEN="$(claude setup-token)"
# …or an Anthropic API key:
# export ANTHROPIC_API_KEY="sk-ant-..."
npm run dev        # proxy on http://localhost:8787 (the app auto-detects it)
```

See [`server/README.md`](server/README.md) for details and the subscription-token caveat. With no proxy running, the app silently uses deterministic generation + canned narrative/hints.

### Other commands
```bash
npm test           # run the test suite (Vitest, one-shot)
npm run test:watch # watch mode
npm run build      # type-check and produce a production build in dist/
npm run preview    # serve the production build locally
```

## Testing

Every puzzle generator is tested for the core invariants: `checkAnswer(solution)` is accepted, generation is **deterministic** for a given seed, wrong answers are rejected, and each puzzle *kind* carries a non-empty explanation. The escape room's logic — blueprint validation/generation, the navigability `validateLayout` (200-seed sweep), the session state machine, collision/interaction math, the presenters, and the Claude orchestration/fallback (with **mocked** Claude, so CI never spends quota) — is all unit-tested too. CI (GitHub Actions) runs type-check + tests + build on every PR and gates merges.

## Roadmap

- Live-verified Claude layer (the proxy ships now; activation is a local credential step).
- More diegetic in-world puzzle controls (beyond the safe dial).
- Multiple connected rooms / a multi-room run.
- Installable PWA / offline packaging.

## License

Personal project — no license specified.
