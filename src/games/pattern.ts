import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

type Rule = 'arithmetic' | 'geometric' | 'fibonacci' | 'squares' | 'alternating';

function rulesFor(d: Difficulty): Rule[] {
  if (d <= 1) return ['arithmetic'];
  if (d <= 2) return ['arithmetic', 'geometric'];
  if (d <= 3) return ['arithmetic', 'geometric', 'squares'];
  return ['arithmetic', 'geometric', 'squares', 'fibonacci', 'alternating'];
}

function sequence(rule: Rule, rng: Rng): { terms: number[]; next: number } {
  const len = 5;
  switch (rule) {
    case 'arithmetic': {
      const start = randInt(rng, 1, 9);
      const step = randInt(rng, 2, 9);
      const terms = Array.from({ length: len }, (_, i) => start + i * step);
      return { terms, next: start + len * step };
    }
    case 'geometric': {
      const start = randInt(rng, 1, 4);
      const ratio = randInt(rng, 2, 3);
      const terms = Array.from({ length: len }, (_, i) => start * ratio ** i);
      return { terms, next: start * ratio ** len };
    }
    case 'squares': {
      const start = randInt(rng, 1, 4);
      const terms = Array.from({ length: len }, (_, i) => (start + i) ** 2);
      return { terms, next: (start + len) ** 2 };
    }
    case 'fibonacci': {
      const a0 = randInt(rng, 1, 4);
      const b0 = randInt(rng, 1, 4);
      const terms = [a0, b0];
      while (terms.length < len) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
      return { terms, next: terms[len - 1] + terms[len - 2] };
    }
    case 'alternating': {
      const a = randInt(rng, 1, 5);
      const b = randInt(rng, 1, 5);
      const stepA = randInt(rng, 2, 5);
      const stepB = randInt(rng, 2, 5);
      const terms: number[] = [];
      let va = a;
      let vb = b;
      for (let i = 0; i < len; i++) {
        if (i % 2 === 0) { terms.push(va); va += stepA; }
        else { terms.push(vb); vb += stepB; }
      }
      const next = len % 2 === 0 ? va : vb;
      return { terms, next };
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
    const { terms, next } = sequence(rule, rng);
    const solution = String(next);
    return {
      id: uid('pattern'),
      skill: 'pattern',
      prompt: `What number comes next?  ${terms.join(', ')}, ?`,
      data: { terms },
      solution,
      hint: 'Look at how each term changes from the one before it.',
      checkAnswer: (input: string) => normalize(input).replace(/[, ]/g, '') === solution,
    };
  },
};
