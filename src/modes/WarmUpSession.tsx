import { useEffect, useRef, useState } from 'react';
import type { Difficulty, Skill } from '../types';
import { GENERATORS } from '../games';
import { GamePlayer, type GameResult } from '../engine/GamePlayer';
import { statsStore as store } from '../stats/sharedStore';

const WARMUP_DIFFICULTY: Difficulty = 3;

const SKILL_NAME: Record<string, string> = Object.fromEntries(
  GENERATORS.map((g) => [g.skill, g.name]),
);

function pickGenerator() {
  return GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
}

interface Tally {
  attempts: number;
  correct: number;
}

export function WarmUpSession({ onExit }: { onExit: () => void }) {
  const totalSeconds = store.getSettings().warmUpSeconds;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [done, setDone] = useState(false);
  const stats = useRef<{ attempts: number; correct: number; bySkill: Map<Skill, Tally> }>({
    attempts: 0,
    correct: 0,
    bySkill: new Map(),
  });

  useEffect(() => {
    if (done) return;
    if (remaining <= 0) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, done]);

  function handleResult(r: GameResult) {
    store.recordAttempt({
      skill: r.skill,
      correct: r.correct,
      timeMs: r.timeMs,
      difficulty: WARMUP_DIFFICULTY,
    });
    const s = stats.current;
    s.attempts += 1;
    if (r.correct) s.correct += 1;
    const t = s.bySkill.get(r.skill) ?? { attempts: 0, correct: 0 };
    t.attempts += 1;
    if (r.correct) t.correct += 1;
    s.bySkill.set(r.skill, t);
  }

  if (done) {
    const { attempts, correct, bySkill } = stats.current;
    const score = attempts ? Math.round((correct / attempts) * 100) : 0;
    const rows = [...bySkill.entries()].sort((a, b) => b[1].attempts - a[1].attempts);
    return (
      <div className="animate-fadein mx-auto max-w-xl p-6 text-center">
        <h2 className="text-2xl font-bold text-white">Warm-Up Complete</h2>
        <p className="mt-4 text-6xl font-black text-emerald-400">{score}</p>
        <p className="text-slate-300">
          readiness score · {correct}/{attempts} solved
        </p>
        <p className="mt-4 text-slate-400">
          {score >= 70
            ? 'Sharp and primed — go crush that escape room! 🔓'
            : 'Brain is warming up. Take a breath and trust your instincts.'}
        </p>

        {rows.length > 0 && (
          <div className="mt-6 text-left">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              By skill
            </h3>
            <ul className="divide-y divide-slate-800 rounded-lg bg-slate-800/60">
              {rows.map(([skill, t]) => (
                <li key={skill} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-slate-200">{SKILL_NAME[skill] ?? skill}</span>
                  <span className="font-mono text-slate-300">
                    {t.correct}/{t.attempts} · {Math.round((t.correct / t.attempts) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
        <span className="font-mono text-lg text-amber-300">
          {mm}:{ss}
        </span>
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
