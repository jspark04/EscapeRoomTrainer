import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, shuffle, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

interface Riddle { q: string; a: string[]; hint: string }

const RIDDLES: Riddle[] = [
  { q: 'The more you take, the more you leave behind. What am I?', a: ['footsteps', 'steps'], hint: 'You make them when you walk.' },
  { q: 'What has keys but no locks, space but no room, and you can enter but not go in?', a: ['keyboard', 'a keyboard'], hint: 'You are using one now.' },
  { q: 'What has hands but cannot clap?', a: ['clock', 'a clock'], hint: 'It tells you something all day.' },
  { q: 'What gets wetter the more it dries?', a: ['towel', 'a towel'], hint: 'You use it after a shower.' },
  { q: 'I have cities but no houses, mountains but no trees, water but no fish. What am I?', a: ['map', 'a map'], hint: 'You unfold it to find your way.' },
  { q: 'What can travel around the world while staying in a corner?', a: ['stamp', 'a stamp'], hint: 'It goes on an envelope.' },
  { q: 'What has a neck but no head?', a: ['bottle', 'a bottle'], hint: 'You drink from it.' },
  { q: 'Forward I am heavy, backward I am not. What am I?', a: ['ton'], hint: 'Spell it backward.' },
];

// Generated deduction: N people each own one distinct item; clues fix the arrangement.
const PEOPLE = ['Ava', 'Ben', 'Cara', 'Dan', 'Eve'];
const ITEMS = ['the key', 'the map', 'the candle', 'the note', 'the coin'];

function deduction(d: Difficulty, rng: Rng): { prompt: string; solution: string; hint: string } {
  const n = Math.min(5, 2 + d); // 4..5 at high difficulty
  const people = PEOPLE.slice(0, n);
  const items = shuffle(rng, ITEMS.slice(0, n));
  // assignment[i] = item owned by people[i]
  const assignment = items;
  const clues: string[] = [];
  for (let i = 0; i < n; i++) {
    clues.push(`${people[i]} owns ${assignment[i]}.`);
  }
  // Hide one fact and ask for it; give the rest as clues.
  const hideIdx = Math.floor(rng() * n);
  const shownClues = clues.filter((_, i) => i !== hideIdx);
  const target = people[hideIdx];
  const answer = assignment[hideIdx].replace(/^the /, '');
  const prompt =
    `Each person owns exactly one distinct item. Given:\n` +
    shownClues.map((c) => `• ${c}`).join('\n') +
    `\nWhat does ${target} own? (one word)`;
  return { prompt, solution: answer, hint: 'By elimination, find the only item left.' };
}

export const logicGenerator: PuzzleGenerator = {
  id: 'logic',
  name: 'Logic & Lateral',
  skill: 'logic',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    if (d <= 2) {
      const r = pick(rng, RIDDLES);
      const accept = r.a.map(normalize);
      return {
        id: uid('logic'),
        skill: 'logic',
        prompt: r.q,
        data: { kind: 'riddle' },
        solution: r.a[0],
        hint: r.hint,
        checkAnswer: (input: string) => accept.includes(normalize(input)),
      };
    }
    const { prompt, solution, hint } = deduction(d, rng);
    return {
      id: uid('logic'),
      skill: 'logic',
      prompt,
      data: { kind: 'deduction' },
      solution,
      hint,
      checkAnswer: (input: string) => normalize(input) === normalize(solution),
    };
  },
};
