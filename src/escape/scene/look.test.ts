import { describe, it, expect } from 'vitest';
import { filterDelta, createLookState, accumulate, consume, GLITCH_THRESHOLD } from './look';

describe('filterDelta', () => {
  it('passes normal mouse deltas through unchanged', () => {
    expect(filterDelta(4)).toBe(4);
    expect(filterDelta(-37)).toBe(-37);
    expect(filterDelta(180)).toBe(180);
  });

  it('rejects spurious pointer-lock spikes entirely (returns 0)', () => {
    // Chromium-on-Windows occasionally reports huge bogus movementX/Y under pointer lock;
    // applying them raw teleports the camera. Isolated spikes are glitches, not input.
    expect(filterDelta(GLITCH_THRESHOLD + 1)).toBe(0);
    expect(filterDelta(-3000)).toBe(0);
    expect(filterDelta(30000)).toBe(0);
  });

  it('keeps legitimately fast flicks just under the threshold', () => {
    expect(filterDelta(GLITCH_THRESHOLD)).toBe(GLITCH_THRESHOLD);
    expect(filterDelta(-GLITCH_THRESHOLD)).toBe(-GLITCH_THRESHOLD);
  });
});

describe('look accumulation + per-frame consumption', () => {
  it('accumulates filtered deltas across events', () => {
    const s = createLookState();
    accumulate(s, 10, 5);
    accumulate(s, 20, -3);
    expect(s.pendingX).toBe(30);
    expect(s.pendingY).toBe(2);
  });

  it('a glitch event contributes nothing to the accumulator', () => {
    const s = createLookState();
    accumulate(s, 10, 0);
    accumulate(s, 5000, 4000); // spike → ignored on both axes
    expect(s.pendingX).toBe(10);
    expect(s.pendingY).toBe(0);
  });

  it('consume drains the accumulator smoothly and converges to zero', () => {
    const s = createLookState();
    accumulate(s, 100, 50);
    const first = consume(s, 1 / 60);
    // consumes a substantial fraction in one 60fps frame...
    expect(first.dx).toBeGreaterThan(50);
    expect(first.dx).toBeLessThan(100);
    expect(first.dy).toBeGreaterThan(25);
    // ...and the remainder drains over subsequent frames.
    let total = first.dx;
    for (let i = 0; i < 20; i++) total += consume(s, 1 / 60).dx;
    expect(total).toBeCloseTo(100, 1);
    expect(Math.abs(s.pendingX)).toBeLessThan(0.1);
  });

  it('consume with a huge dt drains everything (no buildup when tab regains focus)', () => {
    const s = createLookState();
    accumulate(s, 100, 100);
    const out = consume(s, 1); // 1s frame gap
    expect(out.dx).toBeCloseTo(100, 5);
    expect(s.pendingX).toBeCloseTo(0, 5);
  });
});
