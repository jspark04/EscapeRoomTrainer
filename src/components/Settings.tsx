import { useState } from 'react';
import type { Difficulty } from '../types';
import { DIFFICULTIES } from '../types';
import { statsStore as store } from '../stats/sharedStore';
import { playCorrect } from '../sound';

const DURATIONS = [
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '7 min', seconds: 420 },
  { label: '10 min', seconds: 600 },
];

export function Settings({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState(() => store.getSettings());

  function update(patch: Partial<typeof settings>) {
    store.setSettings(patch);
    setSettings(store.getSettings());
  }

  return (
    <div className="animate-fadein mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-xl font-bold text-white">Settings</h2>

      <div className="space-y-6">
        {/* Sound */}
        <section className="rounded-lg bg-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Sound effects</h3>
              <p className="text-sm text-slate-400">Subtle blips on correct / wrong / next.</p>
            </div>
            <button
              onClick={() => {
                const next = !settings.sound;
                update({ sound: next });
                if (next) playCorrect();
              }}
              role="switch"
              aria-checked={settings.sound}
              className={`relative h-7 w-12 rounded-full transition ${
                settings.sound ? 'bg-emerald-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  settings.sound ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Warm-up duration */}
        <section className="rounded-lg bg-slate-800 p-4">
          <h3 className="font-semibold text-white">Warm-Up length</h3>
          <p className="mb-3 text-sm text-slate-400">How long a pre-game warm-up session runs.</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.seconds}
                onClick={() => update({ warmUpSeconds: d.seconds })}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  settings.warmUpSeconds === d.seconds
                    ? 'bg-amber-500 font-semibold text-slate-900'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Difficulty mode */}
        <section className="rounded-lg bg-slate-800 p-4">
          <h3 className="font-semibold text-white">Training difficulty</h3>
          <p className="mb-3 text-sm text-slate-400">
            Adaptive climbs and drops with your accuracy. Fixed holds a level you choose.
          </p>
          <div className="mb-3 flex gap-2">
            {(['adaptive', 'fixed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => update({ difficultyMode: mode })}
                className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                  settings.difficultyMode === mode
                    ? 'bg-sky-600 font-semibold text-white'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {settings.difficultyMode === 'fixed' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Level:</span>
              {DIFFICULTIES.map((lvl: Difficulty) => (
                <button
                  key={lvl}
                  onClick={() => update({ fixedLevel: lvl })}
                  className={`h-9 w-9 rounded-lg text-sm transition ${
                    settings.fixedLevel === lvl
                      ? 'bg-sky-600 font-semibold text-white'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <button onClick={onExit} className="mt-6 text-sm text-slate-400 underline">
        ← Back to home
      </button>
    </div>
  );
}
