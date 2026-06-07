import { describe, it, expect } from 'vitest';
import { GENERATORS, getGenerator } from './index';

const EXPECTED_SKILLS = [
  'anagram',
  'cipher',
  'combination',
  'logic',
  'math',
  'observation',
  'pattern',
  'spatial',
];

describe('generator registry', () => {
  it('contains all eight skills', () => {
    expect(GENERATORS.map((g) => g.skill).sort()).toEqual(EXPECTED_SKILLS);
  });

  it('every generator has a unique skill and a non-empty name', () => {
    const skills = GENERATORS.map((g) => g.skill);
    expect(new Set(skills).size).toBe(skills.length);
    for (const g of GENERATORS) expect(g.name.length).toBeGreaterThan(0);
  });

  it('looks up by skill', () => {
    expect(getGenerator('cipher').id).toBe('cipher');
    expect(getGenerator('spatial').id).toBe('spatial');
  });
});
