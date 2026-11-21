import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSession } from '../../../test/harness';
import { CoachingStatusTile } from './coaching-status-tile';

/**
 * **P19.18-T1 AC-8, T5 AC-2 — the coaching status tile** (ADR-0267 §5): red *Belum pernah coaching*, green *Coaching n hari
 * lalu* up to 14 days, yellow after — the server's status drawn, never decided here.
 */
describe('P19.18 CoachingStatusTile', () => {
  it('P19.18-T1 AC-8 never coached: red, “Never coached” in English', () => {
    renderWithSession(<CoachingStatusTile status="never" days={null} />);
    const tile = screen.getByText('Never coached');
    expect(tile).toHaveAttribute('data-coaching-status', 'never');
    expect(tile).toHaveClass('bg-pill-red', 'text-pill-red-ink');
  });

  it('P19.18-T1 AC-8 within 14 days green, after it yellow — by the server’s status', () => {
    renderWithSession(<><CoachingStatusTile status="recent" days={14} /><CoachingStatusTile status="lapsed" days={15} /></>);
    expect(screen.getByText('Coached 14 days ago')).toHaveClass('bg-pill-green');
    expect(screen.getByText('Coached 15 days ago')).toHaveClass('bg-pill-amber');
  });

  it('P19.18-T1 AC-8 fill makes it as wide as its box, its words centred', () => {
    renderWithSession(<CoachingStatusTile status="recent" days={1} fill />);
    expect(screen.getByText('Coached 1 day ago')).toHaveClass('w-full', 'text-center');
  });
});
