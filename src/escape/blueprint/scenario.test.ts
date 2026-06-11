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

  // --- Variants -------------------------------------------------------------

  it('all four note×book variant combos occur across seeds 0..80', () => {
    const combos = new Set<string>();
    for (let seed = 0; seed <= 80; seed++) {
      const s = generateScenario(seed);
      combos.add(`${s.noteKind}/${s.bookKind}`);
    }
    expect(combos).toContain('caesar/ledger-sum');
    expect(combos).toContain('caesar/page-sequence');
    expect(combos).toContain('a1z26/ledger-sum');
    expect(combos).toContain('a1z26/page-sequence');
    expect(combos.size).toBe(4);
  });

  it('preserves every chain invariant for every seed 0..80', () => {
    for (let seed = 0; seed <= 80; seed++) {
      const s = generateScenario(seed);

      // Codes well-formed.
      expect(s.half1, `half1 seed ${seed}`).toMatch(/^\d{2}$/);
      expect(s.half2, `half2 seed ${seed}`).toMatch(/^\d{2}$/);
      expect(s.vaultCode, `vaultCode seed ${seed}`).toBe(`${s.half1}${s.half2}`);
      expect(s.exitCode, `exitCode seed ${seed}`).toMatch(/^\d{4}$/);

      // Every puzzle accepts its own solution.
      for (const st of Object.values(s.stations)) {
        expect(st.puzzle.checkAnswer(st.puzzle.solution), `checkAnswer seed ${seed} ${st.id}`).toBe(true);
      }

      // Chain: book solution === half1, safe solution === vaultCode.
      expect(s.stations.bookshelf.puzzle.solution, `book sol seed ${seed}`).toBe(s.half1);
      expect(s.stations.safe.puzzle.solution, `safe sol seed ${seed}`).toBe(s.vaultCode);

      // Beats still reveal their carried values.
      expect(s.beats.desk, `beat desk seed ${seed}`).toContain(s.half2);
      expect(s.beats.bookshelf, `beat bookshelf seed ${seed}`).toContain(s.half1);
      expect(s.beats.safe, `beat safe seed ${seed}`).toContain(s.exitCode);

      // Notes carry the values verbatim.
      expect(s.notes.desk, `note desk seed ${seed}`).toContain(s.half2);
      expect(s.notes.desk, `note desk keyword seed ${seed}`).toContain(s.stations.desk.puzzle.solution);
      expect(s.notes.bookshelf, `note bookshelf seed ${seed}`).toContain(s.half1);
      expect(s.notes.bookshelf, `note bookshelf noun seed ${seed}`).toContain(s.bookNoun);
      expect(s.notes.safe, `note safe seed ${seed}`).toContain(s.exitCode);

      // bookNoun matches bookKind.
      expect(s.bookNoun, `bookNoun seed ${seed}`).toBe(s.bookKind === 'ledger-sum' ? 'Ledger' : 'Page');
    }
  });

  it('a1z26 notes decode to the keyword (encode → solution accepted)', () => {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let sawA1z26 = false;
    for (let seed = 0; seed <= 80; seed++) {
      const s = generateScenario(seed);
      if (s.noteKind !== 'a1z26') continue;
      sawA1z26 = true;
      const keyword = s.stations.desk.puzzle.solution;
      // Encode the keyword as 1-based alphabet positions, dash-separated.
      const encoded = keyword
        .split('')
        .map((c) => String(ALPHABET.indexOf(c) + 1))
        .join('-');
      // The encoded string appears in the prompt the player reads.
      expect(s.stations.desk.puzzle.prompt, `a1z26 prompt seed ${seed}`).toContain(encoded);
      // And the puzzle accepts the decoded keyword.
      expect(s.stations.desk.puzzle.checkAnswer(keyword), `a1z26 accept seed ${seed}`).toBe(true);
    }
    expect(sawA1z26).toBe(true);
  });

  it('page-sequence terms are an arithmetic sequence whose next term is half1', () => {
    let sawPageSeq = false;
    for (let seed = 0; seed <= 80; seed++) {
      const s = generateScenario(seed);
      if (s.bookKind !== 'page-sequence') continue;
      sawPageSeq = true;
      const expression = (s.stations.bookshelf.puzzle.data as { expression: string }).expression;
      // e.g. "41, 48, 55, 62, ?" — parse the leading numeric terms.
      const terms = expression
        .split(',')
        .map((t) => t.trim())
        .filter((t) => /^\d+$/.test(t))
        .map(Number);
      expect(terms.length, `terms count seed ${seed}`).toBe(4);
      const step = terms[1] - terms[0];
      expect(step, `step seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(step, `step seed ${seed}`).toBeLessThanOrEqual(9);
      // Arithmetic: constant step.
      for (let i = 1; i < terms.length; i++) {
        expect(terms[i] - terms[i - 1], `arith seed ${seed} idx ${i}`).toBe(step);
      }
      // All terms positive 2-digit.
      for (const t of terms) {
        expect(t, `term positive seed ${seed}`).toBeGreaterThanOrEqual(10);
        expect(t, `term 2-digit seed ${seed}`).toBeLessThanOrEqual(99);
      }
      // The NEXT term equals half1.
      expect(terms[terms.length - 1] + step, `next=half1 seed ${seed}`).toBe(Number(s.half1));
    }
    expect(sawPageSeq).toBe(true);
  });
});

// helper: JSON can't serialize checkAnswer fns; strip them for the determinism check.
function stripFns(s: ReturnType<typeof generateScenario>) {
  return JSON.parse(
    JSON.stringify(s, (k, v) => (k === 'checkAnswer' ? undefined : v)),
  );
}
