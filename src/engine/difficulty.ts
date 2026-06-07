import type { Difficulty } from '../types';
import { clampDifficulty } from '../types';

const WINDOW = 5;
const MIN_SAMPLES = 3;
const UP = 0.8;
const DOWN = 0.4;

// Adjusts difficulty from the rolling window of recent correctness.
export function nextDifficulty(current: Difficulty, recent: boolean[]): Difficulty {
  const window = recent.slice(-WINDOW);
  if (window.length < MIN_SAMPLES) return current;
  const acc = window.filter(Boolean).length / window.length;
  if (acc >= UP) return clampDifficulty(current + 1);
  if (acc <= DOWN) return clampDifficulty(current - 1);
  return current;
}
