import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, shuffle, uid } from '../rng';

export interface AnagramData {
  /** The scrambled letters, in display order. */
  letters: string[];
}

// Escape-room themed vocabulary, grouped so word length can scale with difficulty.
const WORDS = [
  'KEY', 'LOCK', 'CLUE', 'CODE', 'SAFE', 'DOOR', 'MAP', 'EXIT',
  'VAULT', 'RIDDLE', 'PUZZLE', 'SECRET', 'CIPHER', 'CANDLE', 'HIDDEN',
  'PADLOCK', 'MYSTERY', 'TREASURE', 'COMBINATION',
];

function normalize(s: string): string {
  // Trim, case-fold, and drop any internal spaces/commas the player typed
  // between letters so "T C E K I" and "ticket" both compare cleanly.
  return s.trim().toUpperCase().replace(/[\s,]+/g, '');
}

// A few list words share their letters with another common word; accept either
// so a player who finds the other valid anagram isn't wrongly rejected.
const ALSO_ACCEPT: Record<string, string[]> = {
  CODE: ['COED'],
  DOOR: ['ODOR'],
  MAP: ['AMP', 'PAM'],
};

// Word length grows with difficulty: short words at 1, longer words at 5.
function lengthRangeFor(d: Difficulty): { min: number; max: number } {
  switch (d) {
    case 1: return { min: 3, max: 3 };
    case 2: return { min: 4, max: 4 };
    case 3: return { min: 5, max: 6 };
    case 4: return { min: 6, max: 7 };
    case 5: return { min: 7, max: 12 };
  }
}

function wordFor(d: Difficulty, rng: Rng): string {
  const { min, max } = lengthRangeFor(d);
  let pool = WORDS.filter((w) => w.length >= min && w.length <= max);
  // Fall back to the closest words so we always have something to pick.
  if (pool.length === 0) {
    const target = (min + max) / 2;
    const best = Math.min(...WORDS.map((w) => Math.abs(w.length - target)));
    pool = WORDS.filter((w) => Math.abs(w.length - target) === best);
  }
  return pick(rng, pool);
}

// Shuffle a word's letters, guaranteeing the result differs from the original.
function scramble(word: string, rng: Rng): string[] {
  const letters = word.split('');
  // A word made of a single repeated letter can never be reordered; bail safely.
  if (new Set(letters).size === 1) return letters;
  let attempt = shuffle(rng, letters);
  // Guard against the (rare) identity shuffle; cap attempts to avoid any loop.
  for (let i = 0; i < 20 && attempt.join('') === word; i++) {
    attempt = shuffle(rng, letters);
  }
  return attempt;
}

export const anagramGenerator: PuzzleGenerator = {
  id: 'anagram',
  name: 'Anagrams & Words',
  skill: 'anagram',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const word = wordFor(d, rng);
    const letters = scramble(word, rng);
    const data: AnagramData = { letters };
    return {
      id: uid('anagram'),
      skill: 'anagram',
      prompt: `Unscramble these letters into a word:  ${letters.join(' ')}`,
      data,
      solution: word,
      hint: `The word starts with "${word[0]}" and has ${word.length} letters.`,
      explanation:
        `The letters spell ${word}. Anchor on the rarer letters and common ` +
        `prefixes/suffixes: try fixing "${word[0]}" first, then slot the vowels ` +
        `(${[...word].filter((c) => 'AEIOU'.includes(c)).join(', ') || 'none'}) ` +
        `around the consonants until a real word appears.`,
      checkAnswer: (input: string) => {
        const got = normalize(input);
        if (got === normalize(word)) return true;
        return (ALSO_ACCEPT[word] ?? []).some((alt) => got === normalize(alt));
      },
    };
  },
};
