// Pure mouse-look math: glitch filtering + frame-batched, smoothed delta consumption.
//
// Why this exists: three-stdlib's PointerLockControls applies event.movementX/Y RAW and
// immediately per mousemove event. Two real problems follow:
//  1. Chromium (esp. on Windows) occasionally reports huge spurious movement spikes under
//     pointer lock — applied raw, they "teleport" the view.
//  2. Per-event application samples unevenly against the frame clock with high-polling-rate
//     mice, which reads as jitter during fast look movement.
// The cure used by production web FPS games: reject glitch deltas at the event boundary,
// accumulate the rest, and apply once per frame with light exponential smoothing.

/** Per-event deltas with |delta| above this are spurious spikes, not input. Ignored. */
export const GLITCH_THRESHOLD = 350;

/** How fast the pending look drains, per second. Higher = snappier, lower = smoother. */
const SMOOTHING_RATE = 50;

/** Reject glitch spikes; pass real input through unchanged. */
export function filterDelta(delta: number): number {
  return Math.abs(delta) > GLITCH_THRESHOLD ? 0 : delta;
}

export interface LookState {
  pendingX: number;
  pendingY: number;
}

export function createLookState(): LookState {
  return { pendingX: 0, pendingY: 0 };
}

/** Accumulate one mousemove event's (filtered) deltas. Each axis filters independently. */
export function accumulate(state: LookState, dx: number, dy: number): void {
  state.pendingX += filterDelta(dx);
  state.pendingY += filterDelta(dy);
}

/**
 * Drain a frame's worth of look from the accumulator with exponential smoothing:
 * consume fraction k = 1 - e^(-dt * RATE) each frame. At 60fps that's ~57% per frame,
 * so input lands within ~2-3 frames — imperceptible as lag, but it evens out the
 * uneven event-vs-frame timing that reads as jitter.
 */
export function consume(state: LookState, dt: number): { dx: number; dy: number } {
  const k = 1 - Math.exp(-dt * SMOOTHING_RATE);
  const dx = state.pendingX * k;
  const dy = state.pendingY * k;
  state.pendingX -= dx;
  state.pendingY -= dy;
  return { dx, dy };
}
