import type { Puzzle } from '../types';
import type { CombinationData } from '../games/combination';

export function CombinationView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as CombinationData;

  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <p className="mb-3 text-lg text-rose-300">Crack the lock from these clues:</p>

      <ul className="mb-4 space-y-1">
        {data.clues.map((clue, i) => (
          <li
            key={i}
            className="rounded-md border-l-4 border-rose-400 bg-slate-900/60 px-3 py-1.5 text-slate-200"
          >
            {clue}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        {Array.from({ length: data.length }, (_, i) => (
          <div
            key={i}
            className="flex h-14 w-12 items-center justify-center rounded-md border-2 border-rose-500/70 bg-slate-900 text-3xl font-semibold text-rose-400"
            aria-hidden="true"
          >
            ?
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-400">Enter the {data.length}-digit code.</p>
    </div>
  );
}
