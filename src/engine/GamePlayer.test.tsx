import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GamePlayer } from './GamePlayer';
import { cipherGenerator } from '../games/cipher';
import { mulberry32 } from '../rng';

function fixedPuzzle() {
  return cipherGenerator.generate(1, mulberry32(7));
}

describe('GamePlayer', () => {
  it('reports a correct result when the right answer is submitted', () => {
    const puzzle = fixedPuzzle();
    const onResult = vi.fn();
    render(<GamePlayer nextPuzzle={() => puzzle} onResult={onResult} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: puzzle.solution } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, skill: 'cipher' }));
  });

  it('shows the solution after reveal', () => {
    const puzzle = fixedPuzzle();
    render(<GamePlayer nextPuzzle={() => puzzle} onResult={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText(new RegExp(puzzle.solution, 'i'))).toBeInTheDocument();
  });
});
