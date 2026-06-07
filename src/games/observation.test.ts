import { describe, it, expect } from 'vitest';
import {
  observationGenerator,
  type ObservationData,
  type ObservationCount,
  type ObservationPosition,
  type ObservationWhatChanged,
} from './observation';
import { mulberry32 } from '../rng';

// Loop seeds until we generate a puzzle of the requested kind, so we can
// assert per-kind behavior even though kind is chosen via rng.
function firstOfKind(kind: ObservationData['kind'], difficulty: 1 | 2 | 3 | 4 | 5) {
  for (let seed = 0; seed < 500; seed++) {
    const p = observationGenerator.generate(difficulty, mulberry32(seed));
    if ((p.data as ObservationData).kind === kind) return p;
  }
  throw new Error(`no ${kind} puzzle found at difficulty ${difficulty}`);
}

describe('observationGenerator', () => {
  it('builds a grid and an answerable question', () => {
    const p = observationGenerator.generate(2, mulberry32(6));
    const data = p.data as ObservationData;
    expect(data.grid.length).toBeGreaterThan(0);
    expect(data.flashMs).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('grid grows with difficulty', () => {
    const small = observationGenerator.generate(1, mulberry32(1)).data as ObservationData;
    const big = observationGenerator.generate(5, mulberry32(1)).data as ObservationData;
    expect(big.grid.length).toBeGreaterThanOrEqual(small.grid.length);
  });

  it('is deterministic for a seed (prompt + solution)', () => {
    const a = observationGenerator.generate(3, mulberry32(21));
    const b = observationGenerator.generate(3, mulberry32(21));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });

  it('is deterministic for a seed (full data)', () => {
    const a = observationGenerator.generate(4, mulberry32(99));
    const b = observationGenerator.generate(4, mulberry32(99));
    expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
  });

  it('every puzzle has a non-empty explanation', () => {
    for (let seed = 0; seed < 60; seed++) {
      const d = ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      const p = observationGenerator.generate(d, mulberry32(seed));
      expect(typeof p.explanation).toBe('string');
      expect((p.explanation ?? '').length).toBeGreaterThan(0);
    }
  });

  it('exposes a discriminated kind field', () => {
    const p = observationGenerator.generate(3, mulberry32(7));
    const data = p.data as ObservationData;
    expect(['count', 'position', 'whatchanged']).toContain(data.kind);
  });

  describe('count kind', () => {
    it('accepts its own solution and rejects a wrong count', () => {
      const p = firstOfKind('count', 1);
      const data = p.data as ObservationCount;
      expect(data.kind).toBe('count');
      expect(data.target).toBeTruthy();
      expect(p.checkAnswer(p.solution)).toBe(true);
      expect(p.checkAnswer(String(Number(p.solution) + 1))).toBe(false);
      // solution equals the actual count of target symbols in the grid
      const actual = data.grid.filter((c) => c === data.target).length;
      expect(p.solution).toBe(String(actual));
      expect(p.explanation && p.explanation.length).toBeTruthy();
    });
  });

  describe('position kind', () => {
    it('accepts the symbol at the asked cell and rejects others', () => {
      const p = firstOfKind('position', 3);
      const data = p.data as ObservationPosition;
      expect(data.kind).toBe('position');
      expect(typeof data.row).toBe('number');
      expect(typeof data.col).toBe('number');
      // solution is the symbol at (row, col), 1-indexed, row-major
      const idx = (data.row - 1) * data.cols + (data.col - 1);
      expect(data.grid[idx]).toBe(p.solution);
      expect(p.checkAnswer(p.solution)).toBe(true);
      expect(p.checkAnswer(`  ${p.solution}  `)).toBe(true);
      expect(p.checkAnswer('definitely-not-the-symbol')).toBe(false);
      expect(p.explanation && p.explanation.length).toBeTruthy();
    });
  });

  describe('whatchanged kind', () => {
    it('has gridB differing from grid in exactly one cell, new symbol is solution', () => {
      const p = firstOfKind('whatchanged', 3);
      const data = p.data as ObservationWhatChanged;
      expect(data.kind).toBe('whatchanged');
      expect(data.gridB).toBeTruthy();
      expect(data.gridB.length).toBe(data.grid.length);

      const diffs: number[] = [];
      for (let i = 0; i < data.grid.length; i++) {
        if (data.grid[i] !== data.gridB[i]) diffs.push(i);
      }
      expect(diffs.length).toBe(1);
      const changedIdx = diffs[0];
      // new symbol shown now (in gridB) is the solution and differs from the old one
      expect(data.gridB[changedIdx]).toBe(p.solution);
      expect(data.grid[changedIdx]).not.toBe(p.solution);

      expect(p.checkAnswer(p.solution)).toBe(true);
      expect(p.checkAnswer(`${p.solution} `)).toBe(true);
      expect(p.checkAnswer('nope')).toBe(false);
      expect(p.explanation && p.explanation.length).toBeTruthy();
    });
  });
});
