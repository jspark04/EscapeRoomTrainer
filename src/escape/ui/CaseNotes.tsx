interface Props {
  /** Evidence lines collected so far, in the order discovered. */
  notes: string[];
  /** Whether the panel is expanded. */
  open: boolean;
  /** Toggle the panel open/closed. */
  onToggle: () => void;
}

/**
 * Presentational Case Notes journal — a 📓 pill (bottom-right) that expands into a compact
 * panel listing the evidence the player has collected. Amber-on-dark to match the HUD; plain
 * DOM so it never captures pointer lock. State (which notes, open/closed) lives in EscapeRoom.
 */
export function CaseNotes({ notes, open, onToggle }: Props) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="pointer-events-auto w-64 rounded-xl bg-amber-950/90 p-3 text-amber-100 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
            Case Notes
          </p>
          {notes.length === 0 ? (
            <p className="text-sm text-amber-200/60">Nothing collected yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {notes.map((line, i) => (
                <li key={i} className="text-sm leading-snug">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="pointer-events-auto rounded-full bg-amber-600/90 px-4 py-1.5 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-500"
      >
        📓 Case Notes{notes.length > 0 ? ` (${notes.length})` : ''}
      </button>
    </div>
  );
}
