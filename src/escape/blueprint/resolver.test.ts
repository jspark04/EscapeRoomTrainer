import { describe, it, expect } from 'vitest';
import { createResolver } from './resolver';
import { studyBlueprint } from './studyBlueprint';

describe('createResolver', () => {
  it('only the first station (no consumes) is initially unlocked', () => {
    const r = createResolver(studyBlueprint);
    expect(r.isUnlocked('desk')).toBe(true);
    expect(r.isUnlocked('bookshelf')).toBe(false);
    expect(r.isUnlocked('safe')).toBe(false);
    expect(r.isComplete()).toBe(false);
  });

  it('solving a station unlocks the next and stores its tokens', () => {
    const r = createResolver(studyBlueprint);
    r.solve('desk', { deskClue: 'OWL' });
    expect(r.isUnlocked('bookshelf')).toBe(true);
    expect(r.tokenValue('deskClue')).toBe('OWL');
    r.solve('bookshelf', { safeDigitsA: '47' });
    expect(r.isUnlocked('safe')).toBe(true);
    r.solve('safe', { safeDigitsB: '13' });
    expect(r.isComplete()).toBe(true);
  });

  it('ignores solving a locked station', () => {
    const r = createResolver(studyBlueprint);
    r.solve('safe', { safeDigitsB: '13' });
    expect(r.isComplete()).toBe(false);
    expect(r.tokenValue('safeDigitsB')).toBeUndefined();
  });
});
