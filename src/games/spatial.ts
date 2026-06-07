import type { Difficulty, Puzzle, PuzzleGenerator, Rng } from '../types';
import { clampDifficulty } from '../types';
import { mulberry32, pick, randInt, uid } from '../rng';

/** Compass directions in clockwise order starting at North. */
const DIRS = ['NORTH', 'EAST', 'SOUTH', 'WEST'] as const;
type Dir = (typeof DIRS)[number];

export type SpatialData =
  | { kind: 'turns'; start: Dir; turns: string[]; final: Dir }
  | { kind: 'relative'; facing: Dir; side: string; result: Dir }
  | { kind: 'paths'; rows: number; cols: number; count: number };

type Kind = SpatialData['kind'];

function kindsFor(d: Difficulty): Kind[] {
  if (d <= 1) return ['turns', 'relative'];
  if (d <= 2) return ['turns', 'relative'];
  if (d <= 3) return ['turns', 'relative', 'paths'];
  return ['turns', 'relative', 'paths'];
}

/** Normalize any direction answer to its full uppercase word; numbers stay as digits. */
function normalizeDir(s: string): string {
  const t = s.trim().toUpperCase().replace(/[.\s]/g, '');
  const byLetter: Record<string, Dir> = { N: 'NORTH', E: 'EAST', S: 'SOUTH', W: 'WEST' };
  if (byLetter[t]) return byLetter[t];
  if ((DIRS as readonly string[]).includes(t)) return t;
  return t;
}

function normalizeNum(s: string): string {
  return s.trim().replace(/[,\s]/g, '');
}

/** Rotate a direction by a number of clockwise 90-degree quarter-turns. */
function rotate(dir: Dir, quarters: number): Dir {
  const i = DIRS.indexOf(dir);
  return DIRS[(((i + quarters) % 4) + 4) % 4];
}

const TURN_QUARTERS: Record<string, number> = {
  'turn left': -1,
  'turn right': 1,
  'turn around': 2,
};

function buildTurns(d: Difficulty, rng: Rng): { prompt: string; data: SpatialData; solution: string; explanation: string } {
  const start = pick(rng, DIRS);
  const steps = randInt(rng, 2, 2 + d); // 3..7 steps
  const options = ['turn left', 'turn right', 'turn around'];
  const turns: string[] = [];
  let cur = start;
  for (let i = 0; i < steps; i++) {
    const move = pick(rng, options);
    turns.push(move);
    cur = rotate(cur, TURN_QUARTERS[move]);
  }
  const final = cur;
  const prompt = `You are facing ${start}. You ${turns.join(', then ')}. Which compass direction are you facing now?`;
  return {
    prompt,
    data: { kind: 'turns', start, turns, final },
    solution: final,
    explanation: `Track your heading one turn at a time clockwise N→E→S→W: left is -90 deg, right is +90 deg, around is 180 deg. Starting at ${start} and applying the turns in order lands you facing ${final}.`,
  };
}

/** side -> clockwise quarter-turns from the facing direction. */
const SIDE_QUARTERS: Record<string, number> = {
  'to your left': -1,
  'to your right': 1,
  'directly behind you': 2,
  'directly ahead of you': 0,
};

function buildRelative(rng: Rng): { prompt: string; data: SpatialData; solution: string; explanation: string } {
  const facing = pick(rng, DIRS);
  const side = pick(rng, Object.keys(SIDE_QUARTERS));
  const result = rotate(facing, SIDE_QUARTERS[side]);
  const prompt = `You are facing ${facing}. Your destination is ${side}. Which compass direction is that?`;
  return {
    prompt,
    data: { kind: 'relative', facing, side, result },
    solution: result,
    explanation: `Face ${facing} and place the compass around you: ahead is ${facing}, your right is the next direction clockwise, your left is counter-clockwise, behind is opposite. So "${side}" points ${result}.`,
  };
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

function buildPaths(d: Difficulty, rng: Rng): { prompt: string; data: SpatialData; solution: string; explanation: string } {
  // Keep grids small (2x2..3x3) so answers stay reasonable.
  const max = d >= 5 ? 3 : 2;
  const rows = randInt(rng, 2, max);
  const cols = randInt(rng, 2, max);
  const count = choose(rows + cols, rows);
  const prompt = `On a ${rows}x${cols} grid you start at the bottom-left corner and must reach the top-right corner, moving only one cell RIGHT or one cell UP at a time. How many distinct paths are there?`;
  return {
    prompt,
    data: { kind: 'paths', rows, cols, count },
    solution: String(count),
    explanation: `Every path uses exactly ${cols} rights and ${rows} ups, so it is a sequence of ${rows + cols} moves; choose which ${rows} of them are "up". That is C(${rows + cols}, ${rows}) = ${count}.`,
  };
}

export const spatialGenerator: PuzzleGenerator = {
  id: 'spatial',
  name: 'Spatial Reasoning',
  skill: 'spatial',
  generate(difficulty: Difficulty, rng: Rng = mulberry32(Math.floor(Math.random() * 1e9))): Puzzle {
    const d = clampDifficulty(difficulty);
    const kind = pick(rng, kindsFor(d));

    let built: { prompt: string; data: SpatialData; solution: string; explanation: string };
    let isNumber = false;
    if (kind === 'turns') {
      built = buildTurns(d, rng);
    } else if (kind === 'relative') {
      built = buildRelative(rng);
    } else {
      built = buildPaths(d, rng);
      isNumber = true;
    }

    const solution = built.solution;
    const checkAnswer = isNumber
      ? (input: string) => normalizeNum(input) !== '' && Number(normalizeNum(input)) === Number(solution)
      : (input: string) => normalizeDir(input) === normalizeDir(solution);

    return {
      id: uid('spatial'),
      skill: 'spatial',
      prompt: built.prompt,
      data: built.data,
      solution,
      hint:
        kind === 'paths'
          ? 'Count moves: every route is some arrangement of rights and ups. Use combinations.'
          : 'Picture a compass and turn step by step; clockwise goes N → E → S → W.',
      explanation: built.explanation,
      checkAnswer,
    };
  },
};
