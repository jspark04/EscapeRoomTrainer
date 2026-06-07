import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, uid } from '../rng';

const SYMBOLS = ['🔑', '🗝️', '🔒', '💡', '📜', '⭐', '❌', '🔴', '🔵', '🟢'];

export interface ObservationData {
  grid: string[];     // flattened row-major
  cols: number;
  flashMs: number;
  target: string;     // the symbol being counted
}

function dims(d: Difficulty): { cols: number; rows: number; flashMs: number } {
  const cols = 2 + d;          // 3..7
  const rows = 2 + Math.ceil(d / 2);
  const flashMs = Math.max(1200, 4000 - d * 500);
  return { cols, rows, flashMs };
}

export const observationGenerator: PuzzleGenerator = {
  id: 'observation',
  name: 'Observation & Memory',
  skill: 'observation',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const { cols, rows, flashMs } = dims(d);
    const palette = SYMBOLS.slice(0, Math.min(SYMBOLS.length, 3 + d));
    const grid = Array.from({ length: cols * rows }, () => pick(rng, palette));
    const target = pick(rng, palette);
    const count = grid.filter((c) => c === target).length;
    const solution = String(count);
    return {
      id: uid('obs'),
      skill: 'observation',
      prompt: `Memorize the grid. How many ${target} did you see?`,
      data: { grid, cols, flashMs, target } satisfies ObservationData,
      solution,
      hint: 'Scan row by row before the grid hides.',
      checkAnswer: (input: string) => input.trim() === solution,
    };
  },
};
