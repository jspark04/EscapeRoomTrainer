import { describe, it, expect } from 'vitest';
import { observationGenerator, type ObservationData } from './observation';
import { mulberry32 } from '../rng';

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
  it('rejects a wrong count', () => {
    const p = observationGenerator.generate(2, mulberry32(6));
    expect(p.checkAnswer(String(Number(p.solution) + 1))).toBe(false);
  });
  it('is deterministic for a seed', () => {
    const a = observationGenerator.generate(3, mulberry32(21));
    const b = observationGenerator.generate(3, mulberry32(21));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });
});
