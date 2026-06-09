import { describe, it, expect } from 'vitest';
import { clampToRoom, blockedByBoxes, type AABB } from './physics';

describe('clampToRoom', () => {
  it('keeps the player inside the room minus the wall margin', () => {
    // room half-extents 5 (x,z), margin 0.3
    expect(clampToRoom({ x: 10, z: 0 }, 5, 0.3)).toEqual({ x: 4.7, z: 0 });
    expect(clampToRoom({ x: -10, z: -10 }, 5, 0.3)).toEqual({ x: -4.7, z: -4.7 });
    expect(clampToRoom({ x: 1, z: 2 }, 5, 0.3)).toEqual({ x: 1, z: 2 });
  });
});

describe('blockedByBoxes', () => {
  const boxes: AABB[] = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  it('reports a position inside a furniture box (plus radius) as blocked', () => {
    expect(blockedByBoxes({ x: 0, z: 0 }, 0.3, boxes)).toBe(true);
    expect(blockedByBoxes({ x: 1.2, z: 0 }, 0.3, boxes)).toBe(true); // within radius
  });
  it('reports a clear position as not blocked', () => {
    expect(blockedByBoxes({ x: 3, z: 3 }, 0.3, boxes)).toBe(false);
  });
});

import { resolveMove } from './physics';

describe('resolveMove', () => {
  const boxes: AABB[] = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  it('slides along Z when X is blocked', () => {
    const out = resolveMove({ x: 1.5, z: 0 }, { x: 0, z: 0 }, 5, 0.3, boxes);
    expect(out.x).toBe(1.5); // X move into the box is rejected
    expect(out.z).toBe(0); // Z unchanged here
  });
  it('allows a clear move', () => {
    expect(resolveMove({ x: 3, z: 3 }, { x: 3, z: 2 }, 5, 0.3, boxes)).toEqual({ x: 3, z: 2 });
  });
});
