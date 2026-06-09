import { describe, it, expect } from 'vitest';
import { validateBlueprint } from './validate';
import { studyBlueprint } from './studyBlueprint';
import type { Blueprint } from './types';

describe('validateBlueprint', () => {
  it('accepts the hand-authored study blueprint', () => {
    expect(validateBlueprint(studyBlueprint)).toEqual({ ok: true, violations: [] });
  });

  it('rejects a consumed token that is never produced', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s) =>
        s.id === 'desk' ? { ...s, consumes: ['ghost'] } : s,
      ),
    };
    const r = validateBlueprint(bp);
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/ghost/);
  });

  it('rejects when the final lock consumes an unproduced token', () => {
    const bp: Blueprint = { ...studyBlueprint, finalLock: { anchor: 'door', consumes: ['nope'] } };
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('rejects a decreasing difficulty ramp', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s, i) =>
        i === 1 ? { ...s, difficulty: 1 } : s,
      ),
    };
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('rejects duplicate anchors', () => {
    const bp: Blueprint = {
      ...studyBlueprint,
      stations: studyBlueprint.stations.map((s) => ({ ...s, anchor: 'desk' })),
    };
    expect(validateBlueprint(bp).ok).toBe(false);
  });
});
