# 3D Escape Room — Phase 3 Implementation Plan (Claude Layer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an optional, gracefully-degrading Claude layer to the escape room — AI narrative, adaptive hints, blueprint generation, and a taste-judge cohesion pass — running through a local credential-holding proxy, while the app remains fully playable, offline, and free when Claude is absent.

**Architecture:** All robust logic (orchestration, validation-gating, fallback, canned offline content) lives client-side in `src/escape/claude/` and is unit-tested with a **mocked** Claude (CI never spends quota). The browser calls a thin local **Hono proxy** at `/claude/*` (Vite dev-proxied) that holds the credential and forwards prompts to Claude via a provider abstraction (subscription OAuth token primary, Anthropic API key fallback). If the proxy is unreachable or returns junk, the client falls back to the deterministic `generateBlueprint` + canned narrative/hints. **`checkAnswer`/`validateBlueprint` always govern correctness; the LLM only proposes.**

**Tech Stack:** Client: Vite + React 19 + TS, Vitest. Proxy: Node + Hono + the Claude Agent SDK / Anthropic SDK (separate `server/` package, not in the client build or CI gate).

**Spec:** `docs/superpowers/specs/2026-06-08-3d-escape-room-design.md` (Subsystem 4).

---

### Task 1: Claude request/response types + canned offline fallbacks

**Files:**
- Create: `src/escape/claude/types.ts`, `src/escape/claude/fallbacks.ts`, `src/escape/claude/fallbacks.test.ts`

- [ ] **Step 1: Write `src/escape/claude/types.ts`**

```ts
import type { Blueprint } from '../blueprint/types';

export interface NarrativeResponse {
  intro: string;
  win: string;
  lose: string;
}

export type HintTier = 1 | 2 | 3;

export interface HintRequest {
  skill: string;
  prompt: string;
  hint?: string;
  explanation?: string;
  tier: HintTier;
}
export interface HintResponse {
  hint: string;
}

export interface BlueprintRequest {
  seed: number;
  theme: string;
}
export interface BlueprintResponse {
  blueprint: Blueprint;
}

export interface JudgeRequest {
  blueprint: Blueprint;
}
export interface JudgeResponse {
  score: number; // 0..1
  accept: boolean;
  reasons: string[];
}
```

- [ ] **Step 2: Write the failing test `src/escape/claude/fallbacks.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cannedNarrative, cannedHint } from './fallbacks';

describe('cannedNarrative', () => {
  it('returns non-empty intro/win/lose for the detective study', () => {
    const n = cannedNarrative('detective-study');
    expect(n.intro.length).toBeGreaterThan(0);
    expect(n.win.length).toBeGreaterThan(0);
    expect(n.lose.length).toBeGreaterThan(0);
  });
  it('falls back to generic copy for an unknown theme', () => {
    const n = cannedNarrative('mystery-cabin');
    expect(n.intro.length).toBeGreaterThan(0);
  });
});

describe('cannedHint', () => {
  it('tier 1 is a generic nudge that does not leak the answer', () => {
    const h = cannedHint({ skill: 'cipher', prompt: 'Decode XYZ', hint: 'shift 3', explanation: 'shift each letter back 3', tier: 1 });
    expect(h.length).toBeGreaterThan(0);
    expect(h.toLowerCase()).not.toContain('shift each letter back 3');
  });
  it('tier 2 surfaces the puzzle hint when present', () => {
    expect(cannedHint({ skill: 'cipher', prompt: 'x', hint: 'shift 3', tier: 2 })).toContain('shift 3');
  });
  it('tier 3 surfaces the explanation (method) when present', () => {
    expect(cannedHint({ skill: 'cipher', prompt: 'x', explanation: 'shift each letter back 3', tier: 3 })).toContain('shift each letter back 3');
  });
  it('never throws when hint/explanation are missing', () => {
    expect(() => cannedHint({ skill: 'logic', prompt: 'x', tier: 3 })).not.toThrow();
    expect(cannedHint({ skill: 'logic', prompt: 'x', tier: 3 }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/escape/claude/fallbacks.test.ts`
Expected: FAIL — cannot find module './fallbacks'.

- [ ] **Step 4: Write `src/escape/claude/fallbacks.ts`**

```ts
import type { HintRequest, HintResponse, NarrativeResponse } from './types';

const NARRATIVES: Record<string, NarrativeResponse> = {
  'detective-study': {
    intro:
      'The door clicks shut behind you. A detective’s study, thick with pipe smoke and secrets. ' +
      'Somewhere here is the way out — work the clues before your time runs out.',
    win: 'The lock yields. You slip out into the night, case cracked. 🔓',
    lose: 'The clock wins this time. The study keeps its secrets — for now.',
  },
};

const GENERIC: NarrativeResponse = {
  intro: 'You are locked in. Search the room, solve the clues, and find your way out before time runs out.',
  win: 'The final lock opens. You escaped! 🔓',
  lose: "Time’s up — the room keeps you a little longer.",
};

export function cannedNarrative(theme: string): NarrativeResponse {
  return NARRATIVES[theme] ?? GENERIC;
}

// Escalating, non-spoiling hints derived from the puzzle's own hint/explanation.
export function cannedHint(req: HintRequest): HintResponse {
  if (req.tier <= 1) {
    return { hint: `Look closely at the ${req.skill} clue — what kind of puzzle is it, and what stands out?` };
  }
  if (req.tier === 2) {
    return { hint: req.hint ?? 'Focus on the most constrained part first and work outward.' };
  }
  return { hint: req.explanation ?? req.hint ?? 'Walk through the method one careful step at a time.' };
}
```

Wait — `cannedHint` returns `HintResponse` but the tests call it as a string. Make the tests and impl agree: the impl returns `HintResponse`; update the test assertions to read `.hint`. (When implementing, write the test to assert on `cannedHint(...).hint`.)

> Implementer: reconcile the return type — `cannedHint` returns `HintResponse`; in the test, assert against `cannedHint(...).hint`. Keep everything else as written.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/escape/claude/fallbacks.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/escape/claude/types.ts src/escape/claude/fallbacks.ts src/escape/claude/fallbacks.test.ts
git commit -m "feat(escape/claude): request types + canned offline narrative & tiered hints"
```

---

### Task 2: HTTP Claude client (feature-detect + graceful failure)

**Files:**
- Create: `src/escape/claude/client.ts`, `src/escape/claude/client.test.ts`

A thin fetch wrapper to the proxy. **Every method returns `null` on any failure** (network error, non-200, bad JSON) so callers fall back. `available()` probes once and caches.

- [ ] **Step 1: Write the failing test `src/escape/claude/client.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient } from './client';

beforeEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('createHttpClient', () => {
  it('available() is true when the proxy health check returns ok', async () => {
    stubFetch(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = createHttpClient('/claude');
    expect(await c.available()).toBe(true);
  });

  it('available() is false when the proxy is unreachable', async () => {
    stubFetch(() => { throw new Error('ECONNREFUSED'); });
    const c = createHttpClient('/claude');
    expect(await c.available()).toBe(false);
  });

  it('generateBlueprint returns null on a non-200', async () => {
    stubFetch(() => new Response('nope', { status: 500 }));
    const c = createHttpClient('/claude');
    expect(await c.generateBlueprint({ seed: 1, theme: 'detective-study' })).toBeNull();
  });

  it('hint returns the parsed response on 200', async () => {
    stubFetch(() => new Response(JSON.stringify({ hint: 'try ROT13' }), { status: 200 }));
    const c = createHttpClient('/claude');
    expect(await c.hint({ skill: 'cipher', prompt: 'x', tier: 1 })).toEqual({ hint: 'try ROT13' });
  });

  it('returns null on malformed JSON instead of throwing', async () => {
    stubFetch(() => new Response('{not json', { status: 200 }));
    const c = createHttpClient('/claude');
    expect(await c.hint({ skill: 'cipher', prompt: 'x', tier: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/claude/client.test.ts`
Expected: FAIL — cannot find module './client'.

- [ ] **Step 3: Write `src/escape/claude/client.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/claude/client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/claude/client.ts src/escape/claude/client.test.ts
git commit -m "feat(escape/claude): http client with graceful null-on-failure"
```

---

### Task 3: Room builder orchestration (generate → validate → judge → fallback)

**Files:**
- Create: `src/escape/claude/roomBuilder.ts`, `src/escape/claude/roomBuilder.test.ts`

The brain: ask Claude for a blueprint, **validate it**, optionally **judge** it, retry a capped number of times, and **fall back to the deterministic generator** on any failure. Pure orchestration over an injected `ClaudeClient`, so it's fully testable with mocks.

- [ ] **Step 1: Write the failing test `src/escape/claude/roomBuilder.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildRoom } from './roomBuilder';
import { generateBlueprint } from '../blueprint/generate';
import type { ClaudeClient } from './client';
import type { Blueprint } from '../blueprint/types';

const valid = (seed: number): Blueprint => generateBlueprint(seed);
const invalid: Blueprint = {
  theme: 'x', seed: 0,
  stations: [{ id: 'a', skill: 'cipher', difficulty: 2, anchor: 'desk', presenter: 'overlay', produces: ['t'], consumes: ['missing'], narrativeKey: 'a' }],
  finalLock: { anchor: 'door', consumes: ['t'] },
};

function mockClient(over: Partial<ClaudeClient>): ClaudeClient {
  return {
    available: async () => true,
    generateBlueprint: async () => null,
    judge: async () => ({ score: 1, accept: true, reasons: [] }),
    narrate: async () => null,
    hint: async () => null,
    ...over,
  };
}

describe('buildRoom', () => {
  it('falls back to deterministic when Claude is unavailable', async () => {
    const r = await buildRoom(7, mockClient({ available: async () => false }));
    expect(r.source).toBe('fallback');
    expect(JSON.stringify(r.blueprint)).toBe(JSON.stringify(generateBlueprint(7)));
  });

  it('uses a valid, accepted Claude blueprint', async () => {
    const r = await buildRoom(7, mockClient({ generateBlueprint: async () => valid(123) }));
    expect(r.source).toBe('claude');
    expect(JSON.stringify(r.blueprint)).toBe(JSON.stringify(valid(123)));
  });

  it('rejects an invalid Claude blueprint and falls back', async () => {
    const r = await buildRoom(7, mockClient({ generateBlueprint: async () => invalid }));
    expect(r.source).toBe('fallback');
  });

  it('falls back when the judge rejects every attempt', async () => {
    const r = await buildRoom(7, mockClient({
      generateBlueprint: async () => valid(5),
      judge: async () => ({ score: 0.1, accept: false, reasons: ['incoherent'] }),
    }));
    expect(r.source).toBe('fallback');
  });

  it('never throws if a Claude call rejects', async () => {
    const r = await buildRoom(7, mockClient({ generateBlueprint: async () => { throw new Error('boom'); } }));
    expect(r.source).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/escape/claude/roomBuilder.test.ts`
Expected: FAIL — cannot find module './roomBuilder'.

- [ ] **Step 3: Write `src/escape/claude/roomBuilder.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/escape/claude/roomBuilder.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/escape/claude/roomBuilder.ts src/escape/claude/roomBuilder.test.ts
git commit -m "feat(escape/claude): room builder orchestration with validate+judge+fallback"
```

---

### Task 4: Local Hono proxy (live-activation piece)

**Files:**
- Create: `server/package.json`, `server/index.ts`, `server/callClaude.ts`, `server/prompts.ts`, `server/README.md`
- Modify: `vite.config.ts` (dev proxy for `/claude`)

This is the credential-holding proxy. It is **not part of the client build or CI gate** (it's the live-only piece, activated by the user's token). Keep it thin and correct.

- [ ] **Step 1: Confirm current SDK auth APIs**

Use the **context7** MCP (and/or the `claude-api` skill) to confirm, at implementation time:
- How the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) is invoked for a single structured completion and how it authenticates with a **subscription OAuth token** (`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`).
- How the **Anthropic SDK** (`@anthropic-ai/sdk`) is used with `ANTHROPIC_API_KEY`.
Adjust `callClaude.ts` to the confirmed APIs.

- [ ] **Step 2: Write `server/package.json`**

```json
{
  "name": "escape-claude-proxy",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch index.ts",
    "start": "tsx index.ts"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  }
}
```
(Add the Claude SDK dependency you confirmed in Step 1 — `@anthropic-ai/sdk` and/or `@anthropic-ai/claude-agent-sdk` — and `tsx` as a dev dep. Install inside `server/` with `cd server && npm install`.)

- [ ] **Step 3: Write `server/callClaude.ts`** (provider abstraction)

```ts
// Provider abstraction: prefer the subscription OAuth token (Claude Agent SDK), else an
// Anthropic API key. Returns the model's text for a given system+user prompt.
// NOTE: confirm exact SDK calls via context7 (Step 1) and adjust as needed.
export interface CallOptions { system: string; user: string; maxTokens?: number; }

export async function callClaude({ system, user, maxTokens = 1500 }: CallOptions): Promise<string> {
  const oauth = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (oauth) {
    // Subscription path via the Claude Agent SDK (verify call shape via context7).
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    let out = '';
    for await (const msg of query({
      prompt: `${system}\n\n${user}`,
      options: { permissionMode: 'bypassPermissions' },
    })) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) if (block.type === 'text') out += block.text;
      }
    }
    return out;
  }

  if (apiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  }

  throw new Error('No Claude credential: set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY');
}
```

- [ ] **Step 4: Write `server/prompts.ts`** (role prompts) and `server/index.ts` (Hono app)

`prompts.ts`: export functions returning `{system, user}` for narrate, hint, blueprint, judge. The blueprint prompt must instruct Claude to return ONLY JSON matching the `Blueprint` shape (stations with skills from the known set, anchors desk/bookshelf/safe, safe = combination/diegetic, a final lock). The judge prompt asks for `{score, accept, reasons}` JSON.

`server/index.ts`:
```ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { callClaude } from './callClaude';
import { narratePrompt, hintPrompt, blueprintPrompt, judgePrompt } from './prompts';

const app = new Hono();
app.get('/claude/health', (c) => c.json({ ok: true }));

function parseJson<T>(text: string): T | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

app.post('/claude/narrate', async (c) => {
  const { theme } = await c.req.json();
  const out = await callClaude(narratePrompt(theme));
  return c.json(parseJson(out) ?? { error: 'parse' }, parseJson(out) ? 200 : 502);
});
app.post('/claude/hint', async (c) => {
  const body = await c.req.json();
  const out = await callClaude(hintPrompt(body));
  return c.json({ hint: out.trim() });
});
app.post('/claude/blueprint', async (c) => {
  const body = await c.req.json();
  const out = await callClaude(blueprintPrompt(body));
  const blueprint = parseJson(out);
  return blueprint ? c.json({ blueprint }) : c.json({ error: 'parse' }, 502);
});
app.post('/claude/judge', async (c) => {
  const body = await c.req.json();
  const out = await callClaude(judgePrompt(body));
  return c.json(parseJson(out) ?? { score: 0, accept: false, reasons: ['parse error'] });
});

serve({ fetch: app.fetch, port: 8787 });
console.log('Claude proxy on http://localhost:8787');
```

- [ ] **Step 5: Add the Vite dev proxy in `vite.config.ts`**

Add to the `defineConfig` object a `server.proxy` so the client's `/claude/*` reaches the Hono proxy in dev:
```ts
server: {
  proxy: {
    '/claude': 'http://localhost:8787',
  },
},
```

- [ ] **Step 6: Write `server/README.md`**

Document: install (`cd server && npm install`), set a credential (`export CLAUDE_CODE_OAUTH_TOKEN=$(claude setup-token)` for subscription, or `export ANTHROPIC_API_KEY=...`), run (`npm run dev`), and that the app works fully without it (Claude features simply stay off). Note the subscription-OAuth caveat (personal/local use only).

- [ ] **Step 7: Verify the client still builds without the server**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: clean — the `server/` directory must NOT be part of the client tsconfig/build (it lives outside `src/`). Confirm the SPA builds with no reference to server code.

- [ ] **Step 8: Commit**

```bash
git add server/ vite.config.ts
git commit -m "feat(escape/claude): local Hono proxy (subscription OAuth | API key) + dev proxy"
```

---

### Task 5: Wire the Claude layer into EscapeRoom (async build + narrative + hints), graceful offline

**Files:**
- Modify: `src/escape/EscapeRoom.tsx`, `src/escape/ui/EscapeHUD.tsx` (hint button + intro)

- [ ] **Step 1: Read `src/escape/EscapeRoom.tsx`** (current Phase-2 version) to ground the edits.

- [ ] **Step 2: Make the blueprint async via `buildRoom`**

- Create a module-level client: `const claude = createHttpClient('/claude');` (import from `./claude/client`).
- Replace the synchronous `const blueprint = useMemo(() => generateBlueprint(...))` with async build state:
```tsx
const [built, setBuilt] = useState<BuiltRoom | null>(null);
useEffect(() => {
  let cancelled = false;
  setBuilt(null);
  buildRoom(SEED_BASE + seedNonce, claude).then((r) => { if (!cancelled) setBuilt(r); });
  return () => { cancelled = true; };
}, [seedNonce]);
```
- While `built === null`, render a simple "Entering the room…" splash (no Canvas yet). Once built, derive `blueprint = built.blueprint` and proceed exactly as Phase 2 (puzzles/session/etc. now key off `built`). Guard the rest of the component so hooks order stays stable (compute the splash branch in the returned JSX, not by early-returning before hooks — keep all hooks above the conditional render).
- Fetch narrative once built: `claude.narrate(theme)` with fallback to `cannedNarrative('detective-study')`; show `intro` briefly / on the start, and use `win`/`lose` text in the HUD end screens.

- [ ] **Step 3: Add an adaptive Hint button**

In the HUD (or as an overlay control while a puzzle modal is open), add a "Hint" button that, for the active station, calls `claude.hint({skill, prompt, hint, explanation, tier})` and falls back to `cannedHint(...)`. Escalate the tier on repeated presses (1→2→3). Wire it into the `OverlayPresenter`/`DialLockPresenter` host so the hint shows alongside the puzzle. (Keep it optional and unobtrusive.)

- [ ] **Step 4: Verify (offline path)**

Run: `npx tsc --noEmit && npm run build && npx vitest run` (all green).
Because no proxy runs in dev/CI, `claude.available()` resolves false and the room builds from the deterministic generator with canned narrative/hints — confirm this is the behavior (the app is fully playable with no server). The controller will browser-verify the mount + offline play.

- [ ] **Step 5: Commit**

```bash
git add src/escape/EscapeRoom.tsx src/escape/ui/EscapeHUD.tsx
git commit -m "feat(escape): wire Claude layer (async build, narrative, hints) with offline fallback"
```

---

## Self-Review Notes

**Spec coverage (Phase 3):** local proxy + auth (subscription OAuth primary / API key fallback) → Task 4; four roles — blueprint generation validated by `validateBlueprint` + retries + fallback → Tasks 3,4; taste-judge generate→validate→judge loop → Task 3 (`buildRoom`) + Task 4 (`/judge`); narrative/flavor → Tasks 1,4,5; adaptive hints → Tasks 1,4,5; graceful degradation (no proxy → deterministic + canned, always playable offline/free) → Tasks 2,3,5; **Claude mocked in CI, live separate** → all client tests use mocked fetch/clients; the server is outside the build/CI gate. ✓

**Type consistency:** `ClaudeClient` (Task 2) is consumed by `buildRoom` (Task 3) and `EscapeRoom` (Task 5). `Blueprint`/`validateBlueprint`/`generateBlueprint` reused from Phases 1–2 unchanged. The proxy returns `{blueprint}` which the client unwraps to `Blueprint | null`. `HintRequest`/`NarrativeResponse` shared by client, fallbacks, server.

**Determinism & safety:** the LLM only proposes; `validateBlueprint` gates every generated blueprint and `checkAnswer` still governs puzzle correctness. The app never blocks core play on a Claude call (fallback is synchronous-deterministic).

**Note:** Live Claude activation requires the user to run `server/` with a credential — that is a config step (documented in `server/README.md`), intentionally not automated. CI and the controller verify only the offline/mocked behavior.
