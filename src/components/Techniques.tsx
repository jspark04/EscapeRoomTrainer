import { useState } from 'react';
import type { Skill } from '../types';
import { TECHNIQUES } from '../coach/techniques';

const ACCENT: Record<Skill, string> = {
  cipher: 'text-emerald-300',
  pattern: 'text-sky-300',
  observation: 'text-violet-300',
  logic: 'text-amber-300',
  combination: 'text-rose-300',
  anagram: 'text-teal-300',
  math: 'text-orange-300',
  spatial: 'text-cyan-300',
};

export function Techniques({ onExit }: { onExit: () => void }) {
  const [open, setOpen] = useState<Skill | null>(TECHNIQUES[0]?.skill ?? null);

  return (
    <div className="animate-fadein mx-auto max-w-2xl p-6">
      <h2 className="text-xl font-bold text-white">Technique Library</h2>
      <p className="mt-1 mb-5 text-sm text-slate-400">
        How to recognize and crack each kind of puzzle. Read these to prime your brain before a room.
      </p>

      <div className="space-y-3">
        {TECHNIQUES.map((t) => {
          const isOpen = open === t.skill;
          return (
            <div key={t.skill} className="overflow-hidden rounded-xl bg-slate-800">
              <button
                onClick={() => setOpen(isOpen ? null : t.skill)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-700/60"
              >
                <span className={`font-semibold ${ACCENT[t.skill]}`}>{t.title}</span>
                <span className="shrink-0 text-slate-500">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-slate-700 px-4 py-4 text-sm">
                  <div>
                    <h3 className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
                      What to look for
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-slate-300">
                      {t.whatToLookFor.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
                      How to crack it
                    </h3>
                    <ol className="list-decimal space-y-1 pl-5 text-slate-300">
                      {t.howToCrack.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-3">
                    <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-400">
                      Worked example
                    </h3>
                    <p className="whitespace-pre-wrap text-slate-200">{t.example.puzzle}</p>
                    <p className="mt-2 text-slate-300">
                      Answer: <strong className={ACCENT[t.skill]}>{t.example.solution}</strong>
                    </p>
                    <p className="mt-2 text-slate-400">{t.example.walkthrough}</p>
                  </div>
                </div>
              )}
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
