import type { HintRequest, HintResponse, NarrativeResponse } from './types';

const NARRATIVES: Record<string, NarrativeResponse> = {
  'detective-study': {
    intro:
      'The door clicks shut behind you. A detective’s study, thick with pipe smoke and secrets. ' +
      'Somewhere here is the way out — work the clues before your time runs out.',
    win: 'The lock yields. You slip out into the night, case cracked. 🔓',
    lose: 'The clock wins this time. The study keeps its secrets — for now.',
  },
};

const GENERIC: NarrativeResponse = {
  intro: 'You are locked in. Search the room, solve the clues, and find your way out before time runs out.',
  win: 'The final lock opens. You escaped! 🔓',
  lose: "Time’s up — the room keeps you a little longer.",
};

export function cannedNarrative(theme: string): NarrativeResponse {
  return NARRATIVES[theme] ?? GENERIC;
}

// Escalating, non-spoiling hints derived from the puzzle's own hint/explanation.
export function cannedHint(req: HintRequest): HintResponse {
  if (req.tier <= 1) {
    return { hint: `Look closely at the ${req.skill} clue — what kind of puzzle is it, and what stands out?` };
  }
  if (req.tier === 2) {
    return { hint: req.hint ?? 'Focus on the most constrained part first and work outward.' };
  }
  return { hint: req.explanation ?? req.hint ?? 'Walk through the method one careful step at a time.' };
}
