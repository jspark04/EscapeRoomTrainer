import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../types';
import { GENERATORS } from '../games';
import { GamePlayer, type GameResult } from '../engine/GamePlayer';
import { statsStore as store } from '../stats/sharedStore';

const WARMUP_DIFFICULTY: Difficulty = 3;

function pickGenerator() {
  return GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
}

export function WarmUpSession({ onExit }: { onExit: () => void }) {
  const totalSeconds = store.getSettings().warmUpSeconds;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [done, setDone] = useState(false);
  const stats = useRef({ attempts: 0, correct: 0 });

  useEffect(() => {
    if (done) return;
    if (remaining <= 0) { setDone(true); return; }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, done]);

  function handleResult(r: GameResult) {
    store.recordAttempt({ skill: r.skill, correct: r.correct, timeMs: r.timeMs, difficulty: WARMUP_DIFFICULTY });
    stats.current.attempts += 1;
    if (r.correct) stats.current.correct += 1;
  }

  if (done) {
    const { attempts, correct } = stats.current;
    const score = attempts ? Math.round((correct / attempts) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h2 className="text-2xl font-bold text-white">Warm-Up Complete</h2>
        <p className="mt-4 text-6xl font-black text-emerald-400">{score}</p>
        <p className="text-slate-300">readiness score · {correct}/{attempts} solved</p>
        <p className="mt-4 text-slate-400">
          {score >= 70 ? 'Sharp and primed — go crush that escape room! 🔓' : 'Brain is warming up. Take a breath and trust your instincts.'}
        </p>
        <button onClick={onExit} className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-white">
          Done
        </button>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Warm-Up</h2>
        <span className="font-mono text-lg text-amber-300">{mm}:{ss}</span>
      </header>
      <GamePlayer
        nextPuzzle={() => pickGenerator().generate(WARMUP_DIFFICULTY)}
        difficulty={WARMUP_DIFFICULTY}
        onResult={handleResult}
      />
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        End early
      </button>
    </div>
  );
}
