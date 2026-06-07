import { useEffect, useState } from 'react';
import type { Puzzle } from '../types';
import type { ObservationData } from '../games/observation';

export function ObservationView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as ObservationData;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), data.flashMs);
    return () => clearTimeout(t);
  }, [puzzle.id, data.flashMs]);

  return (
    <div className="rounded-lg bg-slate-800 p-4">
      {visible ? (
        <div
          className="grid gap-2 text-3xl"
          style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))` }}
        >
          {data.grid.map((sym, i) => (
            <span key={i} className="text-center">{sym}</span>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-lg text-slate-300">{puzzle.prompt}</p>
      )}
    </div>
  );
}
