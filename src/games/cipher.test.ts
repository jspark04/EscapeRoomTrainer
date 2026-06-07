import { describe, it, expect } from 'vitest';
import { cipherGenerator } from './cipher';
import { mulberry32 } from '../rng';

describe('cipherGenerator', () => {
  it('produces a puzzle whose solution passes checkAnswer', () => {
    const p = cipherGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('cipher');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('checkAnswer is case- and whitespace-insensitive', () => {
    const p = cipherGenerator.generate(2, mulberry32(11));
    expect(p.checkAnswer(`  ${p.solution.toUpperCase()}  `)).toBe(true);
  });

  it('rejects wrong answers', () => {
    const p = cipherGenerator.generate(3, mulberry32(3));
    expect(p.checkAnswer(p.solution + 'x')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = cipherGenerator.generate(2, mulberry32(99));
    const b = cipherGenerator.generate(2, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });

  it('always sets a non-empty explanation', () => {
    for (let d = 1 as const; ; ) {
      for (let seed = 0; seed < 40; seed++) {
        const p = cipherGenerator.generate(d, mulberry32(seed * 31 + d));
        expect(typeof p.explanation).toBe('string');
        expect((p.explanation ?? '').length).toBeGreaterThan(0);
        expect(p.checkAnswer(p.solution)).toBe(true);
      }
      if (d >= 5) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d as any)++;
    }
  });

  // Helper: find a seed at a difficulty that produces the requested kind.
  function findKind(d: 1 | 2 | 3 | 4 | 5, kind: string) {
    for (let seed = 0; seed < 2000; seed++) {
      const p = cipherGenerator.generate(d, mulberry32(seed));
      if ((p.data as { kind: string }).kind === kind) return p;
    }
    throw new Error(`kind ${kind} not found at difficulty ${d}`);
  }

  const cases: Array<{ kind: string; d: 1 | 2 | 3 | 4 | 5 }> = [
    { kind: 'caesar', d: 1 },
    { kind: 'a1z26', d: 1 },
    { kind: 'atbash', d: 1 },
    { kind: 'reverse', d: 1 },
    { kind: 'morse', d: 2 },
    { kind: 'keypad', d: 3 },
    { kind: 'binary', d: 3 },
    { kind: 'railfence', d: 4 },
    { kind: 'substitution', d: 4 },
    { kind: 'vigenere', d: 5 },
  ];

  for (const { kind, d } of cases) {
    it(`kind "${kind}" decodes to its own solution and has explanation`, () => {
      const p = findKind(d, kind);
      expect((p.data as { kind: string }).kind).toBe(kind);
      expect(p.checkAnswer(p.solution)).toBe(true);
      expect(p.checkAnswer(`  ${p.solution.toLowerCase()} `)).toBe(true);
      expect(p.checkAnswer(p.solution + 'z')).toBe(false);
      expect(typeof p.explanation).toBe('string');
      expect((p.explanation ?? '').length).toBeGreaterThan(0);
      expect(p.hint && p.hint.length).toBeGreaterThan(0);
    });
  }

  it('keeps railfence and vigenere deterministic', () => {
    const a = cipherGenerator.generate(5, mulberry32(1234));
    const b = cipherGenerator.generate(5, mulberry32(1234));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
    expect(a.hint).toBe(b.hint);
    expect(a.explanation).toBe(b.explanation);
  });
});
