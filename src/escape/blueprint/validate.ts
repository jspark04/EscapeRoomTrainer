import type { Blueprint } from './types';

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

// Guarantees a blueprint is solvable: every consumed token is produced upstream, the
// chain reaches the final lock, difficulties never decrease, and anchors are unique.
export function validateBlueprint(bp: Blueprint): ValidationResult {
  const violations: string[] = [];
  const producedSoFar = new Set<string>();
  const anchors = new Set<string>();
  let prevDifficulty = 0;

  for (const s of bp.stations) {
    for (const c of s.consumes) {
      if (!producedSoFar.has(c)) {
        violations.push(`station "${s.id}" consumes "${c}" before it is produced`);
      }
    }
    if (s.difficulty < prevDifficulty) {
      violations.push(`station "${s.id}" difficulty ${s.difficulty} is below the prior ${prevDifficulty}`);
    }
    prevDifficulty = s.difficulty;
    if (anchors.has(s.anchor)) violations.push(`duplicate anchor "${s.anchor}"`);
    anchors.add(s.anchor);
    for (const p of s.produces) producedSoFar.add(p);
  }

  for (const c of bp.finalLock.consumes) {
    if (!producedSoFar.has(c)) {
      violations.push(`final lock consumes "${c}" which is never produced`);
    }
  }
  if (bp.finalLock.consumes.length === 0) {
    violations.push('final lock consumes nothing — the room cannot be completed');
  }

  return { ok: violations.length === 0, violations };
}
