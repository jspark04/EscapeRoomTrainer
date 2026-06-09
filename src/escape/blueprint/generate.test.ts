import { describe, it, expect } from 'vitest';
import { generateBlueprint } from './generate';
import { validateBlueprint } from './validate';

describe('generateBlueprint', () => {
  it('is deterministic for a given seed', () => {
    const a = generateBlueprint(42);
    const b = generateBlueprint(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a valid (solvable) blueprint for many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const bp = generateBlueprint(seed);
      const r = validateBlueprint(bp);
      expect(r.ok, `seed ${seed}: ${r.violations.join('; ')}`).toBe(true);
    }
  });

  it('uses the fixed anchor slots with the safe as the combination finale', () => {
    const bp = generateBlueprint(7);
    expect(bp.stations.map((s) => s.anchor)).toEqual(['desk', 'bookshelf', 'safe']);
    const safe = bp.stations[2];
    expect(safe.skill).toBe('combination');
    expect(safe.presenter).toBe('diegetic');
    expect(bp.stations[0].presenter).toBe('overlay');
    expect(bp.stations[1].presenter).toBe('overlay');
  });

  it('varies the two overlay skills (distinct, never combination) across seeds', () => {
    const pairs = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const bp = generateBlueprint(seed);
      const a = bp.stations[0].skill;
      const b = bp.stations[1].skill;
      expect(a).not.toBe('combination');
      expect(b).not.toBe('combination');
      expect(a).not.toBe(b);
      pairs.add(`${a}/${b}`);
    }
    expect(pairs.size).toBeGreaterThan(3); // genuinely varies
  });

  it('chains tokens to the door and ramps difficulty', () => {
    const bp = generateBlueprint(99);
    expect(bp.stations[0].consumes).toEqual([]);
    expect(bp.stations[1].consumes).toEqual(bp.stations[0].produces);
    expect(bp.stations[2].consumes).toEqual(bp.stations[1].produces);
    expect(bp.finalLock.consumes).toEqual(bp.stations[2].produces);
    expect(bp.stations[2].produces).toEqual(['exitCode']);
    expect(bp.stations[1].difficulty).toBeGreaterThanOrEqual(bp.stations[0].difficulty);
    expect(bp.stations[2].difficulty).toBeGreaterThanOrEqual(bp.stations[1].difficulty);
  });
});
