import { describe, it, expect } from 'vitest';
import { cannedNarrative, cannedHint } from './fallbacks';

describe('cannedNarrative', () => {
  it('returns non-empty intro/win/lose for the detective study', () => {
    const n = cannedNarrative('detective-study');
    expect(n.intro.length).toBeGreaterThan(0);
    expect(n.win.length).toBeGreaterThan(0);
    expect(n.lose.length).toBeGreaterThan(0);
  });
  it('falls back to generic copy for an unknown theme', () => {
    const n = cannedNarrative('mystery-cabin');
    expect(n.intro.length).toBeGreaterThan(0);
  });
});

describe('cannedHint', () => {
  it('tier 1 is a generic nudge that does not leak the answer', () => {
    const h = cannedHint({ skill: 'cipher', prompt: 'Decode XYZ', hint: 'shift 3', explanation: 'shift each letter back 3', tier: 1 });
    expect(h.hint.length).toBeGreaterThan(0);
    expect(h.hint.toLowerCase()).not.toContain('shift each letter back 3');
  });
  it('tier 2 surfaces the puzzle hint when present', () => {
    expect(cannedHint({ skill: 'cipher', prompt: 'x', hint: 'shift 3', tier: 2 }).hint).toContain('shift 3');
  });
  it('tier 3 surfaces the explanation (method) when present', () => {
    expect(cannedHint({ skill: 'cipher', prompt: 'x', explanation: 'shift each letter back 3', tier: 3 }).hint).toContain('shift each letter back 3');
  });
  it('never throws when hint/explanation are missing', () => {
    expect(() => cannedHint({ skill: 'logic', prompt: 'x', tier: 3 })).not.toThrow();
    expect(cannedHint({ skill: 'logic', prompt: 'x', tier: 3 }).hint.length).toBeGreaterThan(0);
  });
});
