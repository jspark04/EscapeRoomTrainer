import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

export type MathData = { expression: string; kind: Kind };

function normalize(s: string): string {
  return s.trim().replace(/[\s,]/g, '');
}

type Kind = 'chain' | 'solve-for' | 'percent' | 'sequence-sum';

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['chain', 'solve-for'];
  if (d <= 2) return ['chain', 'solve-for'];
  if (d <= 3) return ['chain', 'solve-for', 'percent'];
  return ['chain', 'solve-for', 'percent', 'sequence-sum'];
}

interface Built {
  expression: string;
  prompt: string;
  answer: number;
  hint: string;
  explanation: string;
}

// Evaluate a + b ± c structure where the middle term may be a × product,
// computing in code so multiplication binds tighter than addition/subtraction.
function build(kind: Kind, d: Difficulty, rng: Rng): Built {
  switch (kind) {
    case 'chain': {
      // a (op) b × c  -> the product is computed first (precedence).
      const hi = d <= 1 ? 6 : d <= 2 ? 9 : 12;
      const a = randInt(rng, 2, hi);
      const b = randInt(rng, 2, hi);
      const c = randInt(rng, 2, d <= 2 ? 5 : 6);
      const plus = randInt(rng, 0, 1) === 0;
      const product = b * c;
      const answer = plus ? a + product : a - product;
      const op = plus ? '+' : '-';
      const expression = `${a} ${op} ${b} × ${c}`;
      return {
        expression,
        prompt: `Evaluate (mind the order of operations): ${expression}`,
        answer,
        hint: 'Multiply before you add or subtract.',
        explanation: `Multiplication binds tighter than ${plus ? 'addition' : 'subtraction'}, so do ${b} × ${c} = ${product} first, then ${a} ${op} ${product} = ${answer}.`,
      };
    }
    case 'solve-for': {
      // Either ? × b = product, or ? + b = total, or a + ? = total.
      const mode = randInt(rng, 0, 2);
      if (mode === 0) {
        const factor = randInt(rng, 2, d <= 2 ? 9 : 12);
        const answer = randInt(rng, 2, d <= 2 ? 9 : 12);
        const product = factor * answer;
        const expression = `${factor} × ? = ${product}`;
        return {
          expression,
          prompt: `Solve for ?: ${expression}`,
          answer,
          hint: 'Divide the result by the known factor.',
          explanation: `Divide both sides by ${factor}: ? = ${product} ÷ ${factor} = ${answer}.`,
        };
      }
      if (mode === 1) {
        const addend = randInt(rng, 2, d <= 2 ? 20 : 50);
        const answer = randInt(rng, 2, d <= 2 ? 20 : 50);
        const total = addend + answer;
        const expression = `? + ${addend} = ${total}`;
        return {
          expression,
          prompt: `Solve for ?: ${expression}`,
          answer,
          hint: 'Subtract the known number from the total.',
          explanation: `Subtract ${addend} from both sides: ? = ${total} − ${addend} = ${answer}.`,
        };
      }
      const known = randInt(rng, 2, d <= 2 ? 20 : 50);
      const answer = randInt(rng, 2, d <= 2 ? 20 : 50);
      const total = known + answer;
      const expression = `${known} + ? = ${total}`;
      return {
        expression,
        prompt: `Solve for ?: ${expression}`,
        answer,
        hint: 'Subtract the known number from the total.',
        explanation: `Subtract ${known} from both sides: ? = ${total} − ${known} = ${answer}.`,
      };
    }
    case 'percent': {
      // Keep percentages "round" so the answer is a whole number.
      const pct = pick(rng, [10, 20, 25, 50, 75]);
      // Choose a base that is a multiple of the relevant denominator.
      const denom = pct === 25 || pct === 75 ? 4 : pct === 50 ? 2 : 10;
      const units = randInt(rng, 2, d <= 3 ? 20 : 50);
      const base = units * denom;
      const answer = (base * pct) / 100;
      const expression = `${pct}% of ${base}`;
      return {
        expression,
        prompt: `What is ${expression}?`,
        answer,
        hint: `Find 1% (divide by 100), then multiply by ${pct} — or use a shortcut like ${pct}% = ${pct / (pct === 50 ? 50 : pct === 25 ? 25 : pct === 75 ? 25 : 10)}/${pct === 50 ? 1 : pct === 25 || pct === 75 ? 4 : 10}.`,
        explanation: `${pct}% means ${pct} per hundred. 1% of ${base} is ${base / 100}, so ${pct}% is ${base / 100} × ${pct} = ${answer}.`,
      };
    }
    case 'sequence-sum': {
      // Sum of an arithmetic run; compute directly by adding the terms.
      const len = randInt(rng, 3, d <= 4 ? 4 : 5);
      const start = randInt(rng, 2, 9);
      const step = randInt(rng, 2, 9);
      const terms = Array.from({ length: len }, (_, i) => start + i * step);
      const answer = terms.reduce((s, t) => s + t, 0);
      const expression = `${terms.join(' + ')}`;
      return {
        expression,
        prompt: `Sum of ${expression}`,
        answer,
        hint: 'Pair the first and last terms, or add them one at a time.',
        explanation: `Add the ${len} terms: ${terms.join(' + ')} = ${answer}. (Shortcut: average of first and last, ${(terms[0] + terms[len - 1]) / 2}, times ${len}.)`,
      };
    }
  }
}

export const mathGenerator: PuzzleGenerator = {
  id: 'math',
  name: 'Mental Math',
  skill: 'math',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const kind = pick(rng, kindsFor(d));
    const { expression, prompt, answer, hint, explanation } = build(kind, d, rng);
    const solution = String(answer);
    return {
      id: uid('math'),
      skill: 'math',
      prompt,
      data: { expression, kind } satisfies MathData,
      solution,
      hint,
      explanation,
      checkAnswer: (input: string) => {
        const cleaned = normalize(input);
        if (cleaned === '') return false;
        const n = Number(cleaned);
        return !Number.isNaN(n) && n === Number(solution);
      },
    };
  },
};
