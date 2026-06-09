import { describe, it, expect } from 'vitest';
import { pickTarget, type Interactable } from './interaction';

const items: Interactable[] = [
  { id: 'desk', x: 0, z: -3 },
  { id: 'safe', x: 3, z: 0 },
];

describe('pickTarget', () => {
  it('selects the interactable the player faces within range', () => {
    // facing -Z toward the desk
    expect(pickTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, items, 4, 0.6)?.id).toBe('desk');
  });
  it('returns null when nothing is within the aim cone', () => {
    // facing +X but only desk is in front-ish; safe is at +X though
    expect(pickTarget({ x: 0, z: 0 }, { x: 1, z: 0 }, items, 4, 0.6)?.id).toBe('safe');
    expect(pickTarget({ x: 0, z: 0 }, { x: -1, z: 0 }, items, 4, 0.6)).toBeNull();
  });
  it('returns null when the target is out of range', () => {
    expect(pickTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, items, 2, 0.6)).toBeNull();
  });
});
