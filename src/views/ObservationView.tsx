import { useEffect, useState } from 'react';
import type { Puzzle } from '../types';
import type { ObservationData } from '../games/observation';

function Grid({ cells, cols }: { cells: string[]; cols: number }) {
  return (
    <div
      className="grid gap-2 text-3xl"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((sym, i) => (
        <span key={i} className="text-center">{sym}</span>
      ))}
    </div>
  );
}

export function ObservationView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as ObservationData;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), data.flashMs);
    return () => clearTimeout(t);
  }, [puzzle.id, data.flashMs]);

  // 'whatchanged': flash the original grid, then permanently show the altered grid
  // alongside the prompt so the player can compare it against their memory.
  if (data.kind === 'whatchanged') {
    return (
      <div className="rounded-lg bg-slate-800 p-4">
        {visible ? (
          <Grid cells={data.grid} cols={data.cols} />
        ) : (
          <div className="space-y-3">
            <Grid cells={data.gridB} cols={data.cols} />
            <p className="text-center text-lg text-slate-300">{puzzle.prompt}</p>
          </div>
        )}
      </div>
    );
  }

  // 'count' and 'position': flash the grid, then hide it and show the prompt.
  return (
    <div className="rounded-lg bg-slate-800 p-4">
      {visible ? (
        <Grid cells={data.grid} cols={data.cols} />
      ) : (
        <p className="py-6 text-center text-lg text-slate-300">{puzzle.prompt}</p>
      )}
    </div>
  );
}
