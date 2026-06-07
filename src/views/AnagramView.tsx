import type { Puzzle } from '../types';
import type { AnagramData } from '../games/anagram';

export function AnagramView({ puzzle }: { puzzle: Puzzle }) {
  const data = puzzle.data as AnagramData;
  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <p className="mb-4 text-lg text-teal-300">Unscramble these letters into a word:</p>
      <div className="flex flex-wrap gap-2">
        {data.letters.map((letter, i) => (
          <span
            key={i}
            className="flex h-12 w-12 items-center justify-center rounded-md border border-teal-500/40 bg-slate-900 text-2xl font-bold uppercase text-teal-200 shadow-inner"
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
