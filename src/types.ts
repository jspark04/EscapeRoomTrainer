export type Skill = 'cipher' | 'pattern' | 'observation' | 'logic';
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
