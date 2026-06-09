import { useState } from 'react';
import type { Puzzle } from '../../types';
import type { Token } from '../blueprint/types';
import { VIEWS } from '../../views';

interface Props {
  puzzle: Puzzle;
  produces: Token[];
  onSolved: (produced: Record<Token, string>) => void;
  onClose: () => void;
}

// Reuses the existing per-skill view; on a correct answer, maps every produced token to the
// puzzle's solution string (Phase 1 stations produce a single token = the solution/code).
export function OverlayPresenter({ puzzle, produces, onSolved, onClose }: Props) {
  const View = VIEWS[puzzle.skill];
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  function submit() {
    if (puzzle.checkAnswer(input)) {
      const produced: Record<Token, string> = {};
      for (const t of produces) produced[t] = puzzle.solution;
      onSolved(produced);
    } else {
      setWrong(true);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6">
        <View puzzle={puzzle} />
        <input
          type="text"
          value={input}
          autoFocus
          onChange={(e) => { setInput(e.target.value); setWrong(false); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your answer"
          className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-lg text-white"
        />
        {wrong && <p className="mt-2 text-rose-400">Not quite.</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={submit} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Submit</button>
          <button onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-white">Close</button>
        </div>
      </div>
    </div>
  );
}
