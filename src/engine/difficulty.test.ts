import { describe, it, expect } from 'vitest';
import { nextDifficulty } from './difficulty';

describe('nextDifficulty', () => {
  it('increases when recent accuracy is high', () => {
    expect(nextDifficulty(2, [true, true, true, true, true])).toBe(3);
  });
  it('decreases when recent accuracy is low', () => {
    expect(nextDifficulty(3, [false, false, false, true, false])).toBe(2);
  });
  it('holds in the middle band', () => {
    expect(nextDifficulty(3, [true, false, true, false, true])).toBe(3);
  });
  it('caps at 5 and floors at 1', () => {
    expect(nextDifficulty(5, [true, true, true, true, true])).toBe(5);
    expect(nextDifficulty(1, [false, false, false, false, false])).toBe(1);
  });
  it('holds until the window has at least 3 samples', () => {
    expect(nextDifficulty(2, [true, true])).toBe(2);
  });
});
