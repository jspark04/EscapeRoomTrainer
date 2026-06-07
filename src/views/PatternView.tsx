import type { Puzzle } from '../types';

export function PatternView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <p className="rounded-lg bg-slate-800 p-4 text-2xl font-mono text-sky-300">
      {puzzle.prompt}
    </p>
  );
}
