import { useState } from 'react';

interface Props {
  /** The expected exit code (the safe's combination solution, digit string). */
  target: string;
  /** Called with the entered code; returns true if the door accepts it (room escaped). */
  onSubmit: (code: string) => boolean;
  onClose: () => void;
}

// A diegetic 4-digit (length follows the safe combination) keypad on the exit door.
// On a matching code the door opens; otherwise it shows a brief rejection.
export function DoorKeypadPresenter({ target, onSubmit, onClose }: Props) {
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);
  const maxLen = target.replace(/\D/g, '').length || 4;

  const press = (digit: string) => {
    setWrong(false);
    setEntry((e) => (e.length >= maxLen ? e : e + digit));
  };
  const clear = () => {
    setWrong(false);
    setEntry('');
  };
  const enter = () => {
    if (!onSubmit(entry)) {
      setWrong(true);
      setEntry('');
    }
  };

  return (
    <div className="flex w-64 flex-col items-center gap-4 rounded-xl bg-stone-900 p-6 text-amber-100">
      <h3 className="font-bold">Exit keypad</h3>
      <div className="w-full rounded bg-black/60 py-2 text-center font-mono text-2xl tracking-widest">
        {entry.padEnd(maxLen, '·')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="rounded bg-stone-700 px-4 py-2 font-mono text-lg transition hover:bg-stone-600"
          >
            {d}
          </button>
        ))}
        <button
          onClick={clear}
          className="rounded bg-stone-800 px-4 py-2 text-sm transition hover:bg-stone-700"
        >
          C
        </button>
        <button
          onClick={() => press('0')}
          className="rounded bg-stone-700 px-4 py-2 font-mono text-lg transition hover:bg-stone-600"
        >
          0
        </button>
        <button
          onClick={enter}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold transition hover:bg-emerald-500"
        >
          ↵
        </button>
      </div>
      {wrong && <p className="text-rose-400">Wrong code.</p>}
      <button onClick={onClose} className="rounded bg-stone-700 px-4 py-2 text-sm">
        Close
      </button>
    </div>
  );
}
