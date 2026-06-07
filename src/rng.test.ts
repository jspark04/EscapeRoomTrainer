import { describe, it, expect } from 'vitest';
import { mulberry32, pick, randInt } from './rng';

describe('seeded rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it('randInt returns values within range inclusive', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = randInt(r, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('pick selects an element from the array', () => {
    const r = mulberry32(5);
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(pick(r, arr));
  });
});
