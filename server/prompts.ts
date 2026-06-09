// Role prompts for the four Claude endpoints. Each returns `{ system, user }`
// for callClaude(). The blueprint and judge prompts force JSON-only output that
// matches the client's Blueprint / JudgeResponse shapes; the client still runs
// validateBlueprint() over anything Claude returns, so these prompts only
// propose — they never govern correctness.

export interface RolePrompt {
  system: string;
  user: string;
}

// Mirrors src/escape/blueprint/types.ts + src/types.ts (kept in sync by hand).
const SKILLS = [
  'cipher',
  'anagram',
  'pattern',
  'logic',
  'math',
  'spatial',
  'observation',
  'combination',
] as const;

// ---------------------------------------------------------------------------
// narrate — returns { intro, win, lose }
// ---------------------------------------------------------------------------
export function narratePrompt(theme: string): RolePrompt {
  return {
    system:
      'You write terse, atmospheric flavor text for an escape-room game. ' +
      'Respond with ONLY a single JSON object and no other text, code fences, or commentary. ' +
      'The object must have exactly these string fields: "intro" (1-3 sentences setting the ' +
      'scene as the player is locked in), "win" (1 sentence on escaping), and "lose" ' +
      '(1 sentence on the timer running out). Keep each field under 280 characters. ' +
      'Do not mention puzzle answers or mechanics.',
    user: `Theme: ${theme || 'detective-study'}. Write the intro, win, and lose copy.`,
  };
}

// ---------------------------------------------------------------------------
// hint — returns plain text (the proxy wraps it as { hint })
// ---------------------------------------------------------------------------
export interface HintPromptInput {
  skill: string;
  prompt: string;
  hint?: string;
  explanation?: string;
  tier?: 1 | 2 | 3;
}

export function hintPrompt(body: HintPromptInput): RolePrompt {
  const tier = body.tier ?? 1;
  const tierGuidance =
    tier <= 1
      ? 'Tier 1: a gentle nudge. Point at what kind of puzzle this is and what to notice. Do NOT reveal the method or the answer.'
      : tier === 2
        ? 'Tier 2: a stronger hint. Suggest the technique or first concrete step, but still do not give the final answer.'
        : 'Tier 3: walk through the method step by step. You may fully explain how to crack it, but never just state the answer outright.';

  return {
    system:
      'You are a helpful escape-room hint-giver. Respond with ONLY the hint text — ' +
      'a few sentences of plain prose, no JSON, no preamble, no quotes. Escalate the level of ' +
      `help based on the requested tier. ${tierGuidance}`,
    user: [
      `Skill: ${body.skill}`,
      `Puzzle prompt: ${body.prompt}`,
      body.hint ? `Author hint: ${body.hint}` : null,
      body.explanation ? `Author method: ${body.explanation}` : null,
      `Requested tier: ${tier}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

// ---------------------------------------------------------------------------
// blueprint — returns a Blueprint JSON object (proxy wraps it as { blueprint })
// ---------------------------------------------------------------------------
export interface BlueprintPromptInput {
  seed: number;
  theme: string;
}

export function blueprintPrompt(body: BlueprintPromptInput): RolePrompt {
  return {
    system:
      'You design escape-room puzzle chains. Respond with ONLY a single JSON object matching ' +
      'this exact TypeScript shape and nothing else (no prose, no code fences):\n' +
      '\n' +
      '{\n' +
      '  "theme": string,\n' +
      '  "seed": number,\n' +
      '  "stations": Array<{\n' +
      '    "id": string,\n' +
      `    "skill": one of ${JSON.stringify(SKILLS)},\n` +
      '    "difficulty": integer 1..5,\n' +
      '    "anchor": one of "desk" | "bookshelf" | "safe",\n' +
      '    "presenter": "overlay" | "diegetic",\n' +
      '    "produces": string[],  // token names this station yields when solved\n' +
      '    "consumes": string[],  // token names required before it is attemptable\n' +
      '    "narrativeKey": string\n' +
      '  }>,\n' +
      '  "finalLock": { "anchor": "door", "consumes": string[] }\n' +
      '}\n' +
      '\n' +
      'Hard rules (the room must be solvable):\n' +
      '- Exactly three stations, each on a distinct anchor: one on "desk", one on "bookshelf", ' +
      'one on "safe". Anchors must be unique.\n' +
      '- The safe station MUST use skill "combination" and presenter "diegetic". The desk and ' +
      'bookshelf stations use presenter "overlay".\n' +
      '- Tokens must chain: every token in a station\'s "consumes" must be produced by an EARLIER ' +
      'station. The first station consumes nothing. The "finalLock" consumes a token produced by ' +
      'the last station (it must consume at least one token).\n' +
      '- "difficulty" must never decrease from one station to the next (non-decreasing 1..5).\n' +
      '- Order the stations array so it reads desk, then bookshelf, then safe.',
    user: `Generate a "${body.theme || 'detective-study'}" room blueprint. Use seed ${body.seed} as the "seed" field.`,
  };
}

// ---------------------------------------------------------------------------
// judge — returns { score, accept, reasons }
// ---------------------------------------------------------------------------
export interface JudgePromptInput {
  blueprint: unknown;
}

export function judgePrompt(body: JudgePromptInput): RolePrompt {
  return {
    system:
      'You are a taste judge for escape-room blueprints. Assess whether the chain is coherent, ' +
      'thematically consistent, and fun — assume mechanical solvability is already verified ' +
      'elsewhere, so focus on cohesion and pacing. Respond with ONLY a single JSON object and ' +
      'nothing else:\n' +
      '{ "score": number 0..1, "accept": boolean, "reasons": string[] }\n' +
      'Set "accept" to true only when the blueprint is good enough to ship. List concrete ' +
      'reasons (1-4 short strings).',
    user: `Judge this blueprint:\n${JSON.stringify(body.blueprint, null, 2)}`,
  };
}
