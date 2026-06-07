import { describe, it, expect } from 'vitest';
import { GENERATORS, getGenerator } from './index';

describe('generator registry', () => {
  it('contains all four skills', () => {
    expect(GENERATORS.map((g) => g.skill).sort()).toEqual(
      ['cipher', 'logic', 'observation', 'pattern'],
    );
  });
  it('looks up by skill', () => {
    expect(getGenerator('cipher').id).toBe('cipher');
  });
});
