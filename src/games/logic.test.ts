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
});
