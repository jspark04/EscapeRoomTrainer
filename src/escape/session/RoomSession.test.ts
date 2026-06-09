import { describe, it, expect, vi } from 'vitest';
import { createSession } from './RoomSession';
import { studyBlueprint } from '../blueprint/studyBlueprint';

describe('RoomSession', () => {
  it('starts playing with the full duration remaining', () => {
    const s = createSession(studyBlueprint, 120_000);
    expect(s.getState().status).toBe('playing');
    expect(s.getState().remainingMs).toBe(120_000);
  });

  it('counts down and fails at zero', () => {
    const s = createSession(studyBlueprint, 1_000);
    s.tick(600);
    expect(s.getState().remainingMs).toBe(400);
    s.tick(500);
    expect(s.getState().status).toBe('failed');
    expect(s.getState().remainingMs).toBe(0);
  });

  it('escapes when the final lock is satisfied and reports elapsed time', () => {
    const s = createSession(studyBlueprint, 120_000);
    s.solve('desk', { deskClue: 'OWL' });
    s.solve('bookshelf', { safeDigitsA: '47' });
    s.tick(5_000);
    s.solve('safe', { safeDigitsB: '13' });
    s.submitFinal('4713'); // door consumes safeDigitsB; final code accepted by the door logic
    expect(s.getState().status).toBe('escaped');
    expect(s.getState().elapsedMs).toBe(5_000);
  });

  it('records each solved station to the provided stats sink', () => {
    const record = vi.fn();
    const s = createSession(studyBlueprint, 120_000, { recordSolved: record });
    s.solve('desk', { deskClue: 'OWL' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ skill: 'cipher' }));
  });
});
