# Escape Room — local Claude proxy

A thin [Hono](https://hono.dev) server that holds your Claude credential and
forwards prompts to Claude for the escape room's optional AI layer (narrative,
adaptive hints, blueprint generation, and a taste-judge cohesion pass).

**The game is fully playable without this server.** When the proxy is not
running, the client's `claude.available()` probe resolves `false` and the room
builds from the deterministic generator with canned narrative and tiered hints —
offline and free. This proxy is the *live-activation* piece: run it with a
credential to turn the Claude features on.

It is intentionally **not** part of the client build or CI gate. It lives in its
own `server/` package with its own `node_modules`, outside `src/`, so the SPA
build (`npm run build`), root type-check (`npx tsc --noEmit`), and tests
(`npx vitest run`) never compile, bundle, or depend on it.

## Endpoints

| Method | Path                | Body                                   | Returns                              |
| ------ | ------------------- | -------------------------------------- | ------------------------------------ |
| GET    | `/claude/health`    | —                                      | `{ ok: true }`                       |
| POST   | `/claude/narrate`   | `{ theme }`                            | `{ intro, win, lose }`               |
| POST   | `/claude/hint`      | `{ skill, prompt, hint?, explanation?, tier }` | `{ hint }`                  |
| POST   | `/claude/blueprint` | `{ seed, theme }`                      | `{ blueprint }` (a `Blueprint`)      |
| POST   | `/claude/judge`     | `{ blueprint }`                        | `{ score, accept, reasons }`         |

The client always re-runs `validateBlueprint` over any returned blueprint and
`checkAnswer` always governs puzzle correctness — the LLM only proposes.

## Install

```bash
cd server
npm install
```

This installs Hono, the Node server adapter, and both Claude SDKs into
`server/node_modules` (gitignored — never committed). The root project does not
depend on any of these.

## Provide a credential

The proxy prefers a **subscription OAuth token** and falls back to an
**Anthropic API key**. Set one of:

```bash
# Option A — subscription (Claude Pro/Max), via the Claude Agent SDK.
# Generates a personal OAuth token from your local Claude login:
export CLAUDE_CODE_OAUTH_TOKEN=$(claude setup-token)

# Option B — Anthropic API key, via the Anthropic SDK.
export ANTHROPIC_API_KEY=sk-ant-...
```

On Windows PowerShell:

```powershell
$env:CLAUDE_CODE_OAUTH_TOKEN = (claude setup-token)
# or
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

If both are set, the subscription OAuth token wins. If neither is set,
`callClaude` throws and the endpoints return 500 — the client treats that the
same as the proxy being absent and falls back.

> **Subscription-OAuth caveat:** `CLAUDE_CODE_OAUTH_TOKEN` is a personal token
> tied to your own Claude subscription, intended for **personal / local use
> only**. Do not deploy this proxy as a shared/public service backed by a
> subscription token. For any shared deployment, use an `ANTHROPIC_API_KEY`.

## Run

```bash
cd server
npm run dev     # tsx watch (auto-reload)
# or
npm start       # tsx, no watch
```

The proxy listens on `http://localhost:8787` (override with `PORT`). In dev,
Vite proxies the client's `/claude/*` requests to it (see the `server.proxy`
block in `vite.config.ts`), so the browser app reaches it with no extra config.

Quick check once it's running:

```bash
curl http://localhost:8787/claude/health   # -> {"ok":true}
```

## Type-check (optional)

The server has its own `tsconfig.json`:

```bash
cd server
npx tsc --noEmit
```

## How auth maps to SDK calls

- **Subscription (`CLAUDE_CODE_OAUTH_TOKEN`):** `server/callClaude.ts` calls
  `query()` from `@anthropic-ai/claude-agent-sdk` as a single-shot, tool-free
  text completion. The Agent SDK reads the OAuth token from the environment.
- **API key (`ANTHROPIC_API_KEY`):** `callClaude.ts` calls
  `client.messages.create()` from `@anthropic-ai/sdk` with model
  `claude-opus-4-8`.
