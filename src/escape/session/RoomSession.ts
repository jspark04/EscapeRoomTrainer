import type { Blueprint, Token } from '../blueprint/types';
import type { Skill } from '../../types';
import { createResolver } from '../blueprint/resolver';

export type SessionStatus = 'playing' | 'escaped' | 'failed';

export interface SessionState {
  status: SessionStatus;
  remainingMs: number;
  elapsedMs: number;
}

export interface SolvedEvent {
  stationId: string;
  skill: Skill;
}

interface Hooks {
  recordSolved?: (e: SolvedEvent) => void;
}

export interface Session {
  getState: () => SessionState;
  tick: (deltaMs: number) => void;
  solve: (stationId: string, produced: Record<Token, string>) => void;
  submitFinal: (code: string) => boolean;
  isUnlocked: (stationId: string) => boolean;
}

export function createSession(bp: Blueprint, durationMs: number, hooks: Hooks = {}): Session {
  const resolver = createResolver(bp);
  const byId = new Map(bp.stations.map((s) => [s.id, s]));
  let status: SessionStatus = 'playing';
  let remainingMs = durationMs;
  let elapsedMs = 0;

  return {
    getState: () => ({ status, remainingMs, elapsedMs }),
    tick(deltaMs) {
      if (status !== 'playing') return;
      elapsedMs += deltaMs;
      remainingMs = Math.max(0, remainingMs - deltaMs);
      if (remainingMs === 0) status = 'failed';
    },
    isUnlocked: (id) => resolver.isUnlocked(id),
    solve(id, produced) {
      if (status !== 'playing') return;
      const station = byId.get(id);
      if (!station || !resolver.isUnlocked(id) || resolver.isSolved(id)) return;
      resolver.solve(id, produced);
      hooks.recordSolved?.({ stationId: id, skill: station.skill });
    },
    submitFinal() {
      if (status !== 'playing') return false;
      if (resolver.isComplete()) {
        status = 'escaped';
        return true;
      }
      return false;
    },
  };
}
