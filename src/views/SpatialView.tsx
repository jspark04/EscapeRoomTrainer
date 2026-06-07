import type { Puzzle } from '../types';
import type { SpatialData } from '../games/spatial';

function Compass() {
  return (
    <div className="relative mx-auto mt-4 h-28 w-28 rounded-full border border-cyan-700 bg-slate-900 text-sm font-semibold text-cyan-300">
      <span className="absolute left-1/2 top-1 -translate-x-1/2">N</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2">E</span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2">S</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2">W</span>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500">+</span>
    </div>
  );
}

export function SpatialView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as SpatialData;

  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <p className="text-lg text-cyan-300">{puzzle.prompt}</p>

      {data.kind === 'paths' ? (
        <p className="mt-3 text-sm text-cyan-400">
          Grid: {data.rows} rows x {data.cols} columns &mdash; move only RIGHT or UP.
        </p>
      ) : (
        <Compass />
      )}
    </div>
  );
}
