import type { ComponentType } from 'react';
import type { Puzzle, Skill } from '../types';
import { CipherView } from './CipherView';
import { PatternView } from './PatternView';
import { ObservationView } from './ObservationView';
import { LogicView } from './LogicView';

export const VIEWS: Record<Skill, ComponentType<{ puzzle: Puzzle }>> = {
  cipher: CipherView,
  pattern: PatternView,
  observation: ObservationView,
  logic: LogicView,
};
