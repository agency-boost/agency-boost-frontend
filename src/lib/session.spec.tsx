import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeMe, renderWithSession } from '../../test/harness';
import { useCan } from './session';

function Probe({ permission }: { permission: string }) {
  return <p>{useCan(permission) ? 'shown' : 'hidden'}</p>;
}

describe('useCan', () => {
  it('shows a control the server said this person holds', () => {
    renderWithSession(<Probe permission="kpm:create" />, {
      me: makeMe({ permissions: ['kpm:create'] }),
    });
    expect(screen.getByText('shown')).toBeInTheDocument();
  });

  it('hides one they do not', () => {
    renderWithSession(<Probe permission="kpm:create" />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByText('hidden')).toBeInTheDocument();
  });

  it('answers false for an anonymous visitor rather than throwing', () => {
    renderWithSession(<Probe permission="kpm:create" />, { me: null });
    expect(screen.getByText('hidden')).toBeInTheDocument();
  });
});
