import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch } from '@test/harness';
import VerifyEmailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/verify-email/tok',
}));

const params = routeParams({ token: 'tok-abc' });

describe('verify email', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('verifies on arrival and offers the way onward', async () => {
    const { calls } = stubFetch({ '/auth/verify-email': { body: { status: 'verified' } } });
    renderWithSession(<VerifyEmailPage params={params} />);

    expect(await screen.findByText('Your email is verified. You can sign in now.')).toBeInTheDocument();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: 'tok-abc' });
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('explains a used or expired link instead of leaving a bare error code', async () => {
    stubFetch({
      '/auth/verify-email': {
        status: 400,
        body: { error: { code: 'TOKEN_INVALID', message: 'That link is not valid.', requestId: 'req-1' } },
      },
    });
    renderWithSession(<VerifyEmailPage params={params} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('That link is not valid.');
    expect(screen.getByText(/single-use and expire after 24 hours/)).toBeInTheDocument();
  });
});
