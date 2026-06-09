import type { Puzzle } from '../../types';
import { mulberry32, pick, randInt } from '../../rng';

export type StationId = 'desk' | 'bookshelf' | 'safe';

export interface ScenarioStation {
  id: StationId;
  anchor: StationId;
  presenter: 'overlay' | 'diegetic';
  puzzle: Puzzle;
  /** Interaction label shown on the crosshair when unlocked. */
  label: string;
  /** Shown when the player aims at it before it is unlocked. */
  lockedHint: string;
  /** Which station must be solved before this one unlocks (undefined = available at start). */
  requires?: StationId;
}

export interface Scenario {
  seed: number;
  intro: string;
  win: string;
  lose: string;
  initialObjective: string;
  /** Story beat shown on solving each station — reveals the carried value(s). */
  beats: Record<StationId, string>;
  stations: Record<StationId, ScenarioStation>;
  half1: string; // 2 digits — the bookshelf ledger answer
  half2: string; // 2 digits — Mara's badge no., revealed by the desk note
  vaultCode: string; // half1 + half2 — the safe dial target
  exitCode: string; // 4 digits — revealed inside the safe, opens the door
}

const KEYWORDS = ['LEDGER', 'ATLAS', 'DIARY', 'ALMANAC', 'DOSSIER'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

// A Caesar cipher of `word`, shift in [3..23]. checkAnswer accepts the plaintext word.
function deskCipher(word: string, shift: number, seed: number): Puzzle {
  const enc = word
    .split('')
    .map((c) => ALPHABET[(ALPHABET.indexOf(c) + shift) % 26])
    .join('');
  return {
    id: `desk-${seed}`,
    skill: 'cipher',
    prompt: `Mara's note is in her usual Caesar hand:\n\n    ${enc}\n\nDecode it.`,
    data: { kind: 'caesar' },
    solution: word,
    hint: `She always shifted by ${shift}.`,
    explanation: `Caesar shift of ${shift}: move each letter back ${shift} places (A−${shift}, wrapping). It reads ${word}.`,
    checkAnswer: (input: string) => norm(input) === norm(word),
  };
}

// A ledger sum whose answer is `target` (a 2-digit number). Player adds the entries.
function ledgerPuzzle(target: number, keyword: string, rng: () => number, seed: number): Puzzle {
  const a = randInt(rng, 10, target - 12);
  const b = randInt(rng, 2, target - a - 1);
  const c = target - a - b; // a + b + c === target, all positive
  return {
    id: `book-${seed}`,
    skill: 'math',
    // MathView renders `data.expression` as the large display and `prompt` as the label, so the
    // sum must live in `expression` (keep the prompt to one narrative line — MathView doesn't
    // honor newlines).
    prompt: `Inside the ${keyword}, Mara underlined three figures. Their sum is the ledger entry.`,
    data: { kind: 'ledger', expression: `${a} + ${b} + ${c}` },
    solution: String(target),
    hint: 'Just add the three underlined figures.',
    explanation: `${a} + ${b} + ${c} = ${target} — the ledger entry, and the first half of the vault code.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === String(target),
  };
}

// The 4-dial vault. No clues of its own — the answer is the two halves you carried.
function vaultPuzzle(vaultCode: string, seed: number): Puzzle {
  return {
    id: `safe-${seed}`,
    skill: 'combination',
    prompt: `Mara's vault — four dials. The ledger entry, then her badge number.`,
    data: { kind: 'vault' },
    solution: vaultCode,
    hint: 'First two dials = the ledger entry; last two = her badge number.',
    explanation: `Set the dials to the ledger entry followed by her badge number: ${vaultCode}.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === vaultCode,
  };
}

export function generateScenario(seed: number): Scenario {
  const rng = mulberry32(seed);
  const keyword = pick(rng, KEYWORDS);
  const shift = randInt(rng, 3, 23);
  const half1 = String(randInt(rng, 21, 98)); // 2-digit ledger entry
  const half2 = String(randInt(rng, 21, 98)); // 2-digit badge no.
  const vaultCode = `${half1}${half2}`;
  const exitCode = String(randInt(rng, 1000, 9999));

  const stations: Record<StationId, ScenarioStation> = {
    desk: {
      id: 'desk',
      anchor: 'desk',
      presenter: 'overlay',
      puzzle: deskCipher(keyword, shift, seed),
      label: "[E] Read Mara's note",
      lockedHint: '',
    },
    bookshelf: {
      id: 'bookshelf',
      anchor: 'bookshelf',
      presenter: 'overlay',
      puzzle: ledgerPuzzle(Number(half1), keyword, rng, seed),
      label: `[E] Search for the ${keyword}`,
      lockedHint: 'A note on the desk first — where did she hide her records?',
      requires: 'desk',
    },
    safe: {
      id: 'safe',
      anchor: 'safe',
      presenter: 'diegetic',
      puzzle: vaultPuzzle(vaultCode, seed),
      label: '[E] Work the vault dials',
      lockedHint: `Find the ${keyword} before the vault makes sense.`,
      requires: 'bookshelf',
    },
  };

  return {
    seed,
    intro:
      "Detective Mara Vane vanished three nights ago, mid-case. You've let yourself into her study — and the door has locked behind you. " +
      'Her evidence is in the vault. Retrace her last moves, open it, and get out.',
    win: 'The vault’s evidence under your arm, the lock gives. You step into the corridor — Mara’s case is yours to finish. 🔓',
    lose: 'The bolt holds and the hour turns. Mara’s study keeps you, and its secrets, a while longer.',
    initialObjective: 'Start at her desk — there’s a note.',
    beats: {
      desk: `Decoded: "${keyword}". In the margin, pressed faint in pencil: her badge no. ${half2}. Her records are in the ${keyword} — check the shelf.`,
      bookshelf: `The ${keyword}'s last entry: ${half1}. Two numbers now — the entry, and her badge.`,
      safe: `The vault swings open. Mara's file — and a luggage tag looped to the key: EXIT ${exitCode}.`,
    },
    stations,
    half1,
    half2,
    vaultCode,
    exitCode,
  };
}
