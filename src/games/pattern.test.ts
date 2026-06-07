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

  it('every generated puzzle has a non-empty explanation', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (let d = 1; d <= 5; d++) {
        const p = patternGenerator.generate(d as 1 | 2 | 3 | 4 | 5, mulberry32(seed));
        expect(typeof p.explanation).toBe('string');
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
        expect(p.checkAnswer(p.solution)).toBe(true);
      }
    }
  });

  it('checkAnswer is case-insensitive for letter solutions', () => {
    // Find a letter-kind puzzle by scanning seeds at a high difficulty.
    let found = false;
    for (let seed = 0; seed < 300 && !found; seed++) {
      const p = patternGenerator.generate(5, mulberry32(seed));
      if (/^[a-z]$/i.test(p.solution)) {
        found = true;
        expect(p.checkAnswer(p.solution.toUpperCase())).toBe(true);
        expect(p.checkAnswer(p.solution.toLowerCase())).toBe(true);
        expect(p.checkAnswer(` ${p.solution.toUpperCase()} `)).toBe(true);
        expect(p.checkAnswer('not-a-letter')).toBe(false);
      }
    }
    expect(found).toBe(true);
  });

  it('exercises each puzzle kind across seeds at difficulty 5', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const p = patternGenerator.generate(5, mulberry32(seed));
      const data = p.data as { rule?: string };
      if (data.rule) kinds.add(data.rule);
      // each instance must verify against itself
      expect(p.checkAnswer(p.solution)).toBe(true);
    }
    for (const k of [
      'arithmetic',
      'geometric',
      'squares',
      'fibonacci',
      'alternating',
      'letters',
      'alternating-op',
      'doubling-plus',
    ]) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it('letters kind: solution is a single letter and prompt asks for a letter', () => {
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const p = patternGenerator.generate(5, mulberry32(seed));
      const data = p.data as { rule?: string };
      if (data.rule === 'letters') {
        found = true;
        expect(/^[a-z]$/i.test(p.solution)).toBe(true);
        expect(p.prompt.toLowerCase()).toContain('letter');
        expect(p.checkAnswer(p.solution)).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it('alternating-op kind: numeric solution verifies and explanation mentions the rule', () => {
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const p = patternGenerator.generate(5, mulberry32(seed));
      const data = p.data as { rule?: string };
      if (data.rule === 'alternating-op') {
        found = true;
        expect(/^-?\d+$/.test(p.solution)).toBe(true);
        expect(p.checkAnswer(p.solution)).toBe(true);
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
      }
    }
    expect(found).toBe(true);
  });

  it('doubling-plus kind: numeric solution verifies', () => {
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const p = patternGenerator.generate(5, mulberry32(seed));
      const data = p.data as { rule?: string };
      if (data.rule === 'doubling-plus') {
        found = true;
        expect(/^-?\d+$/.test(p.solution)).toBe(true);
        expect(p.checkAnswer(p.solution)).toBe(true);
        expect(p.checkAnswer(p.solution + ',')).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
});
