import type { PuzzleGenerator, Skill } from '../types';
import { cipherGenerator } from './cipher';
import { patternGenerator } from './pattern';
import { observationGenerator } from './observation';
import { logicGenerator } from './logic';

export const GENERATORS: PuzzleGenerator[] = [
  cipherGenerator,
  patternGenerator,
  observationGenerator,
  logicGenerator,
];

export function getGenerator(skill: Skill): PuzzleGenerator {
  const g = GENERATORS.find((x) => x.skill === skill);
  if (!g) throw new Error(`No generator for skill: ${skill}`);
  return g;
}
