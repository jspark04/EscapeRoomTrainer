import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import { Room, ROOM_HALF } from './scene/Room';
import { Player, KEY_MAP } from './scene/Player';
import { Crosshair } from './scene/Crosshair';
import { Desk } from './scene/furniture/Desk';
import { Bookshelf } from './scene/furniture/Bookshelf';
import { SafeAndPainting } from './scene/furniture/SafeAndPainting';
import { ExitDoor } from './scene/furniture/ExitDoor';
import { EscapeHUD } from './ui/EscapeHUD';
import { OverlayPresenter } from './presenters/OverlayPresenter';
import { DialLockPresenter } from './presenters/DialLockPresenter';
import { DoorKeypadPresenter } from './presenters/DoorKeypadPresenter';

import type { Station } from './blueprint/types';
import { createSession, type SessionStatus } from './session/RoomSession';
import { pickTarget, type Interactable } from './scene/interaction';
import type { AABB } from './scene/physics';

import { createHttpClient } from './claude/client';
import { buildRoom, type BuiltRoom } from './claude/roomBuilder';
import { cannedNarrative, cannedHint } from './claude/fallbacks';
import type { HintTier, NarrativeResponse } from './claude/types';

import { getGenerator } from '../games';
import { mulberry32 } from '../rng';
import { statsStore } from '../stats/sharedStore';
import type { Puzzle } from '../types';

const ANCHORS: Record<string, { pos: [number, number, number]; box: AABB }> = {
  desk: { pos: [-3, 0, -3], box: { minX: -3.9, maxX: -2.1, minZ: -3.5, maxZ: -2.5 } },
  bookshelf: { pos: [3.5, 0, 3.5], box: { minX: 2.7, maxX: 4.3, minZ: 3.0, maxZ: 4.0 } },
  safe: { pos: [4.55, 1.5, -3], box: { minX: 4.1, maxX: 5, minZ: -3.5, maxZ: -2.5 } },
  door: { pos: [0, 0, -ROOM_HALF + 0.05], box: { minX: -0.75, maxX: 0.75, minZ: -5, maxZ: -4.85 } },
};

const SEED_BASE = 1000;
const THEME = 'detective-study';
// Module-level client: in dev/CI no proxy runs, so available() resolves false and the room
// builds from the deterministic generator with canned narrative/hints (fully playable offline).
const claude = createHttpClient('/claude');
const FURNITURE_BOXES = Object.values(ANCHORS).map((a) => a.box);
// Interactables = each station's anchor xz + the door's anchor xz.
const INTERACTABLES: Interactable[] = Object.entries(ANCHORS).map(([id, a]) => ({
  id,
  x: a.pos[0],
  z: a.pos[2],
}));

type ActiveModal =
  | { kind: 'overlay'; station: Station; puzzle: Puzzle }
  | { kind: 'dial'; station: Station; target: string }
  | { kind: 'door'; target: string };

/** Drives the session timer from the render loop and lifts state to React ~4x/sec. */
function TimerBridge({
  sessionRef,
  onState,
}: {
  sessionRef: React.RefObject<ReturnType<typeof createSession> | null>;
  onState: (remainingMs: number, status: SessionStatus) => void;
}) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const session = sessionRef.current;
    if (!session) return;
    session.tick(dt * 1000);
    acc.current += dt;
    if (acc.current >= 0.25) {
      acc.current = 0;
      const s = session.getState();
      onState(s.remainingMs, s.status);
    }
  });
  return null;
}

/** Each frame, raycast-lite the looked-at interactable; lifts target id to React ~5x/sec. */
function InteractionBridge({
  targetRef,
  onTarget,
}: {
  targetRef: React.RefObject<string | null>;
  onTarget: (id: string | null) => void;
}) {
  const { camera } = useThree();
  const acc = useRef(0);
  const fwd = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    // Throttle the relatively cheap pickTarget to ~5x/sec to avoid per-frame churn.
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    camera.getWorldDirection(fwd.current);
    const hit = pickTarget(
      { x: camera.position.x, z: camera.position.z },
      { x: fwd.current.x, z: fwd.current.z },
      INTERACTABLES,
      2.5,
      0.6,
    );
    const id = hit?.id ?? null;
    if (id !== targetRef.current) {
      targetRef.current = id;
      onTarget(id);
    }
  });
  return null;
}

export function EscapeRoom({ onExit }: { onExit: () => void }) {
  const [seedNonce, setSeedNonce] = useState(0);
  const durationMs = statsStore.getSettings().warmUpSeconds * 1000;

  // The room is built asynchronously: buildRoom() asks Claude (if a proxy is reachable),
  // validates + judges the result, and ALWAYS resolves — falling back to the deterministic
  // generator otherwise. Keyed on seedNonce so retry rebuilds a fresh chain. A cancel guard
  // prevents a stale build (from a superseded nonce) from clobbering the current room.
  const [built, setBuilt] = useState<BuiltRoom | null>(null);
  const [narrative, setNarrative] = useState<NarrativeResponse>(() => cannedNarrative(THEME));
  useEffect(() => {
    let cancelled = false;
    setBuilt(null);
    buildRoom(SEED_BASE + seedNonce, claude).then((r) => {
      if (!cancelled) setBuilt(r);
    });
    return () => {
      cancelled = true;
    };
  }, [seedNonce]);

  // Narrative is fetched once per build: Claude if available, else the canned fallback. It is
  // independent of the build outcome (flavor text only) and never blocks play.
  useEffect(() => {
    let cancelled = false;
    setNarrative(cannedNarrative(THEME));
    claude.narrate(THEME).then((n) => {
      if (!cancelled && n) setNarrative(n);
    });
    return () => {
      cancelled = true;
    };
  }, [seedNonce]);

  // From here down, all hooks run every render regardless of build state (stable hook order).
  // Downstream memos tolerate a null blueprint by yielding empty/placeholder values; the
  // returned JSX gates on `built` and shows a splash until the room is ready.
  const blueprint = built?.blueprint ?? null;

  // Per-session puzzles, generated once (memoized) per build. Each station gets a deterministic
  // seed derived from the blueprint seed + its index, bumped by the nonce. Empty until built.
  const puzzles = useMemo(() => {
    const map = new Map<string, Puzzle>();
    if (!blueprint) return map;
    blueprint.stations.forEach((station, index) => {
      const rng = mulberry32(SEED_BASE + index + seedNonce * 100);
      map.set(station.id, getGenerator(station.skill).generate(station.difficulty, rng));
    });
    return map;
  }, [blueprint, seedNonce]);

  // The exit code is the safe (combination) station's solution (empty until built).
  const safeStation = blueprint?.stations.find((s) => s.skill === 'combination') ?? null;
  const exitCode = (safeStation && puzzles.get(safeStation.id)?.solution) ?? '';

  // The session is the source of truth for chain state + timer. It is rebuilt whenever the
  // blueprint changes (i.e., on retry). We keep a synced ref so the render-loop bridges can
  // tick it without re-subscribing each frame. Null until the room is built.
  const session = useMemo(
    () =>
      blueprint
        ? createSession(blueprint, statsStore.getSettings().warmUpSeconds * 1000, {
            recordSolved: (e) =>
              statsStore.recordAttempt({ skill: e.skill, correct: true, timeMs: 0, difficulty: 3 }),
          })
        : null,
    [blueprint],
  );
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const targetRef = useRef<string | null>(null);

  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [status, setStatus] = useState<SessionStatus>('playing');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [safeSolved, setSafeSolved] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Adaptive hint state for the active puzzle modal. The tier escalates 1->2->3 on repeated
  // presses; `hintText` shows the latest hint (Claude if reachable, else canned).
  const [hintTier, setHintTier] = useState<HintTier>(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Keep elapsed for the win screen (read once per render from the session, null-safe).
  const elapsedMs = session?.getState().elapsedMs ?? 0;

  const closeModal = useCallback(() => setActiveModal(null), []);

  const engage = useCallback(() => {
    if (activeModal || status !== 'playing') return;
    const id = targetRef.current;
    if (!id) return;
    const session = sessionRef.current;
    if (!session) return;

    if (id === 'door') {
      // The door is only engageable once the safe is cracked (it isn't a station, so the
      // resolver has no unlock state for it — `safeSolved` is the sole gate).
      if (!safeSolved) return;
      controlsRef.current?.unlock();
      setActiveModal({ kind: 'door', target: exitCode });
      return;
    }

    const station = blueprint?.stations.find((s) => s.id === id);
    if (!station) return;
    if (!session.isUnlocked(id) || session.isSolvedStation(id)) return;

    controlsRef.current?.unlock();
    // Reset adaptive-hint state each time a puzzle is opened.
    setHintTier(1);
    setHintText(null);
    if (station.presenter === 'diegetic') {
      const puzzle = puzzles.get(station.id)!;
      setActiveModal({ kind: 'dial', station, target: puzzle.solution });
    } else {
      setActiveModal({ kind: 'overlay', station, puzzle: puzzles.get(station.id)! });
    }
  }, [activeModal, status, safeSolved, exitCode, puzzles, blueprint]);

  // Global "E" to engage; or a click while the pointer is locked and aimed at a target.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') engage();
    };
    const onClick = () => {
      // Only treat a click as "interact" when already pointer-locked and aiming at something;
      // the first click (to capture the pointer) shouldn't trigger an interaction.
      if (controlsRef.current?.isLocked && targetRef.current) engage();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [engage]);

  const handleSolve = useCallback(
    (station: Station, produced: Record<string, string>) => {
      const session = sessionRef.current;
      if (!session) return;
      session.solve(station.id, produced);
      setSolvedIds((prev) => new Set(prev).add(station.id));
      if (station.skill === 'combination') setSafeSolved(true);
      setActiveModal(null);
    },
    [],
  );

  const handleFinal = useCallback(
    (code: string): boolean => {
      const session = sessionRef.current;
      if (!session) return false;
      if (code.replace(/\D/g, '') !== exitCode.replace(/\D/g, '')) return false;
      const ok = session.submitFinal(code);
      if (ok) {
        setEscaped(true);
        setStatus('escaped');
        setActiveModal(null);
      }
      return ok;
    },
    [exitCode],
  );

  // Build the live objective + interaction prompt.
  const objective = useMemo(() => {
    if (safeSolved) return `Exit code found: ${exitCode}. Find the door.`;
    if (solvedIds.has('bookshelf')) return 'Crack the safe behind the painting.';
    if (solvedIds.has('desk')) return 'Search the bookshelf for the next clue.';
    return 'Inspect the desk to begin.';
  }, [safeSolved, solvedIds, exitCode]);

  const prompt = useMemo(() => {
    if (activeModal || status !== 'playing') return null;
    const id = targetId;
    if (!id) return null;
    if (id === 'door') {
      if (safeSolved) return '[E] Enter the exit code';
      return 'The door is locked.';
    }
    const station = blueprint?.stations.find((s) => s.id === id);
    if (!station || !session) return null;
    if (session.isSolvedStation(id)) return 'Already solved.';
    if (!session.isUnlocked(id)) return 'Locked — solve the earlier clue first.';
    // Skill-neutral labels: the desk/bookshelf skill now varies per playthrough, so the
    // prompt must not assume a specific puzzle type (e.g. "Read the cipher").
    const labels: Record<string, string> = {
      desk: '[E] Inspect the desk',
      bookshelf: '[E] Examine the books',
      safe: '[E] Work the safe dial',
    };
    return labels[id] ?? '[E] Inspect';
    // session is a ref; targetId/solvedIds/safeSolved/blueprint drive the recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, activeModal, status, safeSolved, solvedIds, blueprint]);

  // Adaptive hint for the active puzzle modal: ask Claude (if reachable) for a tier-appropriate
  // hint, falling back to the canned, escalating, non-spoiling hint. Tier climbs 1->2->3 on
  // repeated presses. Optional and unobtrusive — it never blocks play.
  const requestHint = useCallback(
    async (skill: string, puzzle: Puzzle) => {
      const tier = hintTier;
      const req = {
        skill,
        prompt: puzzle.prompt,
        hint: puzzle.hint,
        explanation: puzzle.explanation,
        tier,
      };
      setHintLoading(true);
      try {
        const res = await claude.hint(req);
        const text = res?.hint ?? cannedHint(req).hint;
        setHintText(text);
      } catch {
        setHintText(cannedHint(req).hint);
      } finally {
        setHintLoading(false);
        // Escalate for the next press, capped at tier 3.
        setHintTier((t) => (t < 3 ? ((t + 1) as HintTier) : 3));
      }
    },
    [hintTier],
  );

  const onRetry = useCallback(() => {
    setSolvedIds(new Set());
    setSafeSolved(false);
    setEscaped(false);
    setStatus('playing');
    setActiveModal(null);
    setShowIntro(true);
    setHintTier(1);
    setHintText(null);
    targetRef.current = null;
    setTargetId(null);
    setRemainingMs(statsStore.getSettings().warmUpSeconds * 1000);
    // Bumping the nonce recreates blueprint -> session -> puzzles (fresh chain + timer).
    setSeedNonce((n) => n + 1);
  }, []);

  // All hooks have run above this point — hook order stays stable across renders. Only the
  // RENDERED OUTPUT is gated: until the async build resolves, show a lightweight splash
  // instead of the Canvas. In dev/CI (no proxy) this resolves on the next tick via fallback.
  if (!built) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-black text-amber-100">
        <p className="animate-pulse text-lg">Entering the room…</p>
        <button
          onClick={onExit}
          className="absolute bottom-4 left-4 z-10 rounded bg-slate-800/80 px-3 py-1 text-sm text-white"
        >
          ← Exit
        </button>
      </div>
    );
  }

  const activePuzzle =
    activeModal?.kind === 'overlay'
      ? activeModal.puzzle
      : activeModal?.kind === 'dial'
        ? puzzles.get(activeModal.station.id) ?? null
        : null;
  const activeSkill = activeModal?.kind !== 'door' ? activeModal?.station.skill ?? null : null;

  return (
    <div className="relative h-screen w-screen bg-black">
      <KeyboardControls map={KEY_MAP}>
        <Canvas shadows camera={{ position: [0, 1.6, 3.5], fov: 70 }}>
          <Room />
          <Player
            boxes={FURNITURE_BOXES}
            active={activeModal === null && status === 'playing'}
            controlsRef={controlsRef}
            onLock={() => {}}
            onUnlock={() => {}}
          />
          <Desk position={ANCHORS.desk.pos} />
          <Bookshelf position={ANCHORS.bookshelf.pos} />
          <SafeAndPainting
            position={ANCHORS.safe.pos}
            rotation={[0, -Math.PI / 2, 0]}
            revealed={safeSolved}
          />
          <ExitDoor position={ANCHORS.door.pos} open={escaped} />
          <TimerBridge
            sessionRef={sessionRef}
            onState={(rem, st) => {
              setRemainingMs(rem);
              setStatus((prev) => (prev === 'escaped' ? prev : st));
            }}
          />
          <InteractionBridge targetRef={targetRef} onTarget={setTargetId} />
        </Canvas>
      </KeyboardControls>

      <Crosshair prompt={prompt} />

      <EscapeHUD
        remainingMs={remainingMs}
        status={status}
        elapsedMs={elapsedMs}
        objective={objective}
        winText={narrative.win}
        loseText={narrative.lose}
        onRetry={onRetry}
        onExit={onExit}
      />

      {/* Intro narrative — shown once at the start, dismissable, never blocks core play. */}
      {showIntro && status === 'playing' && !activeModal && (
        <div className="absolute inset-x-0 top-20 z-20 mx-auto max-w-md px-4">
          <div className="rounded-xl bg-black/70 p-4 text-center text-amber-100 shadow-lg">
            <p className="text-sm leading-relaxed">{narrative.intro}</p>
            <button
              onClick={() => setShowIntro(false)}
              className="mt-3 rounded bg-amber-500 px-4 py-1 text-sm font-semibold text-stone-900 transition hover:bg-amber-400"
            >
              Begin
            </button>
          </div>
        </div>
      )}

      {/* Presenter host (DOM modals) */}
      {activeModal?.kind === 'overlay' && (
        <OverlayPresenter
          puzzle={activeModal.puzzle}
          produces={activeModal.station.produces}
          onSolved={(produced) => handleSolve(activeModal.station, produced)}
          onClose={closeModal}
        />
      )}
      {activeModal?.kind === 'dial' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <DialLockPresenter
            target={activeModal.target}
            onSolved={() =>
              handleSolve(activeModal.station, {
                [activeModal.station.produces[0]]: activeModal.target,
              })
            }
            onClose={closeModal}
          />
        </div>
      )}

      {/* Adaptive Hint control — available while a puzzle modal (overlay/dial) is open. */}
      {activePuzzle && activeSkill && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex flex-col items-center gap-2 px-4">
          {hintText && (
            <div className="pointer-events-auto max-w-md rounded-lg bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg">
              {hintText}
            </div>
          )}
          <button
            onClick={() => requestHint(activeSkill, activePuzzle)}
            disabled={hintLoading}
            className="pointer-events-auto rounded-full bg-amber-600/90 px-4 py-1.5 text-sm font-semibold text-stone-900 shadow transition hover:bg-amber-500 disabled:opacity-50"
          >
            {hintLoading ? 'Thinking…' : hintText ? `Need more help? (Hint ${hintTier})` : '💡 Hint'}
          </button>
        </div>
      )}
      {activeModal?.kind === 'door' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <DoorKeypadPresenter target={activeModal.target} onSubmit={handleFinal} onClose={closeModal} />
        </div>
      )}

      <button
        onClick={onExit}
        className="absolute bottom-4 left-4 z-10 rounded bg-slate-800/80 px-3 py-1 text-sm text-white"
      >
        ← Exit
      </button>
      {!activeModal && status === 'playing' && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded bg-black/40 px-3 py-1 text-xs text-amber-200/70">
          WASD to move · mouse to look · click to capture · [E] or click to interact
        </div>
      )}
    </div>
  );
}
