# 3D Escape Room — Design Spec

**Date:** 2026-06-08
**Status:** Drafted, pending user review

## Purpose

Add a first-person, walk-around **3D escape room** to the Escape Room Brain Trainer —
the place where the primed skills get *applied*. The player explores a detective's
study, solves a chained sequence of puzzles (reusing the existing puzzle engine), and
escapes against a timer. The room is **procedurally assembled** and **Claude-enhanced**
(narrative, hints, generation, and a cohesion "taste" pass), while remaining fully
playable on the deterministic engine alone.

This spec covers the complete 1.0 vision across four subsystems. Implementation is
sequenced into shippable phases (see Build Sequence), but the design is specified as a
whole here per the decision to spec it cohesively up front.

## Goals

- A new **"Escape Room"** mode in the existing Vite + React app, reachable from Home.
- **First-person** navigation: WASD + pointer-lock mouse-look, crosshair interaction.
- **Warm vintage detective study** aesthetic (wood / brass / lamplight), built from
  primitive geometry + a few CC0 textures (no 3D artist required).
- **Chained puzzles → final door lock**: cipher → anagram → combination → 4-digit keypad,
  where each solved puzzle yields a code consumed by the next.
- **Dynamic at two levels:** (a) puzzle *instances* are fresh every playthrough (free,
  from existing generators); (b) the puzzle *chain* is procedurally assembled from a
  declarative **blueprint** (validated solvable).
- **Claude layer** (in 1.0), all *advisory over the deterministic core*: narrative/flavor,
  adaptive hints, blueprint generation, and a taste-judge cohesion pass. Runs through a
  **local proxy** using the user's **Claude subscription OAuth token** (primary) or an
  **Anthropic API key** (fallback). App degrades gracefully to deterministic-only when
  the proxy/credential is absent.
- A countdown **timer** and clear **win/lose** with a results summary (reusing stats).

## Non-Goals (1.0)

- No multiplayer, no multiple connected rooms (single room; multi-room is a later epic).
- No mobile / touch controls (desktop keyboard + mouse only).
- No hosted/deployed multi-user Claude (the proxy is local, personal-use only).
- No fully procedural **geometry** in the first phases — object placement is from a fixed
  set of anchor slots until Phase 4 (procedural layout).
- No new puzzle *logic* — all puzzles come from the existing `PuzzleGenerator` engine.

## Player Experience (the loop)

1. From Home → **Enter the Escape Room**. A brief framing line (Claude narrative, or a
   canned line offline) sets the scene; the timer starts.
2. Walk the room (WASD + mouse-look). A crosshair highlights interactable objects; the
   prompt "Press E to inspect" appears when one is centered.
3. Engage an object → it surfaces a puzzle (2D overlay panel, or a diegetic 3D control for
   the safe). Solving it **yields a code/clue** and visibly changes the world (drawer
   opens, painting swings aside, safe unlocks).
4. Codes chain: the cipher's output tells you which book matters; the anagram gives safe
   digits; the safe gives the rest; the door keypad takes the assembled 4-digit code.
5. Stuck? The **hint sidekick** offers escalating nudges (Claude online; canned tiers
   offline).
6. Enter the final code → **escape** → results screen (time, hints used, per-skill recap).
   Running out of time → lose screen with a retry.

## Architecture Overview

Everything meets at one seam — the **Blueprint**. The 3D layer renders a blueprint; the
puzzle engine fills each station; Claude generates and judges blueprints. None of these
layers knows the others' internals.

```
                ┌─────────────────────────────────────────┐
   Claude layer │ generate ─► validate ─► taste-judge      │ (optional, advisory)
   (local proxy)│   narrative · hints                      │
                └───────────────┬─────────────────────────-┘
                                │ Blueprint (declarative)
                ┌───────────────▼──────────────┐
                │ Blueprint model + validator   │  deterministic generator (fallback/baseline)
                └───────────────┬──────────────┘
                                │ stations[]
        ┌───────────────────────▼───────────────────────┐
        │ 3D Room (R3F)         │ Puzzle engine (reused) │
        │ render · controls ·   │ PuzzleGenerator ·      │
        │ collision · interact  │ checkAnswer · presenters│
        └────────────────────────────────────────────────┘
```

### Subsystem 1 — 3D Room (React Three Fiber)

- **Libraries:** `three`, `@react-three/fiber`, `@react-three/drei`. No physics engine in
  early phases — a single room needs only lightweight **AABB collision** (clamp the camera
  position against wall planes and furniture bounding boxes each frame).
- **Controls:** drei `PointerLockControls` for mouse-look + a `KeyboardControls` map for
  WASD; a small `usePlayerController` hook integrates movement, collision clamp, and a
  walking head-bob.
- **Interaction:** a forward raycast from the camera each frame finds the nearest object
  tagged `interactable` within range; shows a crosshair + "Press E" prompt; `E`/click
  engages it. Engaging dispatches to the station's **presenter**.
- **Rendering / assets:** code-built primitives (boxes, planes, cylinders) for walls,
  desk, bookshelf, safe, door, clock. Warmth from a few CC0 textures (wood, paper) loaded
  via drei `useTexture`, an ambient + warm point/spot light, and soft shadows. Target a
  single room well under typical poly budgets; reuse materials.
- **Components:** `Room` (shell), `Furniture/*` (Desk, Bookshelf, SafeAndPainting, Clock,
  ExitDoor), `Player`, `Crosshair`, `InteractionPrompt`. Each furniture piece reads its
  station from the blueprint and exposes anchor transforms.

### Subsystem 2 — Blueprint & procedural generation

The room is data. A **Blueprint** is an ordered, validated chain of stations.

```ts
type StationId = string;
type PresenterKind = 'overlay' | 'diegetic';

interface Station {
  id: StationId;
  skill: Skill;                 // from the existing engine (cipher, anagram, combination, …)
  difficulty: Difficulty;
  anchor: string;               // which physical slot (e.g. 'desk', 'bookshelf', 'safe')
  presenter: PresenterKind;     // how it surfaces (overlay default; diegetic for the safe)
  produces: string[];           // code/clue tokens this station yields when solved
  consumes: string[];           // tokens that must be obtained before this is attemptable
  narrativeKey: string;         // slot the narrative layer fills (deterministic text offline)
}

interface Blueprint {
  theme: string;                // 'detective-study'
  seed: number;                 // for reproducible deterministic generation
  stations: Station[];          // ordered chain
  finalLock: { anchor: 'door'; consumes: string[] };  // the escape condition
}
```

- **`validateBlueprint(bp): Result`** — the solvability guarantee. Checks: every `consumes`
  token is `produced` by an earlier station; the chain is acyclic and reaches `finalLock`;
  exactly one terminal; difficulties form a non-decreasing ramp; anchors are unique and
  exist. Returns ok or a list of violations. **No blueprint reaches the player unvalidated.**
- **`generateBlueprint(seed): Blueprint`** — a *deterministic* generator that picks a chain
  of skills and wires `produces`/`consumes` from the seed. This is both the **offline
  baseline** and the **fallback** when Claude output fails validation. (Phase 2.)
- **Token flow:** a station's `produces` tokens are concrete values derived from its solved
  puzzle (e.g. the safe's two digits). A small **runtime resolver** maps solved puzzles to
  token values and feeds the next station / final lock.

### Subsystem 3 — Puzzle layer & presenters

- **Reuses the existing engine unchanged:** `getGenerator(skill).generate(difficulty)` →
  `Puzzle` with `checkAnswer`. `checkAnswer` always governs correctness.
- **Presenter abstraction** decouples *how a puzzle is shown* from *what it is*:

```ts
interface PuzzlePresenter {
  kind: PresenterKind;
  // Renders the puzzle and reports solved/closed back to the room.
  // 'overlay' wraps the existing 2D puzzle views + GamePlayer in a modal panel.
  // 'diegetic' renders an in-world 3D control (v1: a 3-dial combination lock).
}
```

- **v1 presenters:** `OverlayPresenter` (reuses `VIEWS` + answer entry from the current
  2D engine, in a focused modal that releases pointer-lock while open) and
  `DialLockPresenter` (the diegetic 3-dial safe — drag/scroll to turn dials; compares
  against the `combination` puzzle's solution). Architecture allows adding more diegetic
  presenters later without touching the engine.

### Subsystem 4 — Claude layer (optional, graceful)

A **local Node proxy** holds credentials; the browser never sees a secret.

- **Runtime:** a small **Hono** server (e.g. `localhost:8787`), started alongside the Vite
  dev server. The Vite dev server proxies `/claude/*` to it (avoids CORS). Endpoints:
  `POST /claude/blueprint`, `/claude/judge`, `/claude/narrate`, `/claude/hint`.
- **Auth (lead = subscription, fallback = API key):**
  - **Primary:** a **Claude subscription OAuth token** (`claude setup-token`, supplied via
    `CLAUDE_CODE_OAUTH_TOKEN`) used through the **Claude Agent SDK**, drawing on the user's
    Pro/Max limits. *Personal, local use only* (ToS); not for distribution.
  - **Fallback:** `ANTHROPIC_API_KEY` via the Anthropic SDK (billed to an API account).
  - **Exact current auth/SDK specifics are verified at implementation time** (they evolve);
    the proxy abstracts the provider behind one `callClaude()` interface.
- **The four roles (all advisory):**
  1. **Blueprint generation** — Claude proposes a `Blueprint`; the server runs
     `validateBlueprint`; on failure it retries up to N times, then falls back to
     `generateBlueprint(seed)`. Claude never bypasses validation.
  2. **Taste-judge** — Claude scores a candidate room for cohesion (theme consistency,
     difficulty ramp, clue clarity, narrative fit) and returns `accept | revise(reasons)`;
     a capped generate→validate→judge loop picks the best candidate. (Judge pattern.)
  3. **Narrative/flavor** — fills `narrativeKey` slots (intro, object descriptions, win/lose).
     Text only; deterministic canned text used offline.
  4. **Adaptive hints** — given the active puzzle + elapsed struggle time, returns an
     escalating, non-spoiling nudge. Offline: canned tiered hints from `hint`/`explanation`.
- **Graceful degradation:** if the proxy is unreachable or no credential is set, the client
  uses the deterministic blueprint generator + canned narrative/hints. The room is always
  playable offline and free.

## Game State & Flow

- A `RoomSession` state machine: `loading → playing → solved(station) → … → escaped | failed`.
- **Timer:** countdown (default configurable, reuse the Warm-Up duration setting); reaching
  zero → `failed`.
- **Progress/stats:** each solved station records an attempt via the existing `StatsStore`
  (skill, correct, timeMs) so the 3D room feeds the same Dashboard. Escapes record time +
  hints used.
- **Win/lose screens:** results summary (time, hints, per-skill recap) + retry / exit.

## Determinism & Testing Strategy

- **Verifiable backbone (unit-tested as today):** `validateBlueprint` (accepts solvable
  chains, rejects cycles / missing producers / bad ramps), `generateBlueprint`
  (deterministic per seed; always passes its own validator across a seed sweep), the token
  resolver, and the reused puzzle engine (existing tests).
- **Presenters:** `OverlayPresenter` reports solved on correct answer; `DialLockPresenter`
  opens only on the right combination.
- **Claude calls are MOCKED in CI** — the autonomous pipeline never spends quota. Tests
  assert: malformed/invalid LLM blueprints are rejected and fall back; the judge loop is
  capped; offline mode works with no proxy. **Live** Claude validation is a separate,
  manual/scheduled check, never in the PR gate.
- 3D interaction is hard to unit-test; cover the *logic* (controller math, raycast target
  selection, collision clamp) with unit tests and verify the scene manually/in-browser.

## Integration With the Existing App

- New screen `escape3d` in `App.tsx` routing; a card on `Home`.
- New optional dependencies: `three`, `@react-three/fiber`, `@react-three/drei` (client);
  `hono` + the Claude SDK(s) (local proxy, separate `server/` workspace so the client
  bundle stays lean and the SPA still builds without the server).
- `.superpowers/` added to `.gitignore` (brainstorming artifacts).
- The Vite build must remain green without the proxy; Claude features are dynamically
  feature-detected at runtime.

## Proposed Module Layout

```
src/escape/
  EscapeRoom.tsx              # mode entry: sets up canvas + session
  scene/
    Room.tsx  Player.tsx  Crosshair.tsx  InteractionPrompt.tsx
    furniture/ Desk.tsx Bookshelf.tsx SafeAndPainting.tsx Clock.tsx ExitDoor.tsx
    usePlayerController.ts    # movement + AABB collision + look
    useInteraction.ts         # raycast target + engage
  blueprint/
    types.ts                  # Station, Blueprint, tokens
    validate.ts (+ test)      # validateBlueprint
    generate.ts (+ test)      # deterministic generateBlueprint
    resolver.ts (+ test)      # solved puzzle → produced token values
  presenters/
    OverlayPresenter.tsx  DialLockPresenter.tsx (+ tests)
  claude/
    client.ts                 # browser-side: feature-detect + call /claude/*, fallbacks
    fallbacks.ts              # canned narrative + tiered hints (offline)
  session/
    RoomSession.ts (+ test)   # state machine, timer, win/lose, stats wiring
server/                       # local proxy (separate from the SPA build)
  index.ts                    # Hono app: /claude/{blueprint,judge,narrate,hint}
  callClaude.ts               # provider abstraction: subscription OAuth | API key
  prompts/                    # role prompts (blueprint, judge, narrate, hint)
```

## Build Sequence (phases within this one spec)

1. **Phase 1 — Playable deterministic room.** Subsystems 1 + 3 + a *hand-authored*
   blueprint; first-person nav, overlay puzzles, diegetic safe, keypad, timer, win/lose.
   Ships a real escape room. Offline, free.
2. **Phase 2 — Procedural blueprints.** Subsystem 2: `types` + `validate` + deterministic
   `generate` + `resolver`; rooms vary structurally each run. Creates the Claude seam.
3. **Phase 3 — Claude layer.** Subsystem 4: local proxy + auth, then the four roles
   (generation validated by Phase 2, taste-judge loop, narrative, hints), with graceful
   offline fallback and CI mocking.
4. **Phase 4 — Procedural geometry.** Generate object placement (and later room shape) from
   anchor slots with navigability checks (the "level 3" dynamism).

## Risks & Open Questions

- **Subscription-OAuth for apps is a gray area.** Designed personal/local-only; API-key
  fallback always available; exact SDK/auth specifics verified at implementation.
- **LLM latency / cost / rate limits.** Mitigate: generate the blueprint once per room
  (cache it), short prompts, deterministic fallback, never block core play on a call.
- **Non-determinism vs. testability.** Resolved by validate-everything + mock-in-CI; the
  LLM proposes, code disposes.
- **3D performance & input feel.** Single room, simple meshes, instancing where useful;
  pointer-lock UX (overlay must release the lock) needs care.
- **Open:** exact warm-study texture sources (CC0); whether Phase 4 also varies room shape
  or only object placement in 1.0.
