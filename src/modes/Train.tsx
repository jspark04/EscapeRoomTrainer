import { useRef, useState } from 'react';
import type { Skill, Difficulty } from '../types';
import { getGenerator } from '../games';
import { GamePlayer, type GameResult } from '../engine/GamePlayer';
import { nextDifficulty } from '../engine/difficulty';
import { StatsStore } from '../stats/StatsStore';

const store = new StatsStore();

export function Train({ skill, onExit }: { skill: Skill; onExit: () => void }) {
  const generator = getGenerator(skill);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const recent = useRef<boolean[]>([]);
  const [solved, setSolved] = useState(0);

  function handleResult(r: GameResult) {
    store.recordAttempt({ skill: r.skill, correct: r.correct, timeMs: r.timeMs, difficulty });
    recent.current = [...recent.current, r.correct].slice(-5);
    setDifficulty((d) => nextDifficulty(d, recent.current));
    if (r.correct) setSolved((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{generator.name}</h2>
        <div className="text-sm text-slate-300">
          Level {difficulty} · Solved {solved}
        </div>
      </header>
      <GamePlayer
        nextPuzzle={() => generator.generate(difficulty)}
        difficulty={difficulty}
        onResult={handleResult}
      />
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        ← Back to home
      </button>
    </div>
  );
}
