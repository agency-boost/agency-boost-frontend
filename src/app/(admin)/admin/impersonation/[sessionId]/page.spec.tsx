import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import ElevateSessionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/impersonation/s1',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['impersonation:elevate_to_write'],
});

function render(extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/admin/impersonation/s1/elevate': { status: 204, body: null },
    ...extra,
  });
  renderWithSession(
    <ElevateSessionPage params={routeParams({ sessionId: 's1' })} />,
    { me: SUPER_ADMIN },
  );
  return stub;
}

describe('approving a support session to write (P4-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says the approver cannot be the operator, before they try', async () => {
    // The API refuses it. Saying so first means the round trip is not spent learning
    // something the screen already knew.
    render();
    expect(screen.getByText(/cannot approve your own session/)).toBeInTheDocument();
  });

  it('says the Owner will read this', async () => {
    render();
    expect(screen.getByText(/Owner reads your name and your reason/)).toBeInTheDocument();
  });

  it('asks for a reason long enough to mean something', async () => {
    const button = () => screen.getByRole('button', { name: /Approve this session/ });
    render();
    expect(button()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Why is looking not enough/), 'fix it');
    expect(screen.getByText('At least 10 characters.')).toBeInTheDocument();
    expect(button()).toBeDisabled();
  });

  it('sends the reason and says what changed', async () => {
    const { calls } = render();
    await userEvent.type(
      screen.getByLabelText(/Why is looking not enough/),
      'Their taxonomy has a duplicate code.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Approve this session/ }));

    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string))
      .toEqual({ reason: 'Their taxonomy has a duplicate code.' });
    expect(await screen.findByRole('status'))
      .toHaveTextContent('can now make changes for the rest of its hour');
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    render({
      '/admin/impersonation/s1/elevate': {
        status: 403,
        body: {
          error: {
            code: 'PERM_DENIED',
            message: 'A second Super Admin has to approve this — not the one running the session.',
            requestId: 'r-1',
          },
        },
      },
    });
    await userEvent.type(
      screen.getByLabelText(/Why is looking not enough/),
      'I started this one myself.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Approve this session/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not the one running the session');
  });
});
