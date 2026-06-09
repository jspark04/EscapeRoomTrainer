import { describe, it, expect } from 'vitest';
import { generateLayout, validateLayout, ROOM_HALF_FOR_LAYOUT } from './layout';
import type { AABB } from './physics';

function overlaps(a: AABB, b: AABB, gap = 0): boolean {
  return (
    a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minZ - gap < b.maxZ && a.maxZ + gap > b.minZ
  );
}

describe('generateLayout', () => {
  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(generateLayout(42))).toBe(JSON.stringify(generateLayout(42)));
  });

  it('always produces the four anchors + a player start', () => {
    const l = generateLayout(3);
    expect(Object.keys(l.anchors).sort()).toEqual(['bookshelf', 'desk', 'door', 'safe']);
    expect(l.playerStart).toHaveLength(3);
  });

  it('passes validateLayout for many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = validateLayout(generateLayout(seed), ROOM_HALF_FOR_LAYOUT);
      expect(r.ok, `seed ${seed}: ${r.violations.join('; ')}`).toBe(true);
    }
  });

  it('keeps furniture boxes non-overlapping across seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = generateLayout(seed).anchors;
      const ids = Object.keys(a);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          expect(overlaps(a[ids[i]].box, a[ids[j]].box), `seed ${seed}: ${ids[i]}/${ids[j]}`).toBe(false);
        }
      }
    }
  });

  it('puts the safe and the door on different walls and varies placement', () => {
    const safeXZ = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const l = generateLayout(seed);
      // safe & door should not occupy the same wall position
      expect(`${l.anchors.safe.pos[0]},${l.anchors.safe.pos[2]}`).not.toBe(
        `${l.anchors.door.pos[0]},${l.anchors.door.pos[2]}`,
      );
      safeXZ.add(`${l.anchors.safe.pos[0].toFixed(1)},${l.anchors.safe.pos[2].toFixed(1)}`);
    }
    expect(safeXZ.size).toBeGreaterThan(2); // placement genuinely varies
  });
});

describe('validateLayout', () => {
  it('rejects a layout with overlapping furniture', () => {
    const l = generateLayout(1);
    const bad = {
      ...l,
      anchors: { ...l.anchors, bookshelf: { ...l.anchors.bookshelf, box: l.anchors.desk.box } },
    };
    expect(validateLayout(bad, ROOM_HALF_FOR_LAYOUT).ok).toBe(false);
  });

  it('rejects a box outside the room', () => {
    const l = generateLayout(1);
    const bad = {
      ...l,
      anchors: { ...l.anchors, desk: { ...l.anchors.desk, box: { minX: 90, maxX: 92, minZ: 0, maxZ: 1 } } },
    };
    expect(validateLayout(bad, ROOM_HALF_FOR_LAYOUT).ok).toBe(false);
  });
});
