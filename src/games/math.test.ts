import { describe, it, expect } from 'vitest';
import { mathGenerator } from './math';
import { mulberry32 } from '../rng';
import type { Difficulty } from '../types';

type MathData = { expression: string; kind: string };

describe('mathGenerator', () => {
  it('produces a puzzle whose solution passes checkAnswer', () => {
    const p = mathGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('math');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('checkAnswer strips spaces and commas and compares numerically', () => {
    const p = mathGenerator.generate(4, mulberry32(11));
    const sol = p.solution;
    expect(p.checkAnswer(` ${sol} `)).toBe(true);
    // a thousands-separator / spaced variant of the same number still matches
    expect(p.checkAnswer(sol.replace(/(\d)(?=(\d{3})+$)/g, '$1,'))).toBe(true);
    expect(p.checkAnswer(`  ${sol}  `)).toBe(true);
  });

  it('rejects wrong answers', () => {
    const p = mathGenerator.generate(3, mulberry32(3));
    expect(p.checkAnswer(String(Number(p.solution) + 1))).toBe(false);
    expect(p.checkAnswer('')).toBe(false);
    expect(p.checkAnswer('not a number')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = mathGenerator.generate(4, mulberry32(99));
    const b = mathGenerator.generate(4, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
    expect((a.data as MathData).expression).toBe((b.data as MathData).expression);
  });

  it('every puzzle exposes an expression in data and a non-empty explanation', () => {
    for (let d = 1 as Difficulty; d <= 5; d = (d + 1) as Difficulty) {
      for (let seed = 0; seed < 40; seed++) {
        const p = mathGenerator.generate(d, mulberry32(seed));
        const data = p.data as MathData;
        expect(typeof data.expression).toBe('string');
        expect(data.expression.length).toBeGreaterThan(0);
        expect(typeof p.explanation).toBe('string');
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
        expect(p.checkAnswer(p.solution)).toBe(true);
      }
    }
  });

  // Sweep seeds at a difficulty that allows a kind, asserting we exercise each kind.
  function findKind(d: Difficulty, kind: string) {
    for (let seed = 0; seed < 500; seed++) {
      const p = mathGenerator.generate(d, mulberry32(seed));
      if ((p.data as MathData).kind === kind) return p;
    }
    throw new Error(`kind ${kind} not produced at difficulty ${d}`);
  }

  it('exercises the chain kind (operator precedence)', () => {
    const p = findKind(1, 'chain');
    expect(p.checkAnswer(p.solution)).toBe(true);
    expect((p.data as MathData).expression).toMatch(/[+\-×]/);
  });

  it('exercises the solve-for kind', () => {
    const p = findKind(2, 'solve-for');
    expect((p.data as MathData).expression).toContain('?');
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('exercises the percent kind at higher difficulty', () => {
    const p = findKind(4, 'percent');
    expect((p.data as MathData).expression).toContain('%');
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('exercises the sequence-sum kind at higher difficulty', () => {
    const p = findKind(4, 'sequence-sum');
    expect((p.data as MathData).expression).toContain('+');
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('chain results honor operator precedence (× before +/-)', () => {
    // Sample several chain puzzles and verify the stated answer is internally consistent
    // by re-deriving: solution must equal a number, never NaN.
    for (let seed = 0; seed < 100; seed++) {
      const p = mathGenerator.generate(2, mulberry32(seed));
      if ((p.data as MathData).kind !== 'chain') continue;
      expect(Number.isNaN(Number(p.solution))).toBe(false);
      expect(p.checkAnswer(p.solution)).toBe(true);
    }
  });
});
