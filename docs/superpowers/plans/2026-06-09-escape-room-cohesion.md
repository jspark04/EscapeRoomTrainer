# Escape Room Cohesion — Value-Chained Narrative Scenario

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Checkbox steps.

**Goal:** Replace the disconnected, randomly-generated deterministic room (three unrelated puzzles merely gated in sequence) with a **cohesive, story-driven scenario** where each puzzle's answer is the concrete clue/input for the next, building to a vault you open with values you actually carried from earlier puzzles. This is what makes it feel like a real escape room.

**Why:** The current `generateBlueprint` picks 2 random skills + a self-contained combination safe; nothing connects. Playtest verdict: "puzzles aren't cohesive… an escape room I wouldn't pay to go to." Fix the *content design*, deterministically (so it's great offline; Claude stays an optional narrative/hint enhancer).

**The story:** *The Vanished Detective.* You're locked in Detective **Mara Vane**'s study; she disappeared mid-case. Retrace her last steps, open her vault, leave with the evidence.

**The chain (real value flow):**
1. **Desk** — decrypt Mara's note (a cipher). The plaintext is a **keyword** naming where she hid her records (e.g. `LEDGER`); solving it also reveals, in the margin, her **badge number = the vault's last two digits** (`half2`).
2. **Bookshelf** — find the `{keyword}`; its puzzle (a small ledger sum) answers to a **two-digit number = the vault's first two digits** (`half1`).
3. **Safe** — the 4-dial lock opens on `half1` then `half2` (`vaultCode`), which the player assembles from steps 1–2. It has **no clues of its own** — the clues are the values you carried. Opening it reveals the **exit code** + the evidence.
4. **Door** — enter the exit code → escape with the evidence.

**Scope discipline:** keep the existing scene, presenters (`OverlayPresenter`, `DialLockPresenter`, `DoorKeypadPresenter`), session/resolver, physics, layout, and the Claude `narrate`/`hint` enhancement. Change only the **room content source** + EscapeRoom's consumption of it + narrative beats. `generateBlueprint`/`roomBuilder` may remain in the tree (unused by EscapeRoom for structure) — do not delete in this change.

---

### Task 1: `generateScenario` — the value-chained narrative room (pure, tested)

**Files:**
- Create: `src/escape/blueprint/scenario.ts`, `src/escape/blueprint/scenario.test.ts`

- [ ] **Step 1: Write the failing test `src/escape/blueprint/scenario.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateScenario } from './scenario';

describe('generateScenario', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(stripFns(generateScenario(7)))).toBe(JSON.stringify(stripFns(generateScenario(7))));
  });

  it('chains values: vaultCode = bookshelf answer (half1) + desk-revealed half2', () => {
    const s = generateScenario(7);
    expect(s.vaultCode).toBe(`${s.half1}${s.half2}`);
    // the bookshelf puzzle's own solution IS half1 (the value the player carries)
    expect(s.stations.bookshelf.puzzle.solution).toBe(s.half1);
    // the safe dial target IS the assembled vault code
    expect(s.stations.safe.puzzle.solution).toBe(s.vaultCode);
  });

  it('every puzzle accepts its own solution', () => {
    const s = generateScenario(11);
    for (const st of Object.values(s.stations)) {
      expect(st.puzzle.checkAnswer(st.puzzle.solution)).toBe(true);
    }
  });

  it('the desk keyword names the bookshelf item referenced in the bookshelf beat/objective', () => {
    const s = generateScenario(3);
    expect(s.stations.desk.puzzle.solution.length).toBeGreaterThan(0);
    expect(s.beats.desk).toContain(s.half2);              // desk solve reveals half2
    expect(s.beats.bookshelf).toContain(s.half1);          // bookshelf solve reveals half1
    expect(s.beats.safe).toContain(s.exitCode);            // safe open reveals exit code
    expect(s.beats.desk.toUpperCase()).toContain(s.stations.desk.puzzle.solution.toUpperCase());
  });

  it('codes are well-formed and distinct enough', () => {
    const s = generateScenario(99);
    expect(s.half1).toMatch(/^\d{2}$/);
    expect(s.half2).toMatch(/^\d{2}$/);
    expect(s.vaultCode).toMatch(/^\d{4}$/);
    expect(s.exitCode).toMatch(/^\d{4}$/);
  });

  it('varies across seeds', () => {
    const codes = new Set<string>();
    for (let seed = 0; seed < 40; seed++) codes.add(generateScenario(seed).vaultCode);
    expect(codes.size).toBeGreaterThan(5);
  });
});

// helper: JSON can't serialize checkAnswer fns; strip them for the determinism check.
function stripFns(s: ReturnType<typeof generateScenario>) {
  return JSON.parse(
    JSON.stringify(s, (k, v) => (k === 'checkAnswer' ? undefined : v)),
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/blueprint/scenario.test.ts`
Expected: FAIL — cannot find module './scenario'.

- [ ] **Step 3: Write `src/escape/blueprint/scenario.ts`**

```ts
import type { Puzzle } from '../../types';
import { mulberry32, pick, randInt, uid } from '../../rng';

export type StationId = 'desk' | 'bookshelf' | 'safe';

export interface ScenarioStation {
  id: StationId;
  anchor: StationId;
  presenter: 'overlay' | 'diegetic';
  puzzle: Puzzle;
  /** Interaction label shown on the crosshair when unlocked. */
  label: string;
  /** Shown when the player aims at it before it is unlocked. */
  lockedHint: string;
  /** Which station must be solved before this one unlocks (undefined = available at start). */
  requires?: StationId;
}

export interface Scenario {
  seed: number;
  intro: string;
  win: string;
  lose: string;
  initialObjective: string;
  /** Story beat shown on solving each station — reveals the carried value(s). */
  beats: Record<StationId, string>;
  stations: Record<StationId, ScenarioStation>;
  half1: string; // 2 digits — the bookshelf ledger answer
  half2: string; // 2 digits — Mara's badge no., revealed by the desk note
  vaultCode: string; // half1 + half2 — the safe dial target
  exitCode: string; // 4 digits — revealed inside the safe, opens the door
}

const KEYWORDS = ['LEDGER', 'ATLAS', 'DIARY', 'ALMANAC', 'DOSSIER'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

// A Caesar cipher of `word`, shift in [3..23]. checkAnswer accepts the plaintext word.
function deskCipher(word: string, shift: number): Puzzle {
  const enc = word
    .split('')
    .map((c) => ALPHABET[(ALPHABET.indexOf(c) + shift) % 26])
    .join('');
  return {
    id: uid('desk'),
    skill: 'cipher',
    prompt: `Mara's note is in her usual Caesar hand:\n\n    ${enc}\n\nDecode it.`,
    data: { kind: 'caesar' },
    solution: word,
    hint: `She always shifted by ${shift}.`,
    explanation: `Caesar shift of ${shift}: move each letter back ${shift} places (A−${shift}, wrapping). It reads ${word}.`,
    checkAnswer: (input: string) => norm(input) === norm(word),
  };
}

// A ledger sum whose answer is `target` (a 2-digit number). Player adds the entries.
function ledgerPuzzle(target: number, keyword: string, rng: () => number): Puzzle {
  const a = randInt(rng, 10, target - 12);
  const b = randInt(rng, 2, target - a - 1);
  const c = target - a - b; // a + b + c === target, all positive
  return {
    id: uid('book'),
    skill: 'math',
    prompt: `Inside the ${keyword}, three figures are underlined:\n\n    ${a} + ${b} + ${c}\n\nMara wrote: "their sum is the entry." What is it?`,
    data: { kind: 'ledger' },
    solution: String(target),
    hint: 'Just add the three underlined figures.',
    explanation: `${a} + ${b} + ${c} = ${target} — the ledger entry, and the first half of the vault code.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === String(target),
  };
}

// The 4-dial vault. No clues of its own — the answer is the two halves you carried.
function vaultPuzzle(vaultCode: string): Puzzle {
  return {
    id: uid('safe'),
    skill: 'combination',
    prompt: `Mara's vault — four dials. The ledger entry, then her badge number.`,
    data: { kind: 'vault' },
    solution: vaultCode,
    hint: 'First two dials = the ledger entry; last two = her badge number.',
    explanation: `Set the dials to the ledger entry followed by her badge number: ${vaultCode}.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === vaultCode,
  };
}

export function generateScenario(seed: number): Scenario {
  const rng = mulberry32(seed);
  const keyword = pick(rng, KEYWORDS);
  const shift = randInt(rng, 3, 23);
  const half1 = String(randInt(rng, 21, 98)); // 2-digit ledger entry
  const half2 = String(randInt(rng, 21, 98)); // 2-digit badge no.
  const vaultCode = `${half1}${half2}`;
  const exitCode = String(randInt(rng, 1000, 9999));

  const stations: Record<StationId, ScenarioStation> = {
    desk: {
      id: 'desk',
      anchor: 'desk',
      presenter: 'overlay',
      puzzle: deskCipher(keyword, shift),
      label: "[E] Read Mara's note",
      lockedHint: '',
    },
    bookshelf: {
      id: 'bookshelf',
      anchor: 'bookshelf',
      presenter: 'overlay',
      puzzle: ledgerPuzzle(Number(half1), keyword, rng),
      label: `[E] Search for the ${keyword}`,
      lockedHint: 'A note on the desk first — where did she hide her records?',
      requires: 'desk',
    },
    safe: {
      id: 'safe',
      anchor: 'safe',
      presenter: 'diegetic',
      puzzle: vaultPuzzle(vaultCode),
      label: '[E] Work the vault dials',
      lockedHint: `Find the ${keyword} before the vault makes sense.`,
      requires: 'bookshelf',
    },
  };

  return {
    seed,
    intro:
      "Detective Mara Vane vanished three nights ago, mid-case. You've let yourself into her study — and the door has locked behind you. " +
      'Her evidence is in the vault. Retrace her last moves, open it, and get out.',
    win: 'The vault’s evidence under your arm, the lock gives. You step into the corridor — Mara’s case is yours to finish. 🔓',
    lose: 'The bolt holds and the hour turns. Mara’s study keeps you, and its secrets, a while longer.',
    initialObjective: 'Start at her desk — there’s a note.',
    beats: {
      desk: `Decoded: "${keyword}". In the margin, pressed faint in pencil: her badge no. ${half2}. Her records are in the ${keyword} — check the shelf.`,
      bookshelf: `The ${keyword}'s last entry: ${half1}. Two numbers now — the entry, and her badge.`,
      safe: `The vault swings open. Mara's file — and a luggage tag looped to the key: EXIT ${exitCode}.`,
    },
    stations,
    half1,
    half2,
    vaultCode,
    exitCode,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/blueprint/scenario.test.ts`
Expected: PASS (6 tests). If `ledgerPuzzle` can produce a non-positive `b`/`c` for small `half1`, the `half1` floor of 21 keeps `a∈[10, half1-12]`, `b∈[2, half1-a-1]`, `c≥1` — verify across the seed sweep; widen the floor if any seed throws/asserts.

- [ ] **Step 5: Commit**

```bash
git add src/escape/blueprint/scenario.ts src/escape/blueprint/scenario.test.ts
git commit -m "feat(escape): value-chained narrative scenario generator (The Vanished Detective)"
```

---

### Task 2: Drive EscapeRoom from the scenario (story beats + carried values)

**Files:**
- Modify: `src/escape/EscapeRoom.tsx`

- [ ] **Step 1: Read the current `src/escape/EscapeRoom.tsx`.**

- [ ] **Step 2: Source the room from `generateScenario` (synchronous, deterministic).**

- Import `generateScenario, type Scenario` from `./blueprint/scenario`.
- Replace the async `buildRoom`/`built` flow and the `blueprint`/`puzzles`/`getGenerator` derivation with:
```tsx
const scenario = useMemo(() => generateScenario(SEED_BASE + seedNonce), [seedNonce]);
```
- Build the session's `Blueprint` from the scenario so the resolver/session gating still works (desk → bookshelf → safe → door):
```tsx
const blueprint = useMemo<Blueprint>(() => ({
  theme: 'detective-study',
  seed: scenario.seed,
  stations: (['desk','bookshelf','safe'] as const).map((id, i, arr) => ({
    id,
    skill: scenario.stations[id].puzzle.skill,
    difficulty: 2,
    anchor: id,
    presenter: scenario.stations[id].presenter,
    produces: [id === 'safe' ? 'exitCode' : `clue_${id}`],
    consumes: i === 0 ? [] : [`clue_${arr[i-1]}`],
    narrativeKey: id,
  })),
  finalLock: { anchor: 'door', consumes: ['exitCode'] },
}), [scenario]);
```
  (This keeps `createSession`/`resolver` unchanged — they only need ids/consumes/produces for gating + completion.)
- Puzzles now come from the scenario: `const puzzleFor = (id) => scenario.stations[id].puzzle;`. The exit code is `scenario.exitCode`; the safe dial target is `scenario.stations.safe.puzzle.solution` (= vaultCode).
- Because the room is synchronous now, **remove the "Entering the room…" splash gate** and the `buildRoom`/`built` state (the `if (!built)` early-return). Keep stable hook order (all hooks before the single return). The `claude.narrate`/`claude.hint` calls stay as optional enhancers (canned fallback = the scenario's `intro`/`win`/`lose`), and the hint button keeps working off the active puzzle.

- [ ] **Step 3: Wire the chained narrative.**

- `narrative` state initializes from the scenario (`{ intro: scenario.intro, win: scenario.win, lose: scenario.lose }`), still overridable by `claude.narrate`.
- The **objective** becomes story-driven from the scenario beats + solved set:
```tsx
const objective = useMemo(() => {
  if (escaped) return 'You made it out.';
  if (safeSolved) return `Exit code ${scenario.exitCode} — find the door.`;
  if (solvedIds.has('bookshelf')) return `Set the vault: ${scenario.half1} then ${scenario.half2}.`;
  if (solvedIds.has('desk')) return scenario.beats.desk;        // names the keyword + reveals half2
  return scenario.initialObjective;
}, [escaped, safeSolved, solvedIds, scenario]);
```
- Show the **on-solve beat** as a brief toast when a station is solved (so the player sees the revealed value narratively). Add a small `discovery` state set in `handleSolve` to `scenario.beats[stationId]`, rendered as a dismissable/auto-fading banner (reuse the intro-banner styling). Clear it when the next modal opens or on retry.
- Interaction prompts + locked hints come from `scenario.stations[id].label` / `.lockedHint` (replace the hardcoded `labels` map and the generic "Locked — solve the earlier clue first."). The door prompt: locked → "The door won't budge without the exit code."; unlocked (safeSolved) → "[E] Enter the exit code".
- The dial modal target is `scenario.stations.safe.puzzle.solution`; the door keypad target is `scenario.exitCode`; `handleFinal` compares against `scenario.exitCode`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: clean build; all tests pass (prior 168 + scenario's 6 = ~174). Existing `roomBuilder`/`generateBlueprint` tests still pass (those modules remain, just unused by EscapeRoom).

- [ ] **Step 5: Commit**

```bash
git add src/escape/EscapeRoom.tsx
git commit -m "feat(escape): drive the room from the value-chained scenario with story beats"
```

---

## Self-Review Notes

**Spec coverage:** puzzles now connect — desk answer (keyword) points to the bookshelf and reveals `half2`; bookshelf answer IS `half1`; the safe opens on `half1+half2` (values the player carried); the safe reveals the exit code; the door consumes it. A throughline story (Mara Vane) with per-station beats. Deterministic + tested, so it's great offline; Claude `narrate`/`hint` remain optional enhancers.

**Type consistency:** `Scenario`/`ScenarioStation` carry concrete `Puzzle`s (reusing the engine's `Puzzle` type + `checkAnswer`). EscapeRoom builds a `Blueprint` from the scenario only to feed the unchanged `createSession`/resolver gating. `DialLockPresenter`/`DoorKeypadPresenter`/`OverlayPresenter` consume the scenario's puzzles unchanged.

**Out of scope (left intact):** scene/layout/physics/presenters/session/resolver, the Claude proxy + `narrate`/`hint`. `generateBlueprint`/`roomBuilder` stay in the tree (still tested) but EscapeRoom no longer uses them for structure — a future Claude "propose a scenario" path can replace that, but not in this change.

**Controller verifies in-browser:** the room mounts; solving the desk reveals the keyword + half2 in the objective/toast; the bookshelf reveals half1; the safe opens on the assembled code; the door takes the exit code → escape. (Live gameplay still needs a human playthrough.)
