import type { Skill } from '../types';
import { GENERATORS } from '../games';
import { StatsStore } from '../stats/StatsStore';

const store = new StatsStore();

export function Dashboard({ onExit }: { onExit: () => void }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-bold text-white">Your Progress</h2>
      <div className="grid gap-3">
        {GENERATORS.map((g) => {
          const s = store.getSkillStats(g.skill as Skill);
          return (
            <div key={g.id} className="rounded-lg bg-slate-800 p-4">
              <h3 className="font-semibold text-white">{g.name}</h3>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-sm text-slate-300">
                <div><dt>Attempts</dt><dd className="text-lg text-white">{s.attempts}</dd></div>
                <div><dt>Accuracy</dt><dd className="text-lg text-white">{Math.round(s.accuracy * 100)}%</dd></div>
                <div><dt>Avg time</dt><dd className="text-lg text-white">{(s.avgTimeMs / 1000).toFixed(1)}s</dd></div>
                <div><dt>Best streak</dt><dd className="text-lg text-white">{s.bestStreak}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        ← Back to home
      </button>
    </div>
  );
}
