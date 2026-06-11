# Escape Room Depth v1 — Scenario Variants + Case Notes + Recall

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Checkbox steps.

**Goal:** Make the Vanished Detective room replayable and more honest: seed-picked puzzle
variants within the same value-chained story, a Case Notes journal that collects discovered
values, and objectives that reference the notes instead of re-printing codes.

**Scope discipline:** scenario.ts + its test, EscapeRoom.tsx, and a small CaseNotes UI
component. No scene/physics/presenter/session changes. No sound/stats (next slice).

---

### Task 1: Scenario variants (note × book), same invariants

**Files:** Modify `src/escape/blueprint/scenario.ts`, `src/escape/blueprint/scenario.test.ts`

The chain shape stays: note reveals keyword + half2 → book puzzle's answer IS half1 →
vault = half1+half2 → safe reveals exitCode → door. Vary the *puzzle kinds* by seed:

- **Note variants** (`noteKind`): `'caesar'` (current) and `'a1z26'` (keyword encoded as
  alphabet positions, e.g. `12-5-4-7-5-18`; hint names the scheme; explanation walks it).
  Solution remains the keyword; margin beat still reveals the badge no. (half2).
- **Book variants** (`bookKind`): `'ledger-sum'` (current: a+b+c = half1) and
  `'page-sequence'` ("she circled pages …" — an arithmetic sequence of 4 terms with step
  s∈[3..9] ending such that the NEXT term = half1; prompt asks for the next circled page;
  data.expression shows the sequence, e.g. `41, 48, 55, 62, ?`). Solution = String(half1).
  Keep half1 ∈ [60..98] for this variant so all terms stay positive and 2-digit
  (first term = half1 − 4s ≥ 60 − 36 = 24 ✓); ledger-sum keeps [21..98].
- Seed picks both independently (`rng()` order: keyword, noteKind, bookKind, then values),
  so 4 combos exist across seeds.
- Add a `notes: Record<StationId, string>` field to `Scenario`: short evidence lines added
  to the Case Notes when each station is solved, containing the carried values verbatim:
  desk → `Badge no. — {half2} · Records hidden in the {keyword}`
  bookshelf → `{bookNoun} entry — {half1}`  (bookNoun: 'Ledger' or 'Page')
  safe → `EXIT code — {exitCode}`
- Prompts/labels/beats flavor-adjust per variant (e.g. label `[E] Search for the ATLAS`).

**Tests:** keep the existing 6 green (update only where prompts changed); add:
- all four (noteKind × bookKind) combos occur across seeds 0..80;
- for EVERY seed 0..80: checkAnswer(solution) for all stations, vaultCode = half1+half2,
  book solution === half1, safe solution === vaultCode, notes contain half2/half1/exitCode
  respectively, beats unchanged in their reveal guarantees;
- a1z26 note decodes correctly (encode keyword, assert solution accepted) and
  page-sequence's displayed terms are an arithmetic sequence whose next term is half1
  (parse data.expression).

Run `npx vitest run src/escape/blueprint/scenario.test.ts` red→green per TDD. Commit:
`feat(escape): scenario variants (note x book) with case-note evidence lines`

---

### Task 2: Case Notes journal + recall objectives

**Files:** Create `src/escape/ui/CaseNotes.tsx`; modify `src/escape/EscapeRoom.tsx`

- **CaseNotes**: presentational panel. Props: `{ notes: string[]; open: boolean; onToggle: () => void }`.
  Renders a small `📓 Case Notes` pill button (bottom-right, `pointer-events-auto`,
  z-20); when open, a compact panel lists the collected lines (amber-on-dark styling to
  match the HUD). Empty state: "Nothing collected yet." The panel must not capture
  pointer lock (plain DOM, like the HUD).
- **EscapeRoom**: `const [notes, setNotes] = useState<string[]>([])` + `notesOpen` state;
  in `handleSolve`, append `scenario.notes[station.id]`; reset both in `onRetry`.
  Render `<CaseNotes>` alongside the HUD (hidden while a modal is open to avoid overlap
  with presenters; visible while playing and on the win/lose screens is fine).
- **Recall objectives** (replace the code-echoing ones):
  - after bookshelf: `Set the vault: the ${bookNoun} entry, then her badge number — it's in your case notes.`
  - after safe: `You have the exit code. Find the door.`
  (Beats/toasts still show each value once at discovery; the journal is the persistent
  record. The objective never re-prints digits.) The scenario should expose `bookNoun`
  (or include the phrasing in a scenario-provided objective map) so EscapeRoom doesn't
  hardcode variant flavor.
- Pressing `N` toggles the notes (add to the existing keydown effect; ignore when a
  modal is open so typing in an answer box never toggles it).

**Verify:** `npx tsc --noEmit && npm run build && npx vitest run` all green; mount check
in browser (controller). Commit:
`feat(escape): case-notes journal + recall objectives (no code spoon-feeding)`

---

## Self-review notes
- Invariants preserved and extended under test; every variant combo is exercised per seed sweep.
- The journal solves the recall-fairness problem honestly: values shown once narratively,
  kept in evidence, never re-broadcast in the objective bar.
- EscapeRoom keydown change must keep hook order stable and not toggle while typing in
  presenter inputs (gate on `activeModal === null`).
