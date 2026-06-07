import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, shuffle, uid } from '../rng';

const WORDS = [
  'KEY', 'LOCK', 'DOOR', 'CODE', 'CLUE', 'SAFE', 'EXIT', 'MAP',
  'CIPHER', 'PUZZLE', 'SECRET', 'HIDDEN', 'ESCAPE', 'RIDDLE', 'VAULT',
];
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

function caesar(text: string, shift: number): string {
  return text.replace(/[A-Z]/g, (ch) =>
    String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65),
  );
}

type Kind = 'caesar' | 'a1z26' | 'morse' | 'binary' | 'substitution';

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['caesar', 'a1z26'];
  if (d <= 2) return ['caesar', 'a1z26', 'morse'];
  if (d <= 3) return ['caesar', 'a1z26', 'morse', 'binary'];
  return ['caesar', 'morse', 'binary', 'substitution'];
}

function wordFor(d: Difficulty, rng: Rng): string {
  const pool = d <= 2 ? WORDS.filter((w) => w.length <= 4) : WORDS;
  return pick(rng, pool);
}

function build(kind: Kind, word: string, d: Difficulty, rng: Rng): { prompt: string; hint: string } {
  switch (kind) {
    case 'caesar': {
      const shift = randInt(rng, 1, 25);
      return {
        prompt: `Caesar cipher (each letter shifted). Decode: ${caesar(word, shift)}`,
        hint: `The shift is ${shift}.`,
      };
    }
    case 'a1z26': {
      const code = word.split('').map((c) => c.charCodeAt(0) - 64).join('-');
      return { prompt: `A1Z26 (A=1 … Z=26). Decode: ${code}`, hint: 'Convert each number to its letter.' };
    }
    case 'morse': {
      const code = word.split('').map((c) => MORSE[c]).join(' / ');
      return { prompt: `Morse code. Decode: ${code}`, hint: '. = dot, - = dash; / separates letters.' };
    }
    case 'binary': {
      const code = word
        .split('')
        .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
      return { prompt: `Binary (8-bit ASCII). Decode: ${code}`, hint: 'Each group is one ASCII character.' };
    }
    case 'substitution': {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const shuffled = shuffle(rng, alphabet);
      const map: Record<string, string> = {};
      alphabet.forEach((c, i) => (map[c] = shuffled[i]));
      const enc = word.split('').map((c) => map[c]).join('');
      const sample = `A→${map['A']}, E→${map['E']}, T→${map['T']}`;
      void d;
      return { prompt: `Substitution cipher. Decode: ${enc}`, hint: `Sample mappings: ${sample}` };
    }
  }
}

export const cipherGenerator: PuzzleGenerator = {
  id: 'cipher',
  name: 'Ciphers & Codes',
  skill: 'cipher',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const kind = pick(rng, kindsFor(d));
    const word = wordFor(d, rng);
    const { prompt, hint } = build(kind, word, d, rng);
    return {
      id: uid('cipher'),
      skill: 'cipher',
      prompt,
      data: { kind },
      solution: word,
      hint,
      checkAnswer: (input: string) => normalize(input) === normalize(word),
    };
  },
};
