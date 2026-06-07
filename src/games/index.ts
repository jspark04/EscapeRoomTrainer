import type { PuzzleGenerator, Skill } from '../types';
import { cipherGenerator } from './cipher';
import { patternGenerator } from './pattern';
import { observationGenerator } from './observation';
import { logicGenerator } from './logic';
import { combinationGenerator } from './combination';
import { anagramGenerator } from './anagram';
import { mathGenerator } from './math';
import { spatialGenerator } from './spatial';

export const GENERATORS: PuzzleGenerator[] = [
  cipherGenerator,
  patternGenerator,
  observationGenerator,
  logicGenerator,
  combinationGenerator,
  anagramGenerator,
  mathGenerator,
  spatialGenerator,
];

export function getGenerator(skill: Skill): PuzzleGenerator {
  const g = GENERATORS.find((x) => x.skill === skill);
  if (!g) throw new Error(`No generator for skill: ${skill}`);
  return g;
}
