import type { Puzzle } from '../types';
import type { MathData } from '../games/math';

export function MathView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as MathData;

  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <p className="text-sm uppercase tracking-wide text-orange-400">{puzzle.prompt}</p>
      <p className="mt-3 text-center font-mono text-4xl font-bold text-orange-300">
        {data.expression}
      </p>
    </div>
  );
}
