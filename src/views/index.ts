import type { ComponentType } from 'react';
import type { Puzzle, Skill } from '../types';
import { CipherView } from './CipherView';
import { PatternView } from './PatternView';
import { ObservationView } from './ObservationView';
import { LogicView } from './LogicView';
import { CombinationView } from './CombinationView';
import { AnagramView } from './AnagramView';
import { MathView } from './MathView';
import { SpatialView } from './SpatialView';

export const VIEWS: Record<Skill, ComponentType<{ puzzle: Puzzle }>> = {
  cipher: CipherView,
  pattern: PatternView,
  observation: ObservationView,
  logic: LogicView,
  combination: CombinationView,
  anagram: AnagramView,
  math: MathView,
  spatial: SpatialView,
};
