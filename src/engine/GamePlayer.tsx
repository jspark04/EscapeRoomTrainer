import { useEffect, useState } from 'react';
import type { Puzzle, Skill, Difficulty } from '../types';
import { VIEWS } from '../views';
import { statsStore } from '../stats/sharedStore';
import { playAdvance, playCorrect, playWrong } from '../sound';

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
  const [elapsedMs, setElapsedMs] = useState(0);

  const View = VIEWS[puzzle.skill];
  const answered = verdict !== null || revealed;

  // Live elapsed-time ticker, paused once the puzzle is answered.
  useEffect(() => {
    if (answered) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [answered, startedAt]);

  // Keyboard: once answered, Enter advances to the next puzzle.
  useEffect(() => {
    if (!answered) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  function submit() {
    if (answered) return;
    const correct = puzzle.checkAnswer(input);
    setVerdict(correct);
    if (statsStore.getSettings().sound) (correct ? playCorrect : playWrong)();
    onResult({ skill: puzzle.skill, correct, timeMs: Date.now() - startedAt, difficulty });
  }

  function reveal() {
    if (verdict === null) {
      if (statsStore.getSettings().sound) playWrong();
      onResult({ skill: puzzle.skill, correct: false, timeMs: Date.now() - startedAt, difficulty });
    }
    setRevealed(true);
  }

  function next() {
    if (statsStore.getSettings().sound) playAdvance();
    setPuzzle(nextPuzzle());
    setInput('');
    setShowHint(false);
    setRevealed(false);
    setVerdict(null);
    setStartedAt(Date.now());
    setElapsedMs(0);
    onAdvance?.();
  }

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="flex flex-col gap-4">
      <div key={puzzle.id} className="animate-fadein flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span aria-label="elapsed time" className="font-mono tabular-nums">
            ⏱ {seconds}s
          </span>
        </div>

        <View puzzle={puzzle} />

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your answer"
          autoFocus
          className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-lg text-white outline-none focus:border-emerald-500"
          disabled={answered}
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={submit}
            disabled={answered}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            Submit
          </button>
          <button
            onClick={() => setShowHint(true)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-600"
          >
            Hint
          </button>
          <button
            onClick={reveal}
            className="rounded-lg bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-600"
          >
            Reveal
          </button>
          {answered && (
            <button
              onClick={next}
              autoFocus
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-500"
            >
              Next →
            </button>
          )}
        </div>

        {showHint && puzzle.hint && <p className="text-sm text-amber-300">💡 {puzzle.hint}</p>}
        {verdict === true && <p className="font-semibold text-emerald-400">Correct! 🎉</p>}
        {verdict === false && !revealed && <p className="font-semibold text-rose-400">Not quite.</p>}
        {revealed && (
          <p className="text-slate-200">
            Answer: <strong>{puzzle.solution}</strong>
          </p>
        )}

        {answered && puzzle.explanation && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
            <span className="font-semibold text-sky-300">How to crack it: </span>
            {puzzle.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
