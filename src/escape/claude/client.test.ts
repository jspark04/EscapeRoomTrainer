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
