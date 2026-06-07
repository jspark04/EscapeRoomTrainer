import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

const SYMBOLS = ['🔑', '🗝️', '🔒', '💡', '📜', '⭐', '❌', '🔴', '🔵', '🟢'];

type Kind = 'count' | 'position' | 'whatchanged';

interface ObservationBase {
  cols: number;
  flashMs: number;
  kind: Kind;
  grid: string[]; // flattened row-major; for 'whatchanged' this is the FLASHED grid (gridA)
}

export interface ObservationCount extends ObservationBase {
  kind: 'count';
  target: string; // the symbol being counted
}

export interface ObservationPosition extends ObservationBase {
  kind: 'position';
  row: number; // 1-indexed
  col: number; // 1-indexed
}

export interface ObservationWhatChanged extends ObservationBase {
  kind: 'whatchanged';
  gridB: string[]; // identical to grid except ONE cell; shown permanently after the flash
}

export type ObservationData = ObservationCount | ObservationPosition | ObservationWhatChanged;

function dims(d: Difficulty): { cols: number; rows: number; flashMs: number } {
  const cols = 2 + d; // 3..7
  const rows = 2 + Math.ceil(d / 2);
  const flashMs = Math.max(1200, 4000 - d * 500);
  return { cols, rows, flashMs };
}

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['count'];
  if (d <= 2) return ['count', 'position'];
  return ['count', 'position', 'whatchanged'];
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
    const kind = pick(rng, kindsFor(d));

    if (kind === 'position') {
      const row = randInt(rng, 1, rows);
      const col = randInt(rng, 1, cols);
      const symbol = grid[(row - 1) * cols + (col - 1)];
      const data: ObservationData = { kind: 'position', grid, cols, flashMs, row, col };
      return {
        id: uid('obs'),
        skill: 'observation',
        prompt: `Memorize the grid. What symbol was at row ${row}, column ${col}?`,
        data,
        solution: symbol,
        hint: 'Count down to the row, then across to the column, before the grid hides.',
        explanation: `Lock onto the target cell while the grid is visible: count ${row} row(s) down and ${col} column(s) across to read ${symbol}. Anchoring on the asked coordinate beats trying to memorize the whole grid.`,
        checkAnswer: (input: string) => input.trim() === symbol,
      };
    }

    if (kind === 'whatchanged') {
      const gridB = [...grid];
      const idx = randInt(rng, 0, grid.length - 1);
      const others = palette.filter((s) => s !== grid[idx]);
      const newSymbol = pick(rng, others);
      gridB[idx] = newSymbol;
      const data: ObservationData = { kind: 'whatchanged', grid, gridB, cols, flashMs };
      const row = Math.floor(idx / cols) + 1;
      const col = (idx % cols) + 1;
      return {
        id: uid('obs'),
        skill: 'observation',
        prompt: 'One symbol changed from what you saw. What is the NEW symbol now shown?',
        data,
        solution: newSymbol,
        hint: 'Compare the grid now in front of you against your mental snapshot, cell by cell.',
        explanation: `The cell at row ${row}, column ${col} switched to ${newSymbol}. Scan the displayed grid against your memory row by row; the one cell that does not match is the change, and its current symbol is the answer.`,
        checkAnswer: (input: string) => input.trim() === newSymbol,
      };
    }

    // kind === 'count'
    const target = pick(rng, palette);
    const count = grid.filter((c) => c === target).length;
    const solution = String(count);
    const data: ObservationData = { kind: 'count', grid, cols, flashMs, target };
    return {
      id: uid('obs'),
      skill: 'observation',
      prompt: `Memorize the grid. How many ${target} did you see?`,
      data,
      solution,
      hint: 'Scan row by row before the grid hides.',
      explanation: `Sweep the grid one row at a time and tally only the ${target} symbols; there are ${count}. A steady left-to-right, top-to-bottom pass avoids double-counting.`,
      checkAnswer: (input: string) => input.trim() === solution,
    };
  },
};
