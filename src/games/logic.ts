import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, shuffle, uid } from '../rng';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

interface Riddle { q: string; a: string[]; hint: string; why: string }

const RIDDLES: Riddle[] = [
  { q: 'The more you take, the more you leave behind. What am I?', a: ['footsteps', 'steps'], hint: 'You make them when you walk.', why: 'Read it literally: the action of "taking" steps physically creates the things ("footprints") left behind. The trick is that "take" means take a step, not remove.' },
  { q: 'What has keys but no locks, space but no room, and you can enter but not go in?', a: ['keyboard', 'a keyboard'], hint: 'You are using one now.', why: 'Each noun has a double meaning: keys (buttons), space (the spacebar), enter (the Enter key). Map every word to its computer sense, not its everyday one.' },
  { q: 'What has hands but cannot clap?', a: ['clock', 'a clock'], hint: 'It tells you something all day.', why: '"Hands" is the misdirection — clock hands point, they are not body parts. List objects that have parts called hands.' },
  { q: 'What gets wetter the more it dries?', a: ['towel', 'a towel'], hint: 'You use it after a shower.', why: 'The paradox dissolves once "dries" means "dries something else": the towel absorbs water, so it gets wetter while drying you.' },
  { q: 'I have cities but no houses, mountains but no trees, water but no fish. What am I?', a: ['map', 'a map'], hint: 'You unfold it to find your way.', why: 'Each pair contrasts a label with its real content. Something that shows cities, mountains and water as symbols — not the real things — is a map.' },
  { q: 'What can travel around the world while staying in a corner?', a: ['stamp', 'a stamp'], hint: 'It goes on an envelope.', why: 'It sits in the corner of an envelope yet the letter is mailed worldwide. Look for an object whose fixed position still moves with its carrier.' },
  { q: 'What has a neck but no head?', a: ['bottle', 'a bottle'], hint: 'You drink from it.', why: '"Neck" names a narrow part of an object. Brainstorm things with a neck (bottle, guitar, shirt) and pick the one with no head.' },
  { q: 'Forward I am heavy, backward I am not. What am I?', a: ['ton'], hint: 'Spell it backward.', why: 'This is a wordplay riddle: the literal letters matter. "ton" is a heavy weight; reversed it spells "not".' },
  // --- Added riddles ---
  { q: 'What has many teeth but cannot bite?', a: ['comb', 'a comb', 'zipper', 'a zipper', 'saw', 'a saw'], hint: 'You use it on your hair.', why: '"Teeth" is metaphorical — the row of points on a tool. List toothed objects (comb, saw, zipper) and pick one that does not bite.' },
  { q: 'What goes up but never comes down?', a: ['your age', 'age'], hint: 'It changes once a year.', why: 'The phrase "never comes down" rules out balls or smoke. Look for something that only ever increases: your age.' },
  { q: 'What gets bigger the more you take away from it?', a: ['hole', 'a hole'], hint: 'You dig it.', why: 'Counter-intuitive removal: taking away dirt makes a hole larger. The answer is the absence, not the substance.' },
  { q: 'I am full of holes but still hold water. What am I?', a: ['sponge', 'a sponge'], hint: 'You clean with it.', why: 'Resolve the contradiction physically: a porous material can still trap liquid in its pores — that is a sponge.' },
  { q: 'The more of me there is, the less you see. What am I?', a: ['darkness', 'dark', 'fog'], hint: 'It comes at night.', why: 'Invert the relationship: something whose increase reduces visibility. More darkness means less sight.' },
  { q: 'What has a face and two hands but no arms or legs?', a: ['clock', 'a clock', 'watch', 'a watch'], hint: 'It hangs on a wall.', why: 'Combine the clues — face + hands but no limbs — and read them as clock parts (the dial is its face, the pointers its hands).' },
  { q: 'What can you catch but not throw?', a: ['cold', 'a cold'], hint: 'You catch it when you are sick.', why: '"Catch" has two senses. Find a thing you catch (acquire) but cannot literally throw — you catch a cold.' },
  { q: 'What has one eye but cannot see?', a: ['needle', 'a needle'], hint: 'You thread it to sew.', why: '"Eye" is a named hole, not an organ. A needle has an eye (the hole for thread) yet no sight.' },
  { q: 'What runs but never walks, has a bed but never sleeps?', a: ['river', 'a river'], hint: 'It flows to the sea.', why: 'Take each verb as a thing-it-does idiom: a river runs (flows) and has a bed (its channel) without literally moving its legs or sleeping.' },
  { q: 'What word is spelled wrong in every dictionary?', a: ['wrong'], hint: 'Read the question very literally.', why: 'This is self-referential wordplay: the word that is literally spelled W-R-O-N-G in every dictionary is the word "wrong".' },
];

// Verbal analogies: "A is to B as C is to ___". Each maps a relationship.
interface Analogy { a: string; b: string; c: string; answers: string[]; rel: string }

const ANALOGIES: Analogy[] = [
  { a: 'hand', b: 'glove', c: 'foot', answers: ['sock', 'shoe', 'boot'], rel: 'X is the garment worn on the body part Y' },
  { a: 'king', b: 'queen', c: 'man', answers: ['woman'], rel: 'female counterpart of the male term' },
  { a: 'puppy', b: 'dog', c: 'kitten', answers: ['cat'], rel: 'young animal grows into the adult animal' },
  { a: 'hot', b: 'cold', c: 'up', answers: ['down'], rel: 'each word is the opposite (antonym) of its pair' },
  { a: 'finger', b: 'hand', c: 'toe', answers: ['foot'], rel: 'the part belongs to the larger whole' },
  { a: 'author', b: 'book', c: 'painter', answers: ['painting', 'picture', 'art', 'artwork'], rel: 'the creator makes the work' },
  { a: 'fish', b: 'water', c: 'bird', answers: ['air', 'sky'], rel: 'the animal lives in / moves through that medium' },
  { a: 'teacher', b: 'school', c: 'doctor', answers: ['hospital', 'clinic'], rel: 'the worker is found at that workplace' },
  { a: 'wheel', b: 'car', c: 'wing', answers: ['plane', 'airplane', 'aeroplane', 'bird'], rel: 'the part is what moves the whole' },
  { a: 'day', b: 'night', c: 'light', answers: ['dark', 'darkness'], rel: 'each word is the opposite of its pair' },
];

// Generated deduction: N people each own one distinct item; clues fix the arrangement.
const PEOPLE = ['Ava', 'Ben', 'Cara', 'Dan', 'Eve'];
const ITEMS = ['the key', 'the map', 'the candle', 'the note', 'the coin'];

function deduction(d: Difficulty, rng: Rng): { prompt: string; solution: string; hint: string; explanation: string } {
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
  const others = people.filter((_, i) => i !== hideIdx);
  const prompt =
    `Each person owns exactly one distinct item. Given:\n` +
    shownClues.map((c) => `• ${c}`).join('\n') +
    `\nWhat does ${target} own? (one word)`;
  const explanation =
    `Cross off every item already claimed (${others.join(', ')} take the listed ones). ` +
    `Since each person owns a distinct item, the one item nobody else has must be ${target}'s — that is "${answer}".`;
  return { prompt, solution: answer, hint: 'By elimination, find the only item left.', explanation };
}

export const logicGenerator: PuzzleGenerator = {
  id: 'logic',
  name: 'Logic & Lateral',
  skill: 'logic',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    if (d <= 2) {
      // Lower difficulties mix riddles and verbal analogies.
      const useAnalogy = rng() < 0.5;
      if (useAnalogy) {
        const an = pick(rng, ANALOGIES);
        const accept = an.answers.map(normalize);
        const solution = an.answers[0];
        return {
          id: uid('logic'),
          skill: 'logic',
          prompt: `${an.a} is to ${an.b} as ${an.c} is to ___ ?`,
          data: { kind: 'analogy' },
          solution,
          hint: `Think about how "${an.a}" relates to "${an.b}", then apply the same link to "${an.c}".`,
          explanation: `The relationship is: ${an.rel}. Apply it to "${an.c}" to get "${solution}".`,
          checkAnswer: (input: string) => accept.includes(normalize(input)),
        };
      }
      const r = pick(rng, RIDDLES);
      const accept = r.a.map(normalize);
      return {
        id: uid('logic'),
        skill: 'logic',
        prompt: r.q,
        data: { kind: 'riddle' },
        solution: r.a[0],
        hint: r.hint,
        explanation: r.why,
        checkAnswer: (input: string) => accept.includes(normalize(input)),
      };
    }
    const { prompt, solution, hint, explanation } = deduction(d, rng);
    return {
      id: uid('logic'),
      skill: 'logic',
      prompt,
      data: { kind: 'deduction' },
      solution,
      hint,
      explanation,
      checkAnswer: (input: string) => normalize(input) === normalize(solution),
    };
  },
};
