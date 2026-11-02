import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOpenedOnce } from './use-opened-once';

function Host({ open }: { open: boolean }) {
  return <p>{useOpenedOnce(open) ? 'mounted' : 'not yet'}</p>;
}

/**
 * **A dialog loaded on demand mounts on its first opening, and stays** (P18.99-T16, the bundle): nothing is fetched
 * for a visit that never opens it, and one that has opened keeps what it held between openings, as before.
 */
describe('useOpenedOnce (P18.99-T16)', () => {
  it('P18.99-T16 is false until the first opening, so the dialog module is not fetched with the page', () => {
    const { rerender } = render(<Host open={false} />);
    expect(screen.getByText('not yet')).toBeInTheDocument();
    rerender(<Host open={false} />);
    expect(screen.getByText('not yet')).toBeInTheDocument();
  });

  it('P18.99-T16 is true on the render that opens it, and stays true once it closes', () => {
    const { rerender } = render(<Host open={false} />);
    rerender(<Host open />);
    expect(screen.getByText('mounted')).toBeInTheDocument();
    rerender(<Host open={false} />);
    expect(screen.getByText('mounted')).toBeInTheDocument();
  });

  it('P18.99-T16 is true at once for a dialog opened with the page (a deep link)', () => {
    render(<Host open />);
    expect(screen.getByText('mounted')).toBeInTheDocument();
  });
});
