import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

type Rule =
  | 'arithmetic'
  | 'geometric'
  | 'fibonacci'
  | 'squares'
  | 'alternating'
  | 'letters'
  | 'alternating-op'
  | 'doubling-plus';

function rulesFor(d: Difficulty): Rule[] {
  if (d <= 1) return ['arithmetic', 'letters'];
  if (d <= 2) return ['arithmetic', 'geometric', 'letters'];
  if (d <= 3) return ['arithmetic', 'geometric', 'squares', 'letters', 'alternating-op'];
  if (d <= 4)
    return [
      'arithmetic',
      'geometric',
      'squares',
      'fibonacci',
      'alternating',
      'letters',
      'alternating-op',
      'doubling-plus',
    ];
  return [
    'arithmetic',
    'geometric',
    'squares',
    'fibonacci',
    'alternating',
    'letters',
    'alternating-op',
    'doubling-plus',
  ];
}

interface Built {
  terms: string[];
  solution: string;
  isLetter: boolean;
  explanation: string;
}

function sequence(rule: Rule, rng: Rng): Built {
  const len = 5;
  switch (rule) {
    case 'arithmetic': {
      const start = randInt(rng, 1, 9);
      const step = randInt(rng, 2, 9);
      const nums = Array.from({ length: len }, (_, i) => start + i * step);
      const next = start + len * step;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Arithmetic sequence: each term adds ${step} to the previous one, so the next term is ${nums[len - 1]} + ${step} = ${next}.`,
      };
    }
    case 'geometric': {
      const start = randInt(rng, 1, 4);
      const ratio = randInt(rng, 2, 3);
      const nums = Array.from({ length: len }, (_, i) => start * ratio ** i);
      const next = start * ratio ** len;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Geometric sequence: each term is multiplied by ${ratio}, so the next term is ${nums[len - 1]} × ${ratio} = ${next}.`,
      };
    }
    case 'squares': {
      const start = randInt(rng, 1, 4);
      const nums = Array.from({ length: len }, (_, i) => (start + i) ** 2);
      const nextBase = start + len;
      const next = nextBase ** 2;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `These are perfect squares of consecutive numbers (…${start + len - 1}², ?), so the next term is ${nextBase}² = ${next}.`,
      };
    }
    case 'fibonacci': {
      const a0 = randInt(rng, 1, 4);
      const b0 = randInt(rng, 1, 4);
      const nums = [a0, b0];
      while (nums.length < len) nums.push(nums[nums.length - 1] + nums[nums.length - 2]);
      const next = nums[len - 1] + nums[len - 2];
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Fibonacci-style: each term is the sum of the two before it, so the next term is ${nums[len - 2]} + ${nums[len - 1]} = ${next}.`,
      };
    }
    case 'alternating': {
      const a = randInt(rng, 1, 5);
      const b = randInt(rng, 1, 5);
      const stepA = randInt(rng, 2, 5);
      const stepB = randInt(rng, 2, 5);
      const nums: number[] = [];
      let va = a;
      let vb = b;
      for (let i = 0; i < len; i++) {
        if (i % 2 === 0) {
          nums.push(va);
          va += stepA;
        } else {
          nums.push(vb);
          vb += stepB;
        }
      }
      const next = len % 2 === 0 ? va : vb;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Two interleaved sequences: positions 1,3,5… step by +${stepA} and positions 2,4… step by +${stepB}. The next slot continues its own series, giving ${next}.`,
      };
    }
    case 'letters': {
      // Alphabet-position sequence: start letter, fixed positive step.
      const step = randInt(rng, 1, 4);
      const start = randInt(rng, 0, 25 - len * step); // keep all terms (incl. next) within A..Z
      const idx = Array.from({ length: len }, (_, i) => start + i * step);
      const nextIdx = start + len * step;
      const letters = idx.map((i) => String.fromCharCode(65 + i));
      const next = String.fromCharCode(65 + nextIdx);
      return {
        terms: letters,
        solution: next,
        isLetter: true,
        explanation: `Letters by alphabet position: each letter skips ${step} forward (${letters[len - 1]} is position ${idx[len - 1] + 1}), so the next letter is ${next} (position ${nextIdx + 1}).`,
      };
    }
    case 'alternating-op': {
      // Alternating operations: +p, -q, +p, -q, …
      const start = randInt(rng, 10, 30);
      const p = randInt(rng, 3, 9);
      const q = randInt(rng, 1, Math.min(p - 1, 5)); // keep net positive so terms stay tidy
      const nums = [start];
      for (let i = 1; i < len; i++) {
        nums.push(i % 2 === 1 ? nums[i - 1] + p : nums[i - 1] - q);
      }
      const next = len % 2 === 1 ? nums[len - 1] + p : nums[len - 1] - q;
      const nextOp = len % 2 === 1 ? `+${p}` : `−${q}`;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Operations alternate: +${p}, then −${q}, repeating. The step into the next term is ${nextOp}, so ${nums[len - 1]} ${nextOp.startsWith('+') ? '+ ' + p : '− ' + q} = ${next}.`,
      };
    }
    case 'doubling-plus': {
      // Each term = prev * 2 + k.
      const start = randInt(rng, 1, 5);
      const k = randInt(rng, 1, 5);
      const nums = [start];
      for (let i = 1; i < len; i++) nums.push(nums[i - 1] * 2 + k);
      const next = nums[len - 1] * 2 + k;
      return {
        terms: nums.map(String),
        solution: String(next),
        isLetter: false,
        explanation: `Each term is the previous one doubled plus ${k} (×2 then +${k}), so the next term is ${nums[len - 1]} × 2 + ${k} = ${next}.`,
      };
    }
  }
}

export const patternGenerator: PuzzleGenerator = {
  id: 'pattern',
  name: 'Pattern & Sequence',
  skill: 'pattern',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const rule = pick(rng, rulesFor(d));
    const { terms, solution, isLetter, explanation } = sequence(rule, rng);
    const normalizedSolution = isLetter ? solution.toLowerCase() : solution;
    const prompt = isLetter
      ? `What letter comes next?  ${terms.join(', ')}, ?`
      : `What number comes next?  ${terms.join(', ')}, ?`;
    return {
      id: uid('pattern'),
      skill: 'pattern',
      prompt,
      data: { terms, rule },
      solution,
      hint: isLetter
        ? 'Convert each letter to its alphabet position (A=1) and look at how the position changes.'
        : 'Look at how each term changes from the one before it.',
      explanation,
      // Single normalizer handles both numbers and single letters:
      // trim, lowercase, and strip stray spaces/commas, then compare.
      checkAnswer: (input: string) => normalize(input).replace(/[, ]/g, '') === normalizedSolution,
    };
  },
};
