import type { Blueprint, Token } from './types';

export interface Resolver {
  isUnlocked: (stationId: string) => boolean;
  isSolved: (stationId: string) => boolean;
  solve: (stationId: string, produced: Record<Token, string>) => void;
  tokenValue: (token: Token) => string | undefined;
  isComplete: () => boolean;
}

export function createResolver(bp: Blueprint): Resolver {
  const solved = new Set<string>();
  const tokens = new Map<Token, string>();
  const byId = new Map(bp.stations.map((s) => [s.id, s]));

  const isUnlocked = (id: string): boolean => {
    const s = byId.get(id);
    if (!s) return false;
    return s.consumes.every((c) => tokens.has(c));
  };

  return {
    isUnlocked,
    isSolved: (id) => solved.has(id),
    tokenValue: (t) => tokens.get(t),
    solve(id, produced) {
      if (!isUnlocked(id) || solved.has(id)) return;
      solved.add(id);
      for (const [k, v] of Object.entries(produced)) tokens.set(k, v);
    },
    isComplete: () => bp.finalLock.consumes.every((c) => tokens.has(c)),
  };
}
