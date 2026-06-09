import type { Blueprint } from '../blueprint/types';
import { generateBlueprint } from '../blueprint/generate';
import { validateBlueprint } from '../blueprint/validate';
import type { ClaudeClient } from './client';

export interface BuiltRoom {
  blueprint: Blueprint;
  source: 'claude' | 'fallback';
}

const MAX_ATTEMPTS = 3;
const THEME = 'detective-study';

/**
 * Try to build a Claude-generated room: generate → validate → judge, retrying up to
 * MAX_ATTEMPTS. Any failure (unavailable, invalid, judge-rejected, thrown) falls back to
 * the deterministic generator. The LLM only proposes; validateBlueprint disposes.
 */
export async function buildRoom(seed: number, client: ClaudeClient): Promise<BuiltRoom> {
  try {
    if (await client.available()) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const bp = await client.generateBlueprint({ seed: seed + attempt, theme: THEME });
        if (!bp || !validateBlueprint(bp).ok) continue;
        const verdict = await client.judge({ blueprint: bp });
        if (!verdict || verdict.accept) return { blueprint: bp, source: 'claude' };
        // judged but rejected → try again
      }
    }
  } catch {
    // fall through to deterministic
  }
  return { blueprint: generateBlueprint(seed), source: 'fallback' };
}
