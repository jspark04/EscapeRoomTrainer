import { describe, it, expect } from 'vitest';
import { spatialGenerator } from './spatial';
import { mulberry32 } from '../rng';
import type { Difficulty } from '../types';

type SpatialData = { kind: 'turns' | 'relative' | 'paths' };

function kindOf(p: ReturnType<typeof spatialGenerator.generate>): string {
  return (p.data as SpatialData).kind;
}

/** Generate at a difficulty until we hit the requested kind, or fail after many tries. */
function findKind(difficulty: Difficulty, kind: string) {
  for (let seed = 1; seed < 2000; seed++) {
    const p = spatialGenerator.generate(difficulty, mulberry32(seed));
    if (kindOf(p) === kind) return p;
  }
  throw new Error(`could not produce kind ${kind} at difficulty ${difficulty}`);
}

describe('spatialGenerator', () => {
  it('produces a puzzle whose solution passes checkAnswer', () => {
    const p = spatialGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('spatial');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('is deterministic for a given seed (prompt + solution)', () => {
    const a = spatialGenerator.generate(4, mulberry32(99));
    const b = spatialGenerator.generate(4, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
    expect((a.data as SpatialData).kind).toBe((b.data as SpatialData).kind);
  });

  it('rejects wrong answers', () => {
    for (let seed = 1; seed < 50; seed++) {
      const p = spatialGenerator.generate(3, mulberry32(seed));
      expect(p.checkAnswer(p.solution + 'zzz')).toBe(false);
    }
  });

  it('every puzzle has a non-empty explanation and hint', () => {
    for (let seed = 1; seed < 80; seed++) {
      const p = spatialGenerator.generate(((seed % 5) + 1) as Difficulty, mulberry32(seed));
      expect(typeof p.explanation).toBe('string');
      expect((p.explanation ?? '').length).toBeGreaterThan(0);
      expect(typeof p.hint).toBe('string');
      expect((p.hint ?? '').length).toBeGreaterThan(0);
      expect(p.checkAnswer(p.solution)).toBe(true);
    }
  });

  describe("kind 'turns'", () => {
    it('exists at low difficulty and solution is a direction', () => {
      const p = findKind(1, 'turns');
      expect(['NORTH', 'EAST', 'SOUTH', 'WEST']).toContain(p.solution);
      expect(p.checkAnswer(p.solution)).toBe(true);
    });

    it('accepts the single-letter form and is case-insensitive', () => {
      const p = findKind(1, 'turns');
      const letter = p.solution[0];
      expect(p.checkAnswer(letter)).toBe(true);
      expect(p.checkAnswer(letter.toLowerCase())).toBe(true);
      expect(p.checkAnswer(`  ${p.solution.toLowerCase()}  `)).toBe(true);
    });
  });

  describe("kind 'relative'", () => {
    it('exists and solution is a direction word', () => {
      const p = findKind(2, 'relative');
      expect(['NORTH', 'EAST', 'SOUTH', 'WEST']).toContain(p.solution);
      expect(p.checkAnswer(p.solution)).toBe(true);
      expect(p.checkAnswer(p.solution[0])).toBe(true);
    });
  });

  describe("kind 'paths'", () => {
    it('appears at high difficulty and solution is a number', () => {
      const p = findKind(5, 'paths');
      expect(/^\d+$/.test(p.solution)).toBe(true);
      expect(p.checkAnswer(p.solution)).toBe(true);
    });

    it('accepts numbers with stray spaces/commas and rejects wrong numbers', () => {
      const p = findKind(5, 'paths');
      expect(p.checkAnswer(` ${p.solution} `)).toBe(true);
      const wrong = String(Number(p.solution) + 1);
      expect(p.checkAnswer(wrong)).toBe(false);
    });

    it('computes the binomial path count correctly (3x3 grid = 20)', () => {
      // Verify the known math: paths across an R x C grid = C(R+C, R).
      // For a 3x3 grid of cells you move 3 right + 3 up = C(6,3) = 20.
      // Find a paths puzzle and recompute from its data dimensions.
      const p = findKind(5, 'paths');
      const data = p.data as SpatialData & { rows: number; cols: number };
      const choose = (n: number, k: number) => {
        let r = 1;
        for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
        return Math.round(r);
      };
      expect(Number(p.solution)).toBe(choose(data.rows + data.cols, data.rows));
    });
  });
});
