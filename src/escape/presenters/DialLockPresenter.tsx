import { useState } from 'react';

export function normalizeDials(dials: number[]): number[] {
  return dials.map((d) => ((d % 10) + 10) % 10);
}

export function dialsMatch(dials: number[], target: string): boolean {
  return normalizeDials(dials).join('') === target.replace(/\D/g, '');
}

interface Props {
  /** The combination puzzle's solution (digit string), e.g. "473". */
  target: string;
  onSolved: () => void;
  onClose: () => void;
}

/** A simple DOM dial lock (the 3D dial mesh is wired in Task 8; this is the interactive core). */
export function DialLockPresenter({ target, onSolved, onClose }: Props) {
  const [dials, setDials] = useState<number[]>(() => target.replace(/\D/g, '').split('').map(() => 0));
  const bump = (i: number, delta: number) =>
    setDials((d) => d.map((v, j) => (j === i ? ((v + delta + 10) % 10) : v)));

  const solved = dialsMatch(dials, target);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-stone-900 p-6 text-amber-100">
      <h3 className="font-bold">Safe — set the combination</h3>
      <div className="flex gap-3">
        {dials.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <button onClick={() => bump(i, +1)} className="px-3 text-xl">▲</button>
            <div className="w-10 rounded bg-black/60 py-2 text-center font-mono text-2xl">{v}</div>
            <button onClick={() => bump(i, -1)} className="px-3 text-xl">▼</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={!solved}
          onClick={onSolved}
          className="rounded bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-40"
        >
          Open
        </button>
        <button onClick={onClose} className="rounded bg-stone-700 px-4 py-2">Close</button>
      </div>
    </div>
  );
}
