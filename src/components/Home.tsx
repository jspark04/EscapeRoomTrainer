import type { Skill } from '../types';
import { GENERATORS } from '../games';

interface Props {
  onTrain: (skill: Skill) => void;
  onWarmUp: () => void;
  onDashboard: () => void;
  onTechniques: () => void;
  onSettings: () => void;
  onEscapeRoom: () => void;
}

const ICON: Record<Skill, string> = {
  cipher: '🔐',
  pattern: '🔢',
  observation: '👁️',
  logic: '🧩',
  combination: '🔒',
  anagram: '🔤',
  math: '➗',
  spatial: '🧭',
};

const ACCENT: Record<Skill, string> = {
  cipher: 'hover:border-emerald-500/60',
  pattern: 'hover:border-sky-500/60',
  observation: 'hover:border-violet-500/60',
  logic: 'hover:border-amber-500/60',
  combination: 'hover:border-rose-500/60',
  anagram: 'hover:border-teal-500/60',
  math: 'hover:border-orange-500/60',
  spatial: 'hover:border-cyan-500/60',
};

export function Home({ onTrain, onWarmUp, onDashboard, onTechniques, onSettings, onEscapeRoom }: Props) {
  return (
    <div className="animate-fadein mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-black text-white">🔓 Escape Room Brain Trainer</h1>
      <p className="mt-2 text-slate-300">Train the skills. Prime your brain. Beat the room.</p>

      <button
        onClick={onWarmUp}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-left text-lg font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-orange-400"
      >
        ⏱️ Start Warm-Up
        <span className="block text-sm font-normal text-slate-800">
          A timed mixed primer across every skill — run it right before a real room
        </span>
      </button>

      <button
        onClick={onEscapeRoom}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-stone-700 to-amber-900 p-5 text-left text-lg font-bold text-amber-100 transition hover:from-stone-600 hover:to-amber-800"
      >
        🕵️ Enter the Escape Room
        <span className="block text-sm font-normal text-amber-200/80">
          A first-person room to escape using everything you've trained
        </span>
      </button>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-white">Train a skill</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            onClick={() => onTrain(g.skill)}
            className={`flex items-center gap-3 rounded-xl border border-transparent bg-slate-800 p-4 text-left text-white transition hover:bg-slate-700 ${ACCENT[g.skill]}`}
          >
            <span className="text-2xl">{ICON[g.skill]}</span>
            <span className="font-medium">{g.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <button onClick={onTechniques} className="text-sky-400 underline hover:text-sky-300">
          📖 Technique library
        </button>
        <button onClick={onDashboard} className="text-sky-400 underline hover:text-sky-300">
          📊 View progress
        </button>
        <button onClick={onSettings} className="text-sky-400 underline hover:text-sky-300">
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}
