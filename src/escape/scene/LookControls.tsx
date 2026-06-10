import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { accumulate, consume, createLookState } from './look';

/** Matches three-stdlib PointerLockControls' feel: radians per pixel of mouse movement. */
const SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

export interface LookControlsHandle {
  readonly isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

/**
 * Pointer-lock mouse-look, replacing three-stdlib's PointerLockControls.
 *
 * Why not the stock control: it applies event.movementX/Y RAW and immediately per
 * mousemove event. Chromium's pointer-lock spike bug then teleports the view, and
 * per-event application reads as jitter during fast look movement with high-rate mice.
 * Here events only ACCUMULATE (with glitch filtering in look.ts); the camera rotates
 * once per frame in useFrame with light smoothing.
 *
 * Like the drei version, a document-level click requests pointer lock — the parent
 * mounts this component only while playing with no modal open, so modal clicks can't
 * re-capture the pointer (same conditional-mount contract as before).
 */
export const LookControls = forwardRef<LookControlsHandle>(function LookControls(_, ref) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const state = useMemo(() => createLookState(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useImperativeHandle(
    ref,
    () => ({
      get isLocked() {
        return document.pointerLockElement === gl.domElement;
      },
      lock: () => gl.domElement.requestPointerLock(),
      unlock: () => document.exitPointerLock(),
    }),
    [gl],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      accumulate(state, e.movementX, e.movementY);
    };
    const onClick = () => {
      if (document.pointerLockElement !== gl.domElement) gl.domElement.requestPointerLock();
    };
    const onLockChange = () => {
      // Drop any motion buffered across a lock transition so re-locking never jumps.
      state.pendingX = 0;
      state.pendingY = 0;
    };
    const onLockError = () => {
      // Browsers enforce a cooldown between exit and re-lock; the next click will retry.
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, [gl, state]);

  useFrame((_s, dt) => {
    const { dx, dy } = consume(state, dt);
    if (dx === 0 && dy === 0) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= dx * SENSITIVITY;
    euler.x -= dy * SENSITIVITY;
    euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x));
    camera.quaternion.setFromEuler(euler);
  });

  return null;
});
