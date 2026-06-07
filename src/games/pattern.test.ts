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
});
