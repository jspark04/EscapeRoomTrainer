import type { Blueprint, Station } from './types';
import type { Skill } from '../../types';
import { clampDifficulty } from '../../types';
import { mulberry32, shuffle } from '../../rng';

// Skills that work as 2D overlay puzzles (everything except the diegetic combination safe).
const OVERLAY_SKILLS: Skill[] = [
  'cipher',
  'anagram',
  'pattern',
  'logic',
  'math',
  'spatial',
  'observation',
];

/**
 * Deterministically assemble a solvable detective-study blueprint. Geometry is fixed
 * (desk + bookshelf overlay slots, safe = diegetic combination finale, door = final lock);
 * the two overlay skills and the difficulty ramp vary by seed. Always passes validateBlueprint.
 */
export function generateBlueprint(seed: number): Blueprint {
  const rng = mulberry32(seed);
  const [skillA, skillB] = shuffle(rng, OVERLAY_SKILLS).slice(0, 2);
  const base = 1 + Math.floor(rng() * 2); // 1 or 2

  const stations: Station[] = [
    {
      id: 'desk',
      skill: skillA,
      difficulty: clampDifficulty(base),
      anchor: 'desk',
      presenter: 'overlay',
      produces: ['clue0'],
      consumes: [],
      narrativeKey: 'desk',
    },
    {
      id: 'bookshelf',
      skill: skillB,
      difficulty: clampDifficulty(base + 1),
      anchor: 'bookshelf',
      presenter: 'overlay',
      produces: ['clue1'],
      consumes: ['clue0'],
      narrativeKey: 'bookshelf',
    },
    {
      id: 'safe',
      skill: 'combination',
      difficulty: clampDifficulty(base + 2),
      anchor: 'safe',
      presenter: 'diegetic',
      produces: ['exitCode'],
      consumes: ['clue1'],
      narrativeKey: 'safe',
    },
  ];

  return {
    theme: 'detective-study',
    seed,
    stations,
    finalLock: { anchor: 'door', consumes: ['exitCode'] },
  };
}
