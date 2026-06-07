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
});
