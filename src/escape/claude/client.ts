import type {
  BlueprintRequest,
  HintRequest,
  HintResponse,
  JudgeRequest,
  JudgeResponse,
  NarrativeResponse,
} from './types';
import type { Blueprint } from '../blueprint/types';

export interface ClaudeClient {
  available: () => Promise<boolean>;
  generateBlueprint: (req: BlueprintRequest) => Promise<Blueprint | null>;
  judge: (req: JudgeRequest) => Promise<JudgeResponse | null>;
  narrate: (theme: string) => Promise<NarrativeResponse | null>;
  hint: (req: HintRequest) => Promise<HintResponse | null>;
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function createHttpClient(baseUrl = '/claude'): ClaudeClient {
  return {
    async available() {
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (!res.ok) return false;
        const j = (await res.json()) as { ok?: boolean };
        return j.ok === true;
      } catch {
        return false;
      }
    },
    async generateBlueprint(req) {
      const r = await postJson<{ blueprint: Blueprint }>(`${baseUrl}/blueprint`, req);
      return r?.blueprint ?? null;
    },
    judge: (req) => postJson<JudgeResponse>(`${baseUrl}/judge`, req),
    narrate: (theme) => postJson<NarrativeResponse>(`${baseUrl}/narrate`, { theme }),
    hint: (req) => postJson<HintResponse>(`${baseUrl}/hint`, req),
  };
}
