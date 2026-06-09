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
