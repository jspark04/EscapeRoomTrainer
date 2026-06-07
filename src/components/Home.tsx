import type { Skill } from '../types';
import { GENERATORS } from '../games';

interface Props {
  onTrain: (skill: Skill) => void;
  onWarmUp: () => void;
  onDashboard: () => void;
}

export function Home({ onTrain, onWarmUp, onDashboard }: Props) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-black text-white">🔓 Escape Room Brain Trainer</h1>
      <p className="mt-2 text-slate-300">Train the skills. Prime your brain. Beat the room.</p>

      <button
        onClick={onWarmUp}
        className="mt-6 w-full rounded-xl bg-amber-500 p-5 text-left text-lg font-bold text-slate-900"
      >
        ⏱️ Start Warm-Up
        <span className="block text-sm font-normal text-slate-800">~7 min mixed primer before a real room</span>
      </button>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-white">Train a skill</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            onClick={() => onTrain(g.skill as Skill)}
            className="rounded-xl bg-slate-800 p-4 text-left text-white hover:bg-slate-700"
          >
            {g.name}
          </button>
        ))}
      </div>

      <button onClick={onDashboard} className="mt-8 text-sm text-sky-400 underline">
        View progress →
      </button>
    </div>
  );
}
