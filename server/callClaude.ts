// Provider abstraction for the Claude layer.
//
// Order of preference:
//   1. Subscription OAuth token (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`)
//      routed through the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).
//   2. Anthropic API key (ANTHROPIC_API_KEY) routed through the Anthropic SDK
//      (`@anthropic-ai/sdk`).
//
// Both paths take a system + user prompt and return the model's text. SDKs are
// dynamically imported so the module loads even when only one is installed.
//
// API shapes confirmed via context7 + the claude-api skill (2026-06-08):
//   - Agent SDK: `query({ prompt, options })` yields an async generator of SDK
//     messages. Assistant text lives on `msg.type === 'assistant'` →
//     `msg.message.content[]` where the block has a `text` field. The SDK reads
//     CLAUDE_CODE_OAUTH_TOKEN from the environment for subscription auth. We run
//     it as a pure single-shot completion: no tools, no filesystem, no MCP.
//   - Anthropic SDK: `new Anthropic({ apiKey }).messages.create({ model,
//     max_tokens, system, messages })`; current model id is `claude-opus-4-8`.
//     Text blocks are `content[].type === 'text'`.

export interface CallOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

// Current Anthropic model id (verified 2026-06-08). The Agent/subscription path
// does not take a model id here — it uses the subscription's default model.
const ANTHROPIC_MODEL = 'claude-opus-4-8';

export async function callClaude({ system, user, maxTokens = 1500 }: CallOptions): Promise<string> {
  const oauth = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1. Subscription path via the Claude Agent SDK.
  if (oauth) {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    let out = '';
    for await (const msg of query({
      // The Agent SDK has no separate system field for a one-shot query, so we
      // fold the role prompt into the systemPrompt option and send the task as
      // the prompt. We disable all tools so this behaves as a plain completion.
      prompt: user,
      options: {
        systemPrompt: system,
        allowedTools: [],
        // No filesystem/project settings — keep this a stateless text turn.
        settingSources: [],
        maxTurns: 1,
        env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: oauth },
      },
    })) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text') out += block.text;
        }
      }
    }
    return out;
  }

  // 2. API-key path via the Anthropic SDK.
  if (apiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  throw new Error('No Claude credential: set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY');
}
