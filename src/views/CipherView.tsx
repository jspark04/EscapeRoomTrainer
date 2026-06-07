import type { Puzzle } from '../types';

export function CipherView({ puzzle }: { puzzle: Puzzle }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-800 p-4 text-lg text-emerald-300">
      {puzzle.prompt}
    </pre>
  );
}
