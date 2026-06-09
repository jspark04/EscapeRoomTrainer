interface Props {
  remainingMs: number;
  status: 'playing' | 'escaped' | 'failed';
  objective: string;
  elapsedMs: number;
  /** Flavor text for the win/lose end screens (Claude narrative or canned fallback). */
  winText?: string;
  loseText?: string;
  onRetry: () => void;
  onExit: () => void;
}

function mmss(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function EscapeHUD({
  remainingMs,
  status,
  objective,
  elapsedMs,
  winText,
  loseText,
  onRetry,
  onExit,
}: Props) {
  if (status !== 'playing') {
    const won = status === 'escaped';
    const flavor = won ? winText : loseText;
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 px-6 text-center text-amber-100">
        <h2 className="text-3xl font-black">{won ? '🔓 You escaped!' : "⏳ Time's up"}</h2>
        {flavor && <p className="mt-3 max-w-md text-amber-200/90">{flavor}</p>}
        {won && <p className="mt-2">Escaped in {mmss(elapsedMs)}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onRetry}
            className="rounded bg-amber-500 px-5 py-2 font-semibold text-stone-900 transition hover:bg-amber-400"
          >
            Play again
          </button>
          <button
            onClick={onExit}
            className="rounded bg-stone-700 px-5 py-2 transition hover:bg-stone-600"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  const low = remainingMs <= 30_000;
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 text-amber-100">
      <span className="rounded bg-black/50 px-3 py-1 text-sm">{objective}</span>
      <span
        className={`rounded bg-black/50 px-3 py-1 font-mono text-lg ${low ? 'text-rose-400' : ''}`}
      >
        {mmss(remainingMs)}
      </span>
    </div>
  );
}
