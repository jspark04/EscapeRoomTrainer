import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { callClaude } from './callClaude.js';
import { narratePrompt, hintPrompt, blueprintPrompt, judgePrompt } from './prompts.js';

const app = new Hono();

app.get('/claude/health', (c) => c.json({ ok: true }));

// Pull the first balanced-looking JSON object out of a model response and parse
// it. Returns null on anything that isn't valid JSON so callers can fall back.
function parseJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

app.post('/claude/narrate', async (c) => {
  try {
    const { theme } = await c.req.json();
    const out = await callClaude(narratePrompt(theme));
    const parsed = parseJson(out);
    return parsed ? c.json(parsed) : c.json({ error: 'parse' }, 502);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/claude/hint', async (c) => {
  try {
    const body = await c.req.json();
    const out = await callClaude(hintPrompt(body));
    return c.json({ hint: out.trim() });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/claude/blueprint', async (c) => {
  try {
    const body = await c.req.json();
    const out = await callClaude({ ...blueprintPrompt(body), maxTokens: 2500 });
    const blueprint = parseJson(out);
    return blueprint ? c.json({ blueprint }) : c.json({ error: 'parse' }, 502);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/claude/judge', async (c) => {
  try {
    const body = await c.req.json();
    const out = await callClaude(judgePrompt(body));
    return c.json(parseJson(out) ?? { score: 0, accept: false, reasons: ['parse error'] });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port });
console.log(`Claude proxy on http://localhost:${port}`);
