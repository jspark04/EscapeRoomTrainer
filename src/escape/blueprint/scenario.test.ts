import { describe, it, expect } from 'vitest';
import { generateScenario } from './scenario';

describe('generateScenario', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(stripFns(generateScenario(7)))).toBe(JSON.stringify(stripFns(generateScenario(7))));
  });

  it('chains values: vaultCode = bookshelf answer (half1) + desk-revealed half2', () => {
    const s = generateScenario(7);
    expect(s.vaultCode).toBe(`${s.half1}${s.half2}`);
    // the bookshelf puzzle's own solution IS half1 (the value the player carries)
    expect(s.stations.bookshelf.puzzle.solution).toBe(s.half1);
    // the safe dial target IS the assembled vault code
    expect(s.stations.safe.puzzle.solution).toBe(s.vaultCode);
  });

  it('every puzzle accepts its own solution', () => {
    const s = generateScenario(11);
    for (const st of Object.values(s.stations)) {
      expect(st.puzzle.checkAnswer(st.puzzle.solution)).toBe(true);
    }
  });

  it('the desk keyword names the bookshelf item referenced in the bookshelf beat/objective', () => {
    const s = generateScenario(3);
    expect(s.stations.desk.puzzle.solution.length).toBeGreaterThan(0);
    expect(s.beats.desk).toContain(s.half2);              // desk solve reveals half2
    expect(s.beats.bookshelf).toContain(s.half1);          // bookshelf solve reveals half1
    expect(s.beats.safe).toContain(s.exitCode);            // safe open reveals exit code
    expect(s.beats.desk.toUpperCase()).toContain(s.stations.desk.puzzle.solution.toUpperCase());
  });

  it('codes are well-formed and distinct enough', () => {
    const s = generateScenario(99);
    expect(s.half1).toMatch(/^\d{2}$/);
    expect(s.half2).toMatch(/^\d{2}$/);
    expect(s.vaultCode).toMatch(/^\d{4}$/);
    expect(s.exitCode).toMatch(/^\d{4}$/);
  });

  it('varies across seeds', () => {
    const codes = new Set<string>();
    for (let seed = 0; seed < 40; seed++) codes.add(generateScenario(seed).vaultCode);
    expect(codes.size).toBeGreaterThan(5);
  });
});

// helper: JSON can't serialize checkAnswer fns; strip them for the determinism check.
function stripFns(s: ReturnType<typeof generateScenario>) {
  return JSON.parse(
    JSON.stringify(s, (k, v) => (k === 'checkAnswer' ? undefined : v)),
  );
}
