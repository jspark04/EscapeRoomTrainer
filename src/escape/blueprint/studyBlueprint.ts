import type { Blueprint } from './types';

// Phase-1 hand-authored chain: desk (cipher) -> bookshelf (anagram) -> safe (combination) -> door.
export const studyBlueprint: Blueprint = {
  theme: 'detective-study',
  seed: 1,
  stations: [
    {
      id: 'desk',
      skill: 'cipher',
      difficulty: 2,
      anchor: 'desk',
      presenter: 'overlay',
      produces: ['deskClue'],
      consumes: [],
      narrativeKey: 'desk',
    },
    {
      id: 'bookshelf',
      skill: 'anagram',
      difficulty: 2,
      anchor: 'bookshelf',
      presenter: 'overlay',
      produces: ['safeDigitsA'],
      consumes: ['deskClue'],
      narrativeKey: 'bookshelf',
    },
    {
      id: 'safe',
      skill: 'combination',
      difficulty: 3,
      anchor: 'safe',
      presenter: 'diegetic',
      produces: ['safeDigitsB'],
      consumes: ['safeDigitsA'],
      narrativeKey: 'safe',
    },
  ],
  finalLock: { anchor: 'door', consumes: ['safeDigitsB'] },
};
