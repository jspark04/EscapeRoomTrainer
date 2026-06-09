import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayPresenter } from './OverlayPresenter';
import { mulberry32 } from '../../rng';
import { cipherGenerator } from '../../games/cipher';

describe('OverlayPresenter', () => {
  it('reports solved with the produced token when the right answer is entered', () => {
    const puzzle = cipherGenerator.generate(2, mulberry32(7));
    const onSolved = vi.fn();
    render(
      <OverlayPresenter
        puzzle={puzzle}
        produces={['deskClue']}
        onSolved={onSolved}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: puzzle.solution } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSolved).toHaveBeenCalledWith({ deskClue: puzzle.solution });
  });
});
