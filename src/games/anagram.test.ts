import { describe, it, expect } from 'vitest';
import { anagramGenerator, type AnagramData } from './anagram';
import { mulberry32 } from '../rng';

describe('anagramGenerator', () => {
  it('produces a puzzle whose solution passes checkAnswer', () => {
    const p = anagramGenerator.generate(1, mulberry32(7));
    expect(p.skill).toBe('anagram');
    expect(p.prompt.length).toBeGreaterThan(0);
    expect(p.checkAnswer(p.solution)).toBe(true);
  });

  it('checkAnswer is case-, whitespace- and comma-insensitive', () => {
    const p = anagramGenerator.generate(2, mulberry32(11));
    expect(p.checkAnswer(`  ${p.solution.toLowerCase()}  `)).toBe(true);
    expect(p.checkAnswer(p.solution.split('').join(' '))).toBe(true);
  });

  it('rejects wrong answers', () => {
    const p = anagramGenerator.generate(3, mulberry32(3));
    expect(p.checkAnswer(p.solution + 'x')).toBe(false);
    expect(p.checkAnswer('notarealword')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = anagramGenerator.generate(2, mulberry32(99));
    const b = anagramGenerator.generate(2, mulberry32(99));
    expect(a.prompt).toBe(b.prompt);
    expect(a.solution).toBe(b.solution);
  });

  it('exposes the scrambled letters as data and they are a permutation of the word', () => {
    const p = anagramGenerator.generate(4, mulberry32(42));
    const data = p.data as AnagramData;
    expect(Array.isArray(data.letters)).toBe(true);
    expect(data.letters.length).toBe(p.solution.length);
    expect([...data.letters].sort().join('')).toBe(
      [...p.solution.toUpperCase()].sort().join(''),
    );
  });

  it('never leaves the letters in their original order', () => {
    // Exercise many seeds to make sure the re-shuffle guard always fires.
    for (let seed = 0; seed < 200; seed++) {
      const p = anagramGenerator.generate(3, mulberry32(seed));
      const data = p.data as AnagramData;
      expect(data.letters.join('')).not.toBe(p.solution.toUpperCase());
    }
  });

  it('scales word length with difficulty', () => {
    let easyLen = 0;
    let hardLen = 0;
    for (let seed = 0; seed < 50; seed++) {
      easyLen = Math.max(easyLen, anagramGenerator.generate(1, mulberry32(seed)).solution.length);
      hardLen = Math.max(hardLen, anagramGenerator.generate(5, mulberry32(seed)).solution.length);
    }
    expect(hardLen).toBeGreaterThan(easyLen);
  });

  it('every puzzle has a non-empty explanation and hint', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = anagramGenerator.generate(((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5, mulberry32(seed));
      expect(typeof p.explanation).toBe('string');
      expect(p.explanation && p.explanation.length).toBeGreaterThan(0);
      expect(typeof p.hint).toBe('string');
      expect(p.hint && p.hint.length).toBeGreaterThan(0);
    }
  });
});
