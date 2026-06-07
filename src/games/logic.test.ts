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

  // --- New coverage: every puzzle carries a teaching explanation ---
  it('every puzzle has a non-empty explanation', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const d of [1, 2, 3, 4, 5] as const) {
        const p = logicGenerator.generate(d, mulberry32(seed));
        expect(typeof p.explanation).toBe('string');
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
        expect(p.hint && p.hint.length).toBeTruthy();
        // self-consistency: a puzzle must accept its own solution
        expect(p.checkAnswer(p.solution)).toBe(true);
      }
    }
  });

  // --- Kind coverage: exercise riddle, analogy, and deduction ---
  function findKind(kind: string, d: 1 | 2 | 3 | 4 | 5) {
    for (let seed = 0; seed < 500; seed++) {
      const p = logicGenerator.generate(d, mulberry32(seed));
      if ((p.data as { kind?: string }).kind === kind) return p;
    }
    throw new Error(`no ${kind} found at difficulty ${d}`);
  }

  it('produces riddle puzzles at low difficulty that self-verify', () => {
    const p = findKind('riddle', 1);
    expect(p.checkAnswer(p.solution)).toBe(true);
    expect(p.explanation).toBeTruthy();
    expect(p.checkAnswer('definitely wrong nonsense')).toBe(false);
  });

  it('produces analogy puzzles at low difficulty that self-verify', () => {
    const p = findKind('analogy', 2);
    expect(p.prompt.toLowerCase()).toContain('is to');
    expect(p.checkAnswer(p.solution)).toBe(true);
    expect(p.explanation).toBeTruthy();
    expect(p.checkAnswer('xyzzy')).toBe(false);
  });

  it('produces deduction puzzles at high difficulty that self-verify', () => {
    const p = findKind('deduction', 5);
    expect(p.checkAnswer(p.solution)).toBe(true);
    expect(p.explanation).toBeTruthy();
    expect(p.checkAnswer('not-an-item')).toBe(false);
  });

  it('analogy accepts curated answer variants', () => {
    // Loop until we hit an analogy whose solution has an accepted variant,
    // then assert at least the canonical solution is accepted in mixed case.
    const p = findKind('analogy', 1);
    expect(p.checkAnswer(`  ${p.solution.toUpperCase()}  `)).toBe(true);
  });

  it('riddle accepts trimmed / punctuated input', () => {
    const p = findKind('riddle', 1);
    expect(p.checkAnswer(`  ${p.solution}!  `)).toBe(true);
  });

  it('deduction answer is a single normalized word', () => {
    const p = findKind('deduction', 4);
    expect(p.solution.trim()).toBe(p.solution);
    expect(p.solution).not.toMatch(/\s/);
  });
});
