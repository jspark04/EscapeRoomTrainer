import type { Skill, Difficulty } from '../../types';

export type PresenterKind = 'overlay' | 'diegetic';

/** A token is a named value that flows along the puzzle chain (e.g. 'safeDigits' -> "47"). */
export type Token = string;

export interface Station {
  id: string;
  skill: Skill;
  difficulty: Difficulty;
  anchor: string; // physical slot id: 'desk' | 'bookshelf' | 'safe'
  presenter: PresenterKind;
  produces: Token[]; // tokens yielded when solved
  consumes: Token[]; // tokens required before attemptable (empty = available from start)
  narrativeKey: string;
}

export interface Blueprint {
  theme: string;
  seed: number;
  stations: Station[];
  finalLock: { anchor: 'door'; consumes: Token[] };
}
