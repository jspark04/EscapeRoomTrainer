export interface Interactable {
  id: string;
  x: number;
  z: number;
}
interface Vec2 {
  x: number;
  z: number;
}

/**
 * Pick the closest interactable that is within `range` and whose direction from the player
 * is within an aim cone of the look direction (dot product >= minDot). Returns null if none.
 */
export function pickTarget(
  pos: Vec2,
  look: Vec2,
  items: Interactable[],
  range: number,
  minDot: number,
): Interactable | null {
  const ll = Math.hypot(look.x, look.z) || 1;
  const lx = look.x / ll;
  const lz = look.z / ll;

  let best: Interactable | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    const dx = it.x - pos.x;
    const dz = it.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range || dist === 0) continue;
    const dot = (dx / dist) * lx + (dz / dist) * lz;
    if (dot < minDot) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = it;
    }
  }
  return best;
}
