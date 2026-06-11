import type { Puzzle } from '../../types';
import { mulberry32, pick, randInt } from '../../rng';

export type StationId = 'desk' | 'bookshelf' | 'safe';

/** Which cipher the desk note uses to hide the keyword. */
export type NoteKind = 'caesar' | 'a1z26';
/** Which puzzle the bookshelf item poses, both answering to half1. */
export type BookKind = 'ledger-sum' | 'page-sequence';

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
  /** Short evidence lines collected into the Case Notes when each station is solved. */
  notes: Record<StationId, string>;
  stations: Record<StationId, ScenarioStation>;
  /** Which note cipher this seed picked. */
  noteKind: NoteKind;
  /** Which bookshelf puzzle this seed picked. */
  bookKind: BookKind;
  /** Display noun for the bookshelf entry ('Ledger' | 'Page') — lets the UI recall it without hardcoding variant flavor. */
  bookNoun: 'Ledger' | 'Page';
  half1: string; // 2 digits — the bookshelf entry answer
  half2: string; // 2 digits — Mara's badge no., revealed by the desk note
  vaultCode: string; // half1 + half2 — the safe dial target
  exitCode: string; // 4 digits — revealed inside the safe, opens the door
}

const KEYWORDS = ['LEDGER', 'ATLAS', 'DIARY', 'ALMANAC', 'DOSSIER'];
const NOTE_KINDS: readonly NoteKind[] = ['caesar', 'a1z26'];
const BOOK_KINDS: readonly BookKind[] = ['ledger-sum', 'page-sequence'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

// A Caesar cipher of `word`, shift in [3..23]. checkAnswer accepts the plaintext word.
function caesarNote(word: string, shift: number, seed: number): Puzzle {
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

// An A1Z26 note: the keyword as dash-separated 1-based alphabet positions (e.g. 12-5-4-7-5-18).
// checkAnswer accepts the plaintext word. CipherView renders the prompt in a <pre>, so newlines OK.
function a1z26Note(word: string, seed: number): Puzzle {
  const enc = word
    .split('')
    .map((c) => String(ALPHABET.indexOf(c) + 1))
    .join('-');
  return {
    id: `desk-${seed}`,
    skill: 'cipher',
    prompt: `Mara's note is a row of numbers — her A1Z26 shorthand (A=1 … Z=26):\n\n    ${enc}\n\nDecode it.`,
    data: { kind: 'a1z26' },
    solution: word,
    hint: 'Each number is a letter by its place in the alphabet: 1=A, 2=B, … 26=Z.',
    explanation: `A1Z26: turn each number into the letter at that position (${enc} → ${word}).`,
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

// A page-sequence puzzle: four circled page numbers in arithmetic progression (step s∈[3..9])
// where the NEXT page = `target` (= half1). MathView shows data.expression as the big display,
// so the sequence lives there as `t1, t2, t3, t4, ?`. Solution is String(target).
function pageSequencePuzzle(target: number, keyword: string, rng: () => number, seed: number): Puzzle {
  const step = randInt(rng, 3, 9);
  // Four shown terms ending one step below target; the next (5th) term IS target.
  const t4 = target - step;
  const terms = [t4 - 3 * step, t4 - 2 * step, t4 - step, t4]; // half1∈[60..98] keeps these 2-digit
  return {
    id: `book-${seed}`,
    skill: 'math',
    prompt: `In the ${keyword}, Mara circled four pages in turn. The next page she'd have circled is the entry.`,
    data: { kind: 'page-sequence', expression: `${terms.join(', ')}, ?` },
    solution: String(target),
    hint: 'The circled pages climb by a fixed step — continue the pattern one more page.',
    explanation: `The pages rise by ${step} each time (${terms.join(', ')}). The next is ${t4} + ${step} = ${target} — the entry, and the first half of the vault code.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === String(target),
  };
}

// The 4-dial vault. No clues of its own — the answer is the two halves you carried.
function vaultPuzzle(vaultCode: string, bookNoun: string, seed: number): Puzzle {
  const entryLabel = bookNoun.toLowerCase();
  return {
    id: `safe-${seed}`,
    skill: 'combination',
    prompt: `Mara's vault — four dials. The ${entryLabel} entry, then her badge number.`,
    data: { kind: 'vault' },
    solution: vaultCode,
    hint: `First two dials = the ${entryLabel} entry; last two = her badge number.`,
    explanation: `Set the dials to the ${entryLabel} entry followed by her badge number: ${vaultCode}.`,
    checkAnswer: (input: string) => input.replace(/\D/g, '') === vaultCode,
  };
}

export function generateScenario(seed: number): Scenario {
  const rng = mulberry32(seed);
  // rng() call order is FIXED for determinism (the determinism test guards this):
  //   1) keyword           2) noteKind        3) bookKind
  // then values, in this order:
  //   4) half1 (range depends on bookKind: page-sequence needs [60..98] so all four shown
  //      terms stay positive 2-digit; ledger-sum keeps [21..98])
  //   5) half2             6) exitCode
  // Each puzzle builder then draws its own remaining randomness AFTER the above, in station
  // order desk → bookshelf:
  //   - caesar note draws `shift` (a1z26 draws nothing)
  //   - ledger-sum draws a, b (page-sequence draws `step`)
  const keyword = pick(rng, KEYWORDS);
  const noteKind = pick(rng, NOTE_KINDS);
  const bookKind = pick(rng, BOOK_KINDS);

  const half1 = String(bookKind === 'page-sequence' ? randInt(rng, 60, 98) : randInt(rng, 21, 98));
  const half2 = String(randInt(rng, 21, 98)); // 2-digit badge no.
  const vaultCode = `${half1}${half2}`;
  const exitCode = String(randInt(rng, 1000, 9999));
  const bookNoun: 'Ledger' | 'Page' = bookKind === 'page-sequence' ? 'Page' : 'Ledger';

  const deskPuzzle =
    noteKind === 'caesar'
      ? caesarNote(keyword, randInt(rng, 3, 23), seed)
      : a1z26Note(keyword, seed);

  const bookPuzzle =
    bookKind === 'page-sequence'
      ? pageSequencePuzzle(Number(half1), keyword, rng, seed)
      : ledgerPuzzle(Number(half1), keyword, rng, seed);

  const stations: Record<StationId, ScenarioStation> = {
    desk: {
      id: 'desk',
      anchor: 'desk',
      presenter: 'overlay',
      puzzle: deskPuzzle,
      label: "[E] Read Mara's note",
      lockedHint: '',
    },
    bookshelf: {
      id: 'bookshelf',
      anchor: 'bookshelf',
      presenter: 'overlay',
      puzzle: bookPuzzle,
      label: `[E] Search for the ${keyword}`,
      lockedHint: 'A note on the desk first — where did she hide her records?',
      requires: 'desk',
    },
    safe: {
      id: 'safe',
      anchor: 'safe',
      presenter: 'diegetic',
      puzzle: vaultPuzzle(vaultCode, bookNoun, seed),
      label: '[E] Work the vault dials',
      lockedHint: `Find the ${keyword} before the vault makes sense.`,
      requires: 'bookshelf',
    },
  };

  const entryNoun = bookNoun.toLowerCase();

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
      bookshelf: `The ${keyword}'s ${entryNoun} entry: ${half1}. Two numbers now — the entry, and her badge.`,
      safe: `The vault swings open. Mara's file — and a luggage tag looped to the key: EXIT ${exitCode}.`,
    },
    notes: {
      desk: `Badge no. — ${half2} · Records hidden in the ${keyword}`,
      bookshelf: `${bookNoun} entry — ${half1}`,
      safe: `EXIT code — ${exitCode}`,
    },
    stations,
    noteKind,
    bookKind,
    bookNoun,
    half1,
    half2,
    vaultCode,
    exitCode,
  };
}
