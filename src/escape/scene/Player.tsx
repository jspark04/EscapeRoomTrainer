import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  PointerLockControls,
  useKeyboardControls,
  type KeyboardControlsEntry,
} from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { resolveMove, type AABB } from './physics';
import { ROOM_HALF } from './Room';

export type Controls = 'forward' | 'back' | 'left' | 'right';

export const KEY_MAP: KeyboardControlsEntry<Controls>[] = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'back', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
];

const PLAYER_RADIUS = 0.35;
const EYE_HEIGHT = 1.6;
const SPEED = 2.6; // metres per second

function Movement({ boxes, active }: { boxes: AABB[]; active: boolean }) {
  const { camera } = useThree();
  const [, get] = useKeyboardControls<Controls>();
  const fwd = useRef(new THREE.Vector3());
  const side = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    camera.position.y = EYE_HEIGHT;
    if (!active) return; // movement frozen while a presenter modal is open
    const { forward, back, left, right } = get();
    if (!forward && !back && !left && !right) return;

    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    if (fwd.current.lengthSq() === 0) return;
    fwd.current.normalize();
    side.current.crossVectors(fwd.current, up.current).normalize();

    dir.current.set(0, 0, 0);
    if (forward) dir.current.add(fwd.current);
    if (back) dir.current.sub(fwd.current);
    if (right) dir.current.add(side.current);
    if (left) dir.current.sub(side.current);
    if (dir.current.lengthSq() === 0) return;

    dir.current.normalize().multiplyScalar(SPEED * dt);
    const to = {
      x: camera.position.x + dir.current.x,
      z: camera.position.z + dir.current.z,
    };
    const next = resolveMove(
      { x: camera.position.x, z: camera.position.z },
      to,
      ROOM_HALF,
      PLAYER_RADIUS,
      boxes,
    );
    camera.position.x = next.x;
    camera.position.z = next.z;
  });

  return null;
}

interface PlayerProps {
  boxes: AABB[];
  /** When false, WASD movement is frozen (a presenter modal is open). */
  active: boolean;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  onLock: () => void;
  onUnlock: () => void;
}

/**
 * First-person rig: pointer-lock mouse-look + WASD walking clamped by physics.ts.
 * KeyboardControls is mounted by the parent (EscapeRoom) so it can wrap the whole UI;
 * this component only consumes the controls and owns the camera + pointer lock.
 */
export function Player({ boxes, active, controlsRef, onLock, onUnlock }: PlayerProps) {
  return (
    <>
      <Movement boxes={boxes} active={active} />
      <PointerLockControls ref={controlsRef} onLock={onLock} onUnlock={onUnlock} />
    </>
  );
}
