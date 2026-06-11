import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { KeyboardControls, Stats } from '@react-three/drei';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LookControlsHandle } from './scene/LookControls';
import * as THREE from 'three';

import { Room } from './scene/Room';
import { Player, KEY_MAP } from './scene/Player';
import { Crosshair } from './scene/Crosshair';
import { Desk } from './scene/furniture/Desk';
import { Bookshelf } from './scene/furniture/Bookshelf';
import { SafeAndPainting } from './scene/furniture/SafeAndPainting';
import { ExitDoor } from './scene/furniture/ExitDoor';
import { EscapeHUD } from './ui/EscapeHUD';
import { CaseNotes } from './ui/CaseNotes';
import { OverlayPresenter } from './presenters/OverlayPresenter';
import { DialLockPresenter } from './presenters/DialLockPresenter';
import { DoorKeypadPresenter } from './presenters/DoorKeypadPresenter';

import type { Blueprint, Station } from './blueprint/types';
import { createSession, type SessionStatus } from './session/RoomSession';
import { pickTarget, type Interactable } from './scene/interaction';
import type { AABB } from './scene/physics';
import { generateLayout, type Layout } from './scene/layout';
import { generateScenario, type StationId } from './blueprint/scenario';

import { createHttpClient } from './claude/client';
import { cannedHint } from './claude/fallbacks';
import type { HintTier, NarrativeResponse } from './claude/types';

import { statsStore } from '../stats/sharedStore';
import type { Puzzle } from '../types';

const SEED_BASE = 1000;
const THEME = 'detective-study';
// Module-level client: in dev/CI no proxy runs, so available() resolves false and the room
// builds from the deterministic generator with canned narrative/hints (fully playable offline).
const claude = createHttpClient('/claude');

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
  interactables,
}: {
  targetRef: React.RefObject<string | null>;
  onTarget: (id: string | null) => void;
  interactables: Interactable[];
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
      interactables,
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

interface RoomSceneProps {
  layout: Layout;
  furnitureBoxes: AABB[];
  interactables: Interactable[];
  active: boolean;
  safeSolved: boolean;
  escaped: boolean;
  controlsRef: React.RefObject<LookControlsHandle | null>;
  sessionRef: React.RefObject<ReturnType<typeof createSession> | null>;
  onTimerState: (remainingMs: number, status: SessionStatus) => void;
  targetRef: React.RefObject<string | null>;
  onTarget: (id: string | null) => void;
}

/**
 * The 3D scene, isolated behind React.memo. All its props are stable refs/callbacks or
 * shallow-comparable booleans/memoized objects, so the high-frequency overlay state
 * (timer, crosshair target, hints, narrative) re-renders the parent's HUD WITHOUT
 * reconciling the Canvas — which is what made fast mouse-look jitter (a re-render burst
 * from the InteractionBridge competing with the 60fps render loop).
 */
const RoomScene = memo(function RoomScene({
  layout,
  furnitureBoxes,
  interactables,
  active,
  safeSolved,
  escaped,
  controlsRef,
  sessionRef,
  onTimerState,
  targetRef,
  onTarget,
}: RoomSceneProps) {
  return (
    <KeyboardControls map={KEY_MAP}>
      <Canvas
        shadows
        // Cap the device-pixel-ratio: on HiDPI displays the default renders ~4x the pixels,
        // which halves the framerate and shows up as judder on fast mouse-look.
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance' }}
        camera={{ position: layout.playerStart, fov: 70 }}
      >
        {import.meta.env.DEV && <Stats />}
        <Room />
        <Player boxes={furnitureBoxes} active={active} controlsRef={controlsRef} />
        <Desk position={layout.anchors.desk.pos} rotation={layout.anchors.desk.rotation} />
        <Bookshelf
          position={layout.anchors.bookshelf.pos}
          rotation={layout.anchors.bookshelf.rotation}
        />
        <SafeAndPainting
          position={layout.anchors.safe.pos}
          rotation={layout.anchors.safe.rotation}
          revealed={safeSolved}
        />
        <ExitDoor
          position={layout.anchors.door.pos}
          rotation={layout.anchors.door.rotation}
          open={escaped}
        />
        <TimerBridge sessionRef={sessionRef} onState={onTimerState} />
        <InteractionBridge targetRef={targetRef} onTarget={onTarget} interactables={interactables} />
      </Canvas>
    </KeyboardControls>
  );
});

export function EscapeRoom({ onExit }: { onExit: () => void }) {
  const [seedNonce, setSeedNonce] = useState(0);
  const durationMs = statsStore.getSettings().warmUpSeconds * 1000;

  // Procedural furniture placement: a deterministic, validated layout keyed to the same nonce
  // that drives the build, so retry produces a fresh (still-navigable) arrangement. The
  // collision boxes (for the Player) and interactable xz points (for the InteractionBridge)
  // are derived from the layout's anchors.
  const layout = useMemo(() => generateLayout(SEED_BASE + seedNonce), [seedNonce]);
  const furnitureBoxes = useMemo(() => Object.values(layout.anchors).map((a) => a.box), [layout]);
  const interactables = useMemo<Interactable[]>(
    () => Object.entries(layout.anchors).map(([id, a]) => ({ id, x: a.pos[0], z: a.pos[2] })),
    [layout],
  );

  // The room is now built SYNCHRONOUSLY from a hand-crafted, deterministic, value-chained
  // scenario ("The Vanished Detective"). Keyed on seedNonce so retry yields a fresh chain.
  // Claude stays an optional narrative/hint enhancer — it never gates play.
  const scenario = useMemo(() => generateScenario(SEED_BASE + seedNonce), [seedNonce]);

  // Build the session's Blueprint FROM the scenario, purely to feed the unchanged
  // createSession/resolver gating (desk -> bookshelf -> safe -> door). The resolver only needs
  // ids/consumes/produces to gate unlocks + detect completion; the actual puzzles/answers come
  // from the scenario's embedded Puzzles.
  const blueprint = useMemo<Blueprint>(
    () => ({
      theme: 'detective-study',
      seed: scenario.seed,
      stations: (['desk', 'bookshelf', 'safe'] as const).map((id, i, arr) => ({
        id,
        skill: scenario.stations[id].puzzle.skill,
        difficulty: 2,
        anchor: id,
        presenter: scenario.stations[id].presenter,
        produces: [id === 'safe' ? 'exitCode' : `clue_${id}`],
        consumes: i === 0 ? [] : [`clue_${arr[i - 1]}`],
        narrativeKey: id,
      })),
      finalLock: { anchor: 'door', consumes: ['exitCode'] },
    }),
    [scenario],
  );

  // Puzzles come straight from the scenario's stations (carry the chained values + checkAnswer).
  const puzzleFor = useCallback(
    (id: string): Puzzle | null =>
      (id === 'desk' || id === 'bookshelf' || id === 'safe')
        ? scenario.stations[id as StationId].puzzle
        : null,
    [scenario],
  );

  // The exit code is revealed inside the safe and consumed by the door. The safe dial target is
  // the assembled vault code (= scenario.stations.safe.puzzle.solution).
  const exitCode = scenario.exitCode;

  // Narrative initializes from the scenario (great offline), still overridable by Claude.
  const [narrative, setNarrative] = useState<NarrativeResponse>(() => ({
    intro: scenario.intro,
    win: scenario.win,
    lose: scenario.lose,
  }));
  // Reset to the current scenario's text on retry; then enhance via Claude if reachable.
  useEffect(() => {
    let cancelled = false;
    setNarrative({ intro: scenario.intro, win: scenario.win, lose: scenario.lose });
    claude.narrate(THEME).then((n) => {
      if (!cancelled && n) setNarrative(n);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  // The session is the source of truth for chain state + timer. It is rebuilt whenever the
  // blueprint changes (i.e., on retry). We keep a synced ref so the render-loop bridges can
  // tick it without re-subscribing each frame.
  const session = useMemo(
    () =>
      createSession(blueprint, statsStore.getSettings().warmUpSeconds * 1000, {
        recordSolved: (e) =>
          statsStore.recordAttempt({ skill: e.skill, correct: true, timeMs: 0, difficulty: 3 }),
      }),
    [blueprint],
  );
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const controlsRef = useRef<LookControlsHandle | null>(null);
  const targetRef = useRef<string | null>(null);

  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [status, setStatus] = useState<SessionStatus>('playing');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [safeSolved, setSafeSolved] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  // On-solve story beat — a brief toast revealing the value(s) the player just carried forward.
  const [discovery, setDiscovery] = useState<string | null>(null);
  // Case Notes journal: evidence lines collected as stations are solved, plus its open/closed state.
  const [notes, setNotes] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

  // Adaptive hint state for the active puzzle modal. The tier escalates 1->2->3 on repeated
  // presses; `hintText` shows the latest hint (Claude if reachable, else canned).
  const [hintTier, setHintTier] = useState<HintTier>(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Keep elapsed for the win screen (read once per render from the session, null-safe).
  const elapsedMs = session?.getState().elapsedMs ?? 0;

  const closeModal = useCallback(() => setActiveModal(null), []);

  // Stable so the TimerBridge prop identity never changes — re-renders must not churn the
  // Canvas subtree's effects (which is what made mouse-look jumpy).
  const handleTimerState = useCallback((rem: number, st: SessionStatus) => {
    setRemainingMs(rem);
    setStatus((prev) => (prev === 'escaped' ? prev : st));
  }, []);

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

    const station = blueprint.stations.find((s) => s.id === id);
    if (!station) return;
    if (!session.isUnlocked(id) || session.isSolvedStation(id)) return;
    const puzzle = puzzleFor(id);
    if (!puzzle) return;

    controlsRef.current?.unlock();
    // Opening a puzzle dismisses the intro (so the post-solve beat toast isn't suppressed by it),
    // clears any lingering beat toast, and resets adaptive-hint state.
    setShowIntro(false);
    setDiscovery(null);
    setHintTier(1);
    setHintText(null);
    if (station.presenter === 'diegetic') {
      // The safe dial target is the assembled vault code (puzzle.solution = scenario.vaultCode).
      setActiveModal({ kind: 'dial', station, target: puzzle.solution });
    } else {
      setActiveModal({ kind: 'overlay', station, puzzle });
    }
  }, [activeModal, status, safeSolved, exitCode, puzzleFor, blueprint]);

  // Global "E" to engage; or a click while the pointer is locked and aimed at a target.
  // "N" toggles the Case Notes — but only when no presenter modal is open, so typing an answer
  // (which may contain the letter n) never flips the journal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') engage();
      if (e.code === 'KeyN' && activeModal === null) setNotesOpen((o) => !o);
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
  }, [engage, activeModal]);

  const handleSolve = useCallback(
    (station: Station, produced: Record<string, string>) => {
      const session = sessionRef.current;
      if (!session) return;
      session.solve(station.id, produced);
      setSolvedIds((prev) => new Set(prev).add(station.id));
      if (station.skill === 'combination') setSafeSolved(true);
      setActiveModal(null);
      // Surface the story beat for this station — reveals the value(s) just carried forward.
      const beat = scenario.beats[station.id as StationId];
      if (beat) setDiscovery(beat);
      // Record the evidence line in the Case Notes (the persistent record the objectives recall).
      const note = scenario.notes[station.id as StationId];
      if (note) setNotes((prev) => [...prev, note]);
    },
    [scenario],
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

  // Build the live, story-driven objective from the scenario beats + solved set. The objective
  // bar never re-prints the digit codes — the beats/toast reveal each value once at discovery and
  // the Case Notes keep the persistent record; objectives only recall WHERE to look.
  const objective = useMemo(() => {
    if (escaped) return 'You made it out.';
    if (safeSolved) return 'You have the exit code. Find the door.';
    if (solvedIds.has('bookshelf'))
      return `Set the vault: the ${scenario.bookNoun} entry, then her badge number — it's in your case notes.`;
    if (solvedIds.has('desk'))
      // Digit-free recall: the beat/toast revealed the badge no. once; it lives in the notes.
      return `Find the ${scenario.keyword} on the shelf — her badge number is in your case notes.`;
    return scenario.initialObjective;
  }, [escaped, safeSolved, solvedIds, scenario]);

  const prompt = useMemo(() => {
    if (activeModal || status !== 'playing') return null;
    const id = targetId;
    if (!id) return null;
    if (id === 'door') {
      if (safeSolved) return '[E] Enter the exit code';
      return "The door won't budge without the exit code.";
    }
    if (id !== 'desk' && id !== 'bookshelf' && id !== 'safe') return null;
    const sceneStation = scenario.stations[id as StationId];
    if (!session) return null;
    if (session.isSolvedStation(id)) return 'Already solved.';
    // Locked stations show the scenario's diegetic locked-hint (story nudge toward the prereq).
    if (!session.isUnlocked(id)) return sceneStation.lockedHint || 'Solve the earlier clue first.';
    // Unlocked: the scenario's interaction label (story-flavored, e.g. "[E] Read Mara's note").
    return sceneStation.label;
    // session is a ref; targetId/solvedIds/safeSolved/scenario drive the recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, activeModal, status, safeSolved, solvedIds, scenario]);

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

  // Auto-fade the on-solve beat toast after a few seconds (it can also be dismissed manually,
  // is cleared when the next puzzle opens, and is reset on retry).
  useEffect(() => {
    if (!discovery) return;
    const t = setTimeout(() => setDiscovery(null), 8000);
    return () => clearTimeout(t);
  }, [discovery]);

  const onRetry = useCallback(() => {
    setSolvedIds(new Set());
    setSafeSolved(false);
    setEscaped(false);
    setStatus('playing');
    setActiveModal(null);
    setShowIntro(true);
    setDiscovery(null);
    setNotes([]);
    setNotesOpen(false);
    setHintTier(1);
    setHintText(null);
    targetRef.current = null;
    setTargetId(null);
    setRemainingMs(statsStore.getSettings().warmUpSeconds * 1000);
    // Bumping the nonce recreates scenario -> blueprint -> session (fresh chain + timer).
    setSeedNonce((n) => n + 1);
  }, []);

  // All hooks have run above this point — hook order stays stable across renders. The room is
  // built synchronously from the scenario, so there is a single return (no async splash gate).
  const activePuzzle =
    activeModal?.kind === 'overlay'
      ? activeModal.puzzle
      : activeModal?.kind === 'dial'
        ? puzzleFor(activeModal.station.id)
        : null;
  const activeSkill = activeModal?.kind !== 'door' ? activeModal?.station.skill ?? null : null;

  return (
    <div className="relative h-screen w-screen bg-black">
      <RoomScene
        layout={layout}
        furnitureBoxes={furnitureBoxes}
        interactables={interactables}
        active={activeModal === null && status === 'playing'}
        safeSolved={safeSolved}
        escaped={escaped}
        controlsRef={controlsRef}
        sessionRef={sessionRef}
        onTimerState={handleTimerState}
        targetRef={targetRef}
        onTarget={setTargetId}
      />

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

      {/* Case Notes journal — the persistent record of collected evidence. Hidden while a
          presenter modal is open (to avoid overlapping it); 'N' toggles it. */}
      {!activeModal && <CaseNotes notes={notes} open={notesOpen} onToggle={() => setNotesOpen((o) => !o)} />}

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

      {/* On-solve story beat — a brief, dismissable toast revealing the carried value(s). */}
      {discovery && status === 'playing' && !activeModal && !showIntro && (
        <div className="absolute inset-x-0 top-20 z-20 mx-auto max-w-md px-4">
          <div className="rounded-xl bg-amber-950/85 p-4 text-center text-amber-100 shadow-lg">
            <p className="text-sm leading-relaxed">{discovery}</p>
            <button
              onClick={() => setDiscovery(null)}
              className="mt-3 rounded bg-amber-500 px-4 py-1 text-sm font-semibold text-stone-900 transition hover:bg-amber-400"
            >
              Got it
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
          WASD to move · mouse to look · click to capture · [E] or click to interact · [N] case notes
        </div>
      )}
    </div>
  );
}
