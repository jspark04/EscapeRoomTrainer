import type { Skill, Difficulty } from '../types';

export interface SkillStats {
  attempts: number;
  correct: number;
  accuracy: number;       // 0..1
  avgTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

export interface Attempt {
  skill: Skill;
  correct: boolean;
  timeMs: number;
  difficulty: Difficulty;
}

export interface Settings {
  warmUpSeconds: number;
  sound: boolean;
  /** 'adaptive' nudges difficulty from recent accuracy; 'fixed' holds fixedLevel. */
  difficultyMode: 'adaptive' | 'fixed';
  fixedLevel: Difficulty;
}

interface SkillRecord {
  attempts: number;
  correct: number;
  totalTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

interface Persisted {
  skills: Partial<Record<Skill, SkillRecord>>;
  settings: Settings;
}

const KEY = 'ert:v1';
const DEFAULT_SETTINGS: Settings = {
  warmUpSeconds: 420,
  sound: false,
  difficultyMode: 'adaptive',
  fixedLevel: 2,
};

function emptyRecord(): SkillRecord {
  return { attempts: 0, correct: 0, totalTimeMs: 0, bestStreak: 0, currentStreak: 0 };
}

export class StatsStore {
  private data: Persisted;

  constructor() {
    this.data = this.load();
  }

  private load(): Persisted {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { skills: {}, settings: { ...DEFAULT_SETTINGS } };
      const parsed = JSON.parse(raw) as Persisted;
      return {
        skills: parsed.skills ?? {},
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch {
      return { skills: {}, settings: { ...DEFAULT_SETTINGS } };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable/full: keep running in-memory */
    }
  }

  recordAttempt(a: Attempt): void {
    const rec = this.data.skills[a.skill] ?? emptyRecord();
    rec.attempts += 1;
    rec.totalTimeMs += a.timeMs;
    if (a.correct) {
      rec.correct += 1;
      rec.currentStreak += 1;
      rec.bestStreak = Math.max(rec.bestStreak, rec.currentStreak);
    } else {
      rec.currentStreak = 0;
    }
    this.data.skills[a.skill] = rec;
    this.save();
  }

  getSkillStats(skill: Skill): SkillStats {
    const rec = this.data.skills[skill] ?? emptyRecord();
    return {
      attempts: rec.attempts,
      correct: rec.correct,
      accuracy: rec.attempts ? rec.correct / rec.attempts : 0,
      avgTimeMs: rec.attempts ? Math.round(rec.totalTimeMs / rec.attempts) : 0,
      bestStreak: rec.bestStreak,
      currentStreak: rec.currentStreak,
    };
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  setSettings(s: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...s };
    this.save();
  }
}
