import type { AABB } from './physics';
import { mulberry32, shuffle } from '../../rng';

// The room is a fixed square; geometry varies WITHIN it. Mirrors Room's ROOM_HALF (5).
export const ROOM_HALF_FOR_LAYOUT = 5;

export interface Anchor {
  pos: [number, number, number];
  rotation: [number, number, number];
  box: AABB;
}
export interface Layout {
  anchors: Record<string, Anchor>;
  playerStart: [number, number, number];
}

type Wall = 'north' | 'south' | 'east' | 'west';
const WALLS: Wall[] = ['north', 'south', 'east', 'west'];

// Four disjoint interior quadrant centers for floor furniture (kept away from the room
// center so the player always has clear central space and approach room).
const QUADRANTS: Array<{ cx: number; cz: number }> = [
  { cx: -2.6, cz: -2.6 },
  { cx: 2.6, cz: -2.6 },
  { cx: -2.6, cz: 2.6 },
  { cx: 2.6, cz: 2.6 },
];

const HALF_W = 0.9; // furniture footprint half-width (x)
const HALF_D = 0.6; // furniture footprint half-depth (z)

function floorAnchor(cx: number, cz: number): Anchor {
  return {
    pos: [cx, 0, cz],
    rotation: [0, 0, 0],
    box: { minX: cx - HALF_W, maxX: cx + HALF_W, minZ: cz - HALF_D, maxZ: cz + HALF_D },
  };
}

// A wall-mounted anchor (safe at y=1.5, door at y=0), facing inward, at offset `along` the wall.
function wallAnchor(wall: Wall, along: number, y: number): Anchor {
  const inset = 0.1;
  const t = 0.6; // half-thickness of the wall item's collision box
  switch (wall) {
    case 'north':
      return { pos: [along, y, -ROOM_HALF_FOR_LAYOUT + inset], rotation: [0, 0, 0], box: { minX: along - 0.75, maxX: along + 0.75, minZ: -ROOM_HALF_FOR_LAYOUT, maxZ: -ROOM_HALF_FOR_LAYOUT + t } };
    case 'south':
      return { pos: [along, y, ROOM_HALF_FOR_LAYOUT - inset], rotation: [0, Math.PI, 0], box: { minX: along - 0.75, maxX: along + 0.75, minZ: ROOM_HALF_FOR_LAYOUT - t, maxZ: ROOM_HALF_FOR_LAYOUT } };
    case 'east':
      return { pos: [ROOM_HALF_FOR_LAYOUT - inset, y, along], rotation: [0, -Math.PI / 2, 0], box: { minX: ROOM_HALF_FOR_LAYOUT - t, maxX: ROOM_HALF_FOR_LAYOUT, minZ: along - 0.75, maxZ: along + 0.75 } };
    case 'west':
      return { pos: [-ROOM_HALF_FOR_LAYOUT + inset, y, along], rotation: [0, Math.PI / 2, 0], box: { minX: -ROOM_HALF_FOR_LAYOUT, maxX: -ROOM_HALF_FOR_LAYOUT + t, minZ: along - 0.75, maxZ: along + 0.75 } };
  }
}

export function generateLayout(seed: number): Layout {
  const rng = mulberry32(seed);

  // Two distinct walls for the wall items; safe and door each get a small "along" jitter.
  const [safeWall, doorWall] = shuffle(rng, WALLS).slice(0, 2);
  const jitter = () => Math.round((rng() * 4 - 2) * 10) / 10; // [-2, 2]
  const safe = wallAnchor(safeWall, jitter(), 1.5);
  const door = wallAnchor(doorWall, jitter(), 0);

  // Two distinct quadrants for the floor items.
  const [qA, qB] = shuffle(rng, QUADRANTS).slice(0, 2);
  const desk = floorAnchor(qA.cx, qA.cz);
  const bookshelf = floorAnchor(qB.cx, qB.cz);

  return {
    anchors: { desk, bookshelf, safe, door },
    playerStart: [0, 1.6, 0], // room center is always clear (furniture lives in quadrants/walls)
  };
}

export interface LayoutValidation {
  ok: boolean;
  violations: string[];
}

const APPROACH = 1.2; // how far in front of an item the player stands to interact
const PLAYER_R = 0.35;

function boxesOverlap(a: AABB, b: AABB, gap: number): boolean {
  return a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minZ - gap < b.maxZ && a.maxZ + gap > b.minZ;
}
function pointInBox(x: number, z: number, b: AABB, pad: number): boolean {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
}

export function validateLayout(layout: Layout, half: number): LayoutValidation {
  const violations: string[] = [];
  const entries = Object.entries(layout.anchors);

  for (const [id, a] of entries) {
    if (a.box.minX < -half || a.box.maxX > half || a.box.minZ < -half || a.box.maxZ > half) {
      violations.push(`anchor "${id}" box is outside the room`);
    }
  }
  // Pairwise non-overlap (raw boxes must not intersect).
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (boxesOverlap(entries[i][1].box, entries[j][1].box, 0)) {
        violations.push(`anchors "${entries[i][0]}" and "${entries[j][0]}" overlap`);
      }
    }
  }
  // Player start must be clear.
  const [psx, , psz] = layout.playerStart;
  for (const [id, a] of entries) {
    if (pointInBox(psx, psz, a.box, PLAYER_R)) violations.push(`player start is inside "${id}"`);
  }
  // Each item must have a clear approach point toward the room center, inside the room and
  // not inside another item's box (so the player can stand there to interact).
  for (const [id, a] of entries) {
    const cx = (a.box.minX + a.box.maxX) / 2;
    const cz = (a.box.minZ + a.box.maxZ) / 2;
    const len = Math.hypot(cx, cz) || 1;
    const ax = cx - (cx / len) * APPROACH;
    const az = cz - (cz / len) * APPROACH;
    if (ax < -half + PLAYER_R || ax > half - PLAYER_R || az < -half + PLAYER_R || az > half - PLAYER_R) {
      violations.push(`approach point for "${id}" is out of bounds`);
    }
    for (const [oid, b] of entries) {
      if (oid !== id && pointInBox(ax, az, b.box, PLAYER_R)) {
        violations.push(`approach point for "${id}" is blocked by "${oid}"`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
