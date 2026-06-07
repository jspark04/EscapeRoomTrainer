import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, randInt, shuffle, uid } from '../rng';

export interface CombinationData {
  clues: string[];
  length: number;
}

function normalize(s: string): string {
  // Code answers: drop everything except digits so "4-7-3", "4 7 3" and "473" all match.
  return s.trim().replace(/[^0-9]/g, '');
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function lengthFor(d: Difficulty): number {
  // L = 2 at difficulty 1 up to 4 at difficulty 5.
  if (d <= 2) return 2;
  if (d <= 4) return 3;
  return 4;
}

// How many digits to reveal directly: generous at low difficulty, none at the top.
function revealsFor(d: Difficulty, length: number): number {
  if (d <= 1) return length - 1; // leave exactly one digit to deduce
  if (d <= 2) return 1;
  if (d <= 3) return 1;
  if (d <= 4) return 0;
  return 0;
}

/** A clue carries its display text plus a predicate so we can keep only TRUE, useful clues. */
interface Clue {
  text: string;
  test: (digits: number[]) => boolean;
}

function digitsOf(code: string): number[] {
  return code.split('').map(Number);
}

/** Count how many codes of the given length satisfy every clue. Stops once it exceeds cap. */
function countSatisfying(length: number, clues: Clue[], cap: number): number {
  const total = 10 ** length;
  let count = 0;
  for (let n = 0; n < total; n++) {
    const digits = String(n).padStart(length, '0').split('').map(Number);
    if (clues.every((c) => c.test(digits))) {
      count++;
      if (count > cap) return count;
    }
  }
  return count;
}

function buildCandidateClues(code: string, rng: Rng): Clue[] {
  const digits = digitsOf(code);
  const length = digits.length;
  const clues: Clue[] = [];

  // Parity of each position.
  for (let i = 0; i < length; i++) {
    const even = digits[i] % 2 === 0;
    clues.push({
      text: `The ${ordinal(i + 1)} digit is ${even ? 'even' : 'odd'}.`,
      test: (d) => (even ? d[i] % 2 === 0 : d[i] % 2 === 1),
    });
  }

  // Sum of all digits (always true).
  const sum = digits.reduce((a, b) => a + b, 0);
  clues.push({
    text: `The digits add up to ${sum}.`,
    test: (d) => d.reduce((a, b) => a + b, 0) === sum,
  });

  // Ordering between distinct-valued positions.
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (i === j || digits[i] === digits[j]) continue;
      if (digits[i] > digits[j]) {
        clues.push({
          text: `The ${ordinal(i + 1)} digit is greater than the ${ordinal(j + 1)} digit.`,
          test: (d) => d[i] > d[j],
        });
      }
    }
  }

  // "No two digits are the same" — only when actually true.
  if (new Set(digits).size === length && length >= 2) {
    clues.push({
      text: 'No two digits are the same.',
      test: (d) => new Set(d).size === d.length,
    });
  }

  return shuffle(rng, clues);
}

function generateCode(length: number, rng: Rng): string {
  return Array.from({ length }, () => randInt(rng, 0, 9)).join('');
}

export const combinationGenerator: PuzzleGenerator = {
  id: 'combination',
  name: 'Combination Locks',
  skill: 'combination',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const length = lengthFor(d);
    const code = generateCode(length, rng);
    const digits = digitsOf(code);

    const chosen: Clue[] = [];

    // 1) Direct reveals (more at low difficulty) — pick distinct positions to reveal.
    const numReveals = Math.max(0, Math.min(length - 1, revealsFor(d, length)));
    const positions = shuffle(
      rng,
      Array.from({ length }, (_, i) => i),
    ).slice(0, numReveals);
    for (const pos of positions) {
      const value = digits[pos];
      chosen.push({
        text: `The ${ordinal(pos + 1)} digit is ${value}.`,
        test: (dd) => dd[pos] === value,
      });
    }

    // 2) Add constraining clues until the solution is uniquely determined (or we run out).
    const pool = buildCandidateClues(code, rng);
    for (const clue of pool) {
      if (countSatisfying(length, chosen, 1) <= 1) break; // already unique
      // Only keep a clue if it actually narrows the remaining candidate set.
      const before = countSatisfying(length, chosen, 10 ** length);
      const after = countSatisfying(length, [...chosen, clue], 10 ** length);
      if (after < before) chosen.push(clue);
    }

    // 3) Safety net: if clues alone left it ambiguous, reveal a still-hidden digit.
    if (countSatisfying(length, chosen, 1) > 1) {
      const revealed = new Set(positions);
      for (let i = 0; i < length; i++) {
        if (revealed.has(i)) continue;
        const value = digits[i];
        chosen.push({
          text: `The ${ordinal(i + 1)} digit is ${value}.`,
          test: (dd) => dd[i] === value,
        });
        if (countSatisfying(length, chosen, 1) <= 1) break;
      }
    }

    // Order the clue text: reveals first, then the rest, for readable deduction.
    const reveals = chosen.filter((c) => /digit is \d\./.test(c.text)).map((c) => c.text);
    const others = chosen.filter((c) => !/digit is \d\./.test(c.text)).map((c) => c.text);
    const clueTexts = [...reveals, ...others];

    const bullets = clueTexts.map((c) => `• ${c}`).join('\n');
    const prompt = `Crack the lock from these clues:\n${bullets}\n\nEnter the ${length}-digit code.`;

    const explanation = buildExplanation(clueTexts, code, length);

    return {
      id: uid('combination'),
      skill: 'combination',
      prompt,
      data: { clues: clueTexts, length } satisfies CombinationData,
      solution: code,
      hint:
        numReveals > 0
          ? 'Pencil in the revealed digits first, then use the remaining clues to fix the rest.'
          : 'Start from the most restrictive clue (a direct value or the digit sum) and narrow down.',
      explanation,
      checkAnswer: (input: string) => normalize(input) === code,
    };
  },
};

function buildExplanation(clues: string[], code: string, length: number): string {
  const revealClue = clues.find((c) => /^The \w+ digit is \d\.$/.test(c));
  const sumClue = clues.find((c) => /add up to/.test(c));
  const orderClue = clues.find((c) => /(greater than|less than)/.test(c));
  const parityClue = clues.find((c) => /digit is (even|odd)/.test(c));

  const steps: string[] = [];
  if (revealClue) steps.push(`first place the revealed digit (${revealClue.replace(/\.$/, '')})`);
  if (parityClue) steps.push(`narrow another slot by its parity (${parityClue.replace(/\.$/, '')})`);
  if (orderClue) steps.push(`apply the ordering clue (${orderClue.replace(/\.$/, '')})`);
  if (sumClue) steps.push(`use the digit-sum clue to pin the last unknown`);

  const method = steps.length
    ? `Work clue by clue: ${steps.join(', then ')}.`
    : `Combine the constraints clue by clue, eliminating digits until only one ${length}-digit value survives.`;

  return `${method} Only ${code} satisfies every clue simultaneously, so that is the combination.`;
}
