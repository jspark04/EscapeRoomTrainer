export interface Vec2 {
  x: number;
  z: number;
}
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Clamp a position to stay inside a square room of the given half-extent, minus a margin. */
export function clampToRoom(p: Vec2, halfExtent: number, margin: number): Vec2 {
  const limit = halfExtent - margin;
  return {
    x: Math.max(-limit, Math.min(limit, p.x)),
    z: Math.max(-limit, Math.min(limit, p.z)),
  };
}

/** True if the player's circle (position + radius) overlaps any furniture box. */
export function blockedByBoxes(p: Vec2, radius: number, boxes: AABB[]): boolean {
  return boxes.some(
    (b) =>
      p.x > b.minX - radius &&
      p.x < b.maxX + radius &&
      p.z > b.minZ - radius &&
      p.z < b.maxZ + radius,
  );
}

/** Resolve a desired move: clamp to room; if it would enter a box, slide per-axis. */
export function resolveMove(from: Vec2, to: Vec2, halfExtent: number, radius: number, boxes: AABB[]): Vec2 {
  const margin = radius;
  const tryX = clampToRoom({ x: to.x, z: from.z }, halfExtent, margin);
  const x = blockedByBoxes(tryX, radius, boxes) ? from.x : tryX.x;
  const tryZ = clampToRoom({ x, z: to.z }, halfExtent, margin);
  const z = blockedByBoxes(tryZ, radius, boxes) ? from.z : tryZ.z;
  return { x, z };
}
