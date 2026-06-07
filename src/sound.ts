// Tiny Web Audio helper for optional UI sound cues.
//
// Feature-detects AudioContext so it is a safe no-op in environments without it
// (e.g. jsdom during tests). A single lazily-created context is reused.

type Tone = { freq: number; durationMs: number; type?: OscillatorType };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function playTones(tones: Tone[]): void {
  const audio = getCtx();
  if (!audio) return;
  // A user gesture may be required before audio can start; resume best-effort.
  if (audio.state === 'suspended') void audio.resume();

  let when = audio.currentTime;
  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;
    // Short attack/decay envelope to avoid clicks.
    const dur = t.durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.18, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(when);
    osc.stop(when + dur);
    when += dur;
  }
}

/** Rising two-note "success" chime. */
export function playCorrect(): void {
  playTones([
    { freq: 660, durationMs: 90 },
    { freq: 990, durationMs: 140 },
  ]);
}

/** Low "nope" buzz. */
export function playWrong(): void {
  playTones([{ freq: 196, durationMs: 220, type: 'square' }]);
}

/** Soft tick for advancing to the next puzzle. */
export function playAdvance(): void {
  playTones([{ freq: 520, durationMs: 70, type: 'triangle' }]);
}
