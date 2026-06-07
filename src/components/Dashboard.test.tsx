import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { statsStore } from '../stats/sharedStore';

describe('Dashboard', () => {
  beforeEach(() => localStorage.clear());

  // Regression guard: Train/Warm-Up record through the shared statsStore, and the
  // Dashboard must reflect those attempts within the same page session. A bug where
  // the Dashboard held its own StatsStore instance would show stale (zeroed) stats.
  it('reflects an attempt recorded through the shared store', () => {
    statsStore.recordAttempt({ skill: 'cipher', correct: true, timeMs: 1000, difficulty: 1 });

    render(<Dashboard onExit={() => {}} />);

    // The cipher card now shows 100% accuracy; the other (untouched) skills show 0%.
    expect(screen.getByText('Ciphers & Codes')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
