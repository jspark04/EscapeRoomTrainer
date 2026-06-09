// Center reticle plus an interaction prompt, drawn as a DOM overlay above the canvas.
export function Crosshair({ prompt }: { prompt: string | null }) {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/80" />
      {prompt && (
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/60 px-3 py-1 text-sm text-amber-100">
          {prompt}
        </div>
      )}
    </>
  );
}
