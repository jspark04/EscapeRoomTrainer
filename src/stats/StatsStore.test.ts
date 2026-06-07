import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStore } from './StatsStore';

beforeEach(() => localStorage.clear());

describe('StatsStore', () => {
  it('returns zeroed stats for an unseen skill', () => {
    const s = new StatsStore();
    const st = s.getSkillStats('cipher');
    expect(st.attempts).toBe(0);
    expect(st.accuracy).toBe(0);
    expect(st.bestStreak).toBe(0);
  });

  it('records attempts and computes accuracy and streaks', () => {
    const s = new StatsStore();
    s.recordAttempt({ skill: 'cipher', correct: true, timeMs: 1000, difficulty: 1 });
    s.recordAttempt({ skill: 'cipher', correct: true, timeMs: 3000, difficulty: 1 });
    s.recordAttempt({ skill: 'cipher', correct: false, timeMs: 2000, difficulty: 1 });
    const st = s.getSkillStats('cipher');
    expect(st.attempts).toBe(3);
    expect(st.accuracy).toBeCloseTo(2 / 3);
    expect(st.avgTimeMs).toBe(2000);
    expect(st.bestStreak).toBe(2);
    expect(st.currentStreak).toBe(0);
  });

  it('persists across instances via localStorage', () => {
    const s1 = new StatsStore();
    s1.recordAttempt({ skill: 'logic', correct: true, timeMs: 500, difficulty: 2 });
    const s2 = new StatsStore();
    expect(s2.getSkillStats('logic').attempts).toBe(1);
  });

  it('survives corrupt localStorage', () => {
    localStorage.setItem('ert:v1', '{not json');
    const s = new StatsStore();
    expect(s.getSkillStats('pattern').attempts).toBe(0);
  });

  it('round-trips settings', () => {
    const s = new StatsStore();
    s.setSettings({ warmUpSeconds: 300, sound: false });
    expect(new StatsStore().getSettings().warmUpSeconds).toBe(300);
  });
});
