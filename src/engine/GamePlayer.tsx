import { useMemo, useState } from 'react';
import type { Puzzle, Skill, Difficulty } from '../types';
import { VIEWS } from '../views';

export interface GameResult {
  skill: Skill;
  correct: boolean;
  timeMs: number;
  difficulty: Difficulty;
}

interface Props {
  nextPuzzle: () => Puzzle;
  difficulty?: Difficulty;
  onResult: (r: GameResult) => void;
  onAdvance?: () => void; // called when user clicks Next
}

export function GamePlayer({ nextPuzzle, difficulty = 1, onResult, onAdvance }: Props) {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle());
  const [input, setInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const View = VIEWS[puzzle.skill];
  const answered = verdict !== null || revealed;

  function submit() {
    if (answered) return;
    const correct = puzzle.checkAnswer(input);
    setVerdict(correct);
    onResult({ skill: puzzle.skill, correct, timeMs: Date.now() - startedAt, difficulty });
  }

  function reveal() {
    if (verdict === null) {
      onResult({ skill: puzzle.skill, correct: false, timeMs: Date.now() - startedAt, difficulty });
    }
    setRevealed(true);
  }

  function next() {
    setPuzzle(nextPuzzle());
    setInput('');
    setShowHint(false);
    setRevealed(false);
    setVerdict(null);
    setStartedAt(Date.now());
    onAdvance?.();
  }

  const key = useMemo(() => puzzle.id, [puzzle]);

  return (
    <div key={key} className="flex flex-col gap-4">
      <View puzzle={puzzle} />

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Your answer"
        className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-lg text-white"
        disabled={answered}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={submit}
          disabled={answered}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Submit
        </button>
        <button
          onClick={() => setShowHint(true)}
          className="rounded-lg bg-slate-600 px-4 py-2 text-white"
        >
          Hint
        </button>
        <button
          onClick={reveal}
          className="rounded-lg bg-slate-600 px-4 py-2 text-white"
        >
          Reveal
        </button>
        {answered && (
          <button
            onClick={next}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white"
          >
            Next
          </button>
        )}
      </div>

      {showHint && puzzle.hint && <p className="text-sm text-amber-300">💡 {puzzle.hint}</p>}
      {verdict === true && <p className="font-semibold text-emerald-400">Correct! 🎉</p>}
      {verdict === false && !revealed && <p className="font-semibold text-rose-400">Not quite.</p>}
      {revealed && <p className="text-slate-200">Answer: <strong>{puzzle.solution}</strong></p>}
    </div>
  );
}
