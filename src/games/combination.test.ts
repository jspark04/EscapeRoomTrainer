import { describe, it, expect } from 'vitest';
import { combinationGenerator } from './combination';
import { mulberry32 } from '../rng';
import type { Difficulty } from '../types';

interface CombinationData {
  clues: string[];
  length: number;
}

describe('combinationGenerator', () => {
  it('produces a puzzle whose own solution passes checkAnswer', () => {
    const p = combinationGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('combination');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('produces a solution of the right length for each difficulty', () => {
    const lengthByDiff: Record<Difficulty, number> = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 };
    ([1, 2, 3, 4, 5] as Difficulty[]).forEach((d) => {
      const p = combinationGenerator.generate(d, mulberry32(d * 1000 + 1));
      const data = p.data as CombinationData;
      expect(data.length).toBe(lengthByDiff[d]);
      expect(p.solution).toHaveLength(lengthByDiff[d]);
      expect(p.solution).toMatch(/^[0-9]+$/);
    });
  });

  it('checkAnswer strips spaces and dashes', () => {
    const p = combinationGenerator.generate(5, mulberry32(11));
    const spaced = p.solution.split('').join(' ');
    const dashed = p.solution.split('').join('-');
    expect(p.checkAnswer(`  ${spaced}  `)).toBe(true);
    expect(p.checkAnswer(dashed)).toBe(true);
  });

  it('rejects wrong answers', () => {
    const p = combinationGenerator.generate(3, mulberry32(3));
    const wrong = p.solution
      .split('')
      .map((c, i) => (i === 0 ? String((Number(c) + 1) % 10) : c))
      .join('');
    expect(p.checkAnswer(wrong)).toBe(false);
    expect(p.checkAnswer(p.solution + '0')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = combinationGenerator.generate(4, mulberry32(99));
    const b = combinationGenerator.generate(4, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
    expect((a.data as CombinationData).clues).toEqual((b.data as CombinationData).clues);
  });

  it('every puzzle has a non-empty explanation and hint', () => {
    ([1, 2, 3, 4, 5] as Difficulty[]).forEach((d) => {
      for (let seed = 0; seed < 25; seed++) {
        const p = combinationGenerator.generate(d, mulberry32(seed * 7 + d));
        expect(typeof p.explanation).toBe('string');
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
        expect(typeof p.hint).toBe('string');
        expect((p.hint ?? '').length).toBeGreaterThan(0);
      }
    });
  });

  it('the clue list is non-empty and the prompt lists the clues', () => {
    const p = combinationGenerator.generate(2, mulberry32(42));
    const data = p.data as CombinationData;
    expect(data.clues.length).toBeGreaterThan(0);
    data.clues.forEach((clue) => {
      expect(p.prompt).toContain(clue);
    });
    expect(p.prompt).toContain(`Enter the ${data.length}-digit code.`);
  });

  it('the clues are all TRUE for the actual solution across many seeds', () => {
    ([1, 2, 3, 4, 5] as Difficulty[]).forEach((d) => {
      for (let seed = 0; seed < 60; seed++) {
        const p = combinationGenerator.generate(d, mulberry32(seed * 13 + d * 5));
        const data = p.data as CombinationData;
        const digits = p.solution.split('').map(Number);
        expect(clauseSatisfied(data.clues, digits)).toBe(true);
      }
    });
  });

  it('exercises every clue kind across seeds', () => {
    const seen = new Set<string>();
    ([1, 2, 3, 4, 5] as Difficulty[]).forEach((d) => {
      for (let seed = 0; seed < 200; seed++) {
        const p = combinationGenerator.generate(d, mulberry32(seed * 17 + d));
        const data = p.data as CombinationData;
        data.clues.forEach((c) => seen.add(classifyClue(c)));
      }
    });
    // The kinds we expect to be producible somewhere in the space.
    ['reveal', 'parity', 'sum', 'order', 'distinct'].forEach((kind) => {
      expect(seen.has(kind)).toBe(true);
    });
  });
});

// --- test-side helpers: verify clue text is actually satisfied by the solution ---

function ordinalIndex(text: string): number {
  // maps "1st" -> 0, "2nd" -> 1, etc.
  const m = text.match(/(\d+)(?:st|nd|rd|th)/);
  return m ? Number(m[1]) - 1 : -1;
}

function classifyClue(c: string): string {
  if (/digit is (even|odd)/.test(c)) return 'parity';
  if (/^The \w+ digit is \d\.$/.test(c)) return 'reveal';
  if (/digits add up to/.test(c)) return 'sum';
  if (/(greater than|less than)/.test(c)) return 'order';
  if (/No two digits/.test(c)) return 'distinct';
  return 'unknown';
}

function clauseSatisfied(clues: string[], digits: number[]): boolean {
  return clues.every((c) => oneClueSatisfied(c, digits));
}

function oneClueSatisfied(c: string, digits: number[]): boolean {
  const kind = classifyClue(c);
  switch (kind) {
    case 'reveal': {
      // "The Xth digit is N."
      const idx = ordinalIndex(c);
      const m = c.match(/digit is (\d)\./);
      if (idx < 0 || idx >= digits.length || !m) return false;
      return digits[idx] === Number(m[1]);
    }
    case 'parity': {
      const idx = ordinalIndex(c);
      if (idx < 0 || idx >= digits.length) return false;
      return /even/.test(c) ? digits[idx] % 2 === 0 : digits[idx] % 2 === 1;
    }
    case 'sum': {
      const m = c.match(/add up to (\d+)/);
      if (!m) return false;
      const total = digits.reduce((a, b) => a + b, 0);
      return total === Number(m[1]);
    }
    case 'order': {
      // "The Xth digit is greater than the Yth digit." (digit ordinals appear in order)
      const ords = [...c.matchAll(/(\d+)(?:st|nd|rd|th) digit/g)].map((m) => Number(m[1]) - 1);
      if (ords.length !== 2) return false;
      const [a, b] = ords;
      if (a < 0 || b < 0 || a >= digits.length || b >= digits.length) return false;
      return /greater than/.test(c) ? digits[a] > digits[b] : digits[a] < digits[b];
    }
    case 'distinct': {
      return new Set(digits).size === digits.length;
    }
    default:
      // A clue we don't model here (e.g. the length reminder) is considered fine.
      return true;
  }
}
