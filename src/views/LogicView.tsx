import type { Puzzle } from '../types';

export function LogicView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <pre className="whitespace-pre-wrap rounded-lg bg-slate-800 p-4 text-lg text-amber-200">
      {puzzle.prompt}
    </pre>
  );
}
