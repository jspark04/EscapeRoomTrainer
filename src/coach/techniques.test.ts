import { describe, it, expect } from 'vitest';
import { TECHNIQUES, getTechnique } from './techniques';
import { GENERATORS } from '../games';

describe('techniques', () => {
  it('covers every registered skill', () => {
    for (const g of GENERATORS) {
      expect(getTechnique(g.skill), `missing technique for ${g.skill}`).toBeDefined();
    }
  });

  it('has non-empty teaching content for each entry', () => {
    for (const t of TECHNIQUES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.whatToLookFor.length).toBeGreaterThan(0);
      expect(t.howToCrack.length).toBeGreaterThan(0);
      expect(t.example.puzzle.length).toBeGreaterThan(0);
      expect(t.example.solution.length).toBeGreaterThan(0);
      expect(t.example.walkthrough.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate skills', () => {
    const skills = TECHNIQUES.map((t) => t.skill);
    expect(new Set(skills).size).toBe(skills.length);
  });
});
