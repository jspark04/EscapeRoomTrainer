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

// Standard phone keypad: each letter maps to one digit (ambiguous to reverse,
// so keypad puzzles use short words).
const KEYPAD: Record<string, string> = {
  A: '2', B: '2', C: '2', D: '3', E: '3', F: '3', G: '4', H: '4', I: '4',
  J: '5', K: '5', L: '5', M: '6', N: '6', O: '6', P: '7', Q: '7', R: '7', S: '7',
  T: '8', U: '8', V: '8', W: '9', X: '9', Y: '9', Z: '9',
};

function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Map a string to its phone-keypad digit sequence (non-letters drop out).
function keypadEncode(text: string): string {
  return text
    .split('')
    .map((c) => KEYPAD[c] ?? '')
    .join('');
}

function caesar(text: string, shift: number): string {
  return text.replace(/[A-Z]/g, (ch) =>
    String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65),
  );
}

function atbash(text: string): string {
  return text.replace(/[A-Z]/g, (ch) => String.fromCharCode(90 - (ch.charCodeAt(0) - 65)));
}

// 2-rail rail-fence: write letters zig-zag over two rows, then read row 0 then row 1.
function railFence2(text: string): string {
  const top: string[] = [];
  const bottom: string[] = [];
  text.split('').forEach((ch, i) => (i % 2 === 0 ? top : bottom).push(ch));
  return top.join('') + bottom.join('');
}

function vigenere(text: string, key: string): string {
  return text
    .split('')
    .map((ch, i) => {
      const k = key.charCodeAt(i % key.length) - 65;
      return String.fromCharCode(((ch.charCodeAt(0) - 65 + k) % 26) + 65);
    })
    .join('');
}

type Kind =
  | 'caesar'
  | 'a1z26'
  | 'morse'
  | 'binary'
  | 'substitution'
  | 'atbash'
  | 'reverse'
  | 'keypad'
  | 'railfence'
  | 'vigenere';

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['caesar', 'a1z26', 'atbash', 'reverse'];
  if (d <= 2) return ['caesar', 'a1z26', 'morse', 'atbash', 'reverse'];
  if (d <= 3) return ['caesar', 'a1z26', 'morse', 'binary', 'keypad'];
  if (d <= 4) return ['caesar', 'morse', 'binary', 'substitution', 'railfence', 'vigenere'];
  return ['morse', 'binary', 'substitution', 'railfence', 'keypad', 'vigenere'];
}

function wordFor(d: Difficulty, rng: Rng): string {
  const pool = d <= 2 ? WORDS.filter((w) => w.length <= 4) : WORDS;
  return pick(rng, pool);
}

function build(
  kind: Kind,
  word: string,
  d: Difficulty,
  rng: Rng,
): { prompt: string; hint: string; explanation: string } {
  switch (kind) {
    case 'caesar': {
      const shift = randInt(rng, 1, 25);
      return {
        prompt: `Caesar cipher (each letter shifted). Decode: ${caesar(word, shift)}`,
        hint: `The shift is ${shift}.`,
        explanation: `Each letter was shifted forward by ${shift}. Shift every letter back by ${shift} (A−${shift}, B−${shift}, …, wrapping Z→A) to recover the word.`,
      };
    }
    case 'a1z26': {
      const code = word.split('').map((c) => c.charCodeAt(0) - 64).join('-');
      return {
        prompt: `A1Z26 (A=1 … Z=26). Decode: ${code}`,
        hint: 'Convert each number to its letter.',
        explanation: `Each number is a letter's position in the alphabet (A=1, B=2, … Z=26). Convert ${code} number-by-number: ${word}.`,
      };
    }
    case 'morse': {
      const code = word.split('').map((c) => MORSE[c]).join(' / ');
      return {
        prompt: `Morse code. Decode: ${code}`,
        hint: '. = dot, - = dash; / separates letters.',
        explanation: `Each group of dots/dashes (split by /) is one Morse letter. Look each group up in the Morse table to read off ${word}.`,
      };
    }
    case 'binary': {
      const code = word
        .split('')
        .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
      return {
        prompt: `Binary (8-bit ASCII). Decode: ${code}`,
        hint: 'Each group is one ASCII character.',
        explanation: `Each 8-bit group is one ASCII code. Convert each group from binary to a decimal number, then map that code to its character (e.g. 65=A) to get ${word}.`,
      };
    }
    case 'substitution': {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const shuffled = shuffle(rng, alphabet);
      const map: Record<string, string> = {};
      alphabet.forEach((c, i) => (map[c] = shuffled[i]));
      const enc = word.split('').map((c) => map[c]).join('');
      const sample = `A→${map['A']}, E→${map['E']}, T→${map['T']}`;
      void d;
      return {
        prompt: `Substitution cipher. Decode: ${enc}`,
        hint: `Sample mappings: ${sample}`,
        explanation: `Each plaintext letter was replaced by a fixed substitute. Invert the given mappings (find which plaintext letter maps to each cipher letter) and apply that to ${enc} to recover ${word}.`,
      };
    }
    case 'atbash': {
      void d;
      return {
        prompt: `Atbash cipher (alphabet reversed). Decode: ${atbash(word)}`,
        hint: 'A↔Z, B↔Y, C↔X … mirror each letter across the alphabet.',
        explanation: `Atbash mirrors the alphabet: A↔Z, B↔Y, … Replace each letter with its mirror (position p → position 27−p) — and because the mapping is its own inverse, decoding is the same operation, giving ${word}.`,
      };
    }
    case 'reverse': {
      void d;
      return {
        prompt: `Reversed text. Decode: ${word.split('').reverse().join('')}`,
        hint: 'Read the letters from right to left.',
        explanation: `The word was simply written backwards. Read it right-to-left (or reverse the letter order) to recover ${word}.`,
      };
    }
    case 'keypad': {
      const code = word.split('').map((c) => KEYPAD[c]).join('-');
      const mapping = '2=ABC 3=DEF 4=GHI 5=JKL 6=MNO 7=PQRS 8=TUV 9=WXYZ';
      return {
        prompt: `Phone keypad code (each letter → its digit). Decode: ${code}`,
        hint: `Keypad: ${mapping}. (Ambiguous — pick the digit's letter that spells a word.)`,
        explanation: `Each digit stands for the letters printed on that phone key (${mapping}). Several letters share a digit, so try each key's letters and keep the combination that spells a real word: ${word}.`,
      };
    }
    case 'railfence': {
      void d;
      return {
        prompt: `Rail-fence cipher (2 rails). Decode: ${railFence2(word)}`,
        hint: 'Letters were written zig-zag over 2 rows, then read row 1 then row 2.',
        explanation: `With 2 rails the odd-positioned letters fill row 1 and the even-positioned letters fill row 2. Split the cipher into those two halves, then interleave them (row1[0], row2[0], row1[1], …) to rebuild ${word}.`,
      };
    }
    case 'vigenere': {
      const keys = ['KEY', 'EXIT', 'CODE', 'LOCK', 'SAFE'];
      const key = pick(rng, keys);
      void d;
      return {
        prompt: `Vigenère cipher. Decode: ${vigenere(word, key)}`,
        hint: `The keyword is "${key}". Subtract the keyword letters (mod 26).`,
        explanation: `The keyword "${key}" was repeated under the word and added letter-by-letter. To decode, subtract each keyword letter's value (A=0…Z=25) from the cipher letter, mod 26, to recover ${word}.`,
      };
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
    // Keypad is ambiguous (many letters share a digit), so always use a short word.
    const word = kind === 'keypad' ? pick(rng, WORDS.filter((w) => w.length <= 4)) : wordFor(d, rng);
    const { prompt, hint, explanation } = build(kind, word, d, rng);
    // Keypad (T9) digits are many-to-one, so several real words can share a code
    // (5-3-9 is KEY or JEW). Accept any input that maps to the same keypad digits —
    // every valid reading is a correct decode, so none should be marked wrong.
    const checkAnswer =
      kind === 'keypad'
        ? (input: string) => keypadEncode(normalize(input)) === keypadEncode(word)
        : (input: string) => normalize(input) === normalize(word);
    return {
      id: uid('cipher'),
      skill: 'cipher',
      prompt,
      data: { kind },
      solution: word,
      hint,
      explanation,
      checkAnswer,
    };
  },
};
