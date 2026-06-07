export type Skill =
  | 'cipher'
  | 'pattern'
  | 'observation'
  | 'logic'
  | 'combination'
  | 'anagram'
  | 'math'
  | 'spatial';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Rng = () => number; // returns [0,1), like Math.random

export interface Puzzle {
  id: string;
  skill: Skill;
  prompt: string;
  data: unknown;
  checkAnswer: (input: string) => boolean;
  solution: string;
  hint?: string;
  /** How to crack this specific puzzle, shown after the user answers/reveals. */
  explanation?: string;
}

/** Teaching content for a skill, surfaced on the Techniques screen. */
export interface Technique {
  skill: Skill;
  title: string;
  whatToLookFor: string[];
  howToCrack: string[];
  example: { puzzle: string; solution: string; walkthrough: string };
}

export interface PuzzleGenerator {
  id: string;
  name: string;
  skill: Skill;
  generate: (difficulty: Difficulty, rng?: Rng) => Puzzle;
}

export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

export function clampDifficulty(n: number): Difficulty {
  const c = Math.max(1, Math.min(5, Math.round(n)));
  return c as Difficulty;
}
