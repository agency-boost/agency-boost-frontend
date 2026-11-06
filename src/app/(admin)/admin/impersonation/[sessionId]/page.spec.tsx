import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import RetiredApprovalAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/impersonation/s1',
}));

/**
 * **P19.4-T2 AC-1 — the second Super Admin's approval page is retired** (ADR-0206 §3): a session only looks, so there
 * is no write to approve. The address lands on the console's overview, and asks the API nothing.
 */
describe('P19.4-T2 AC-1 /admin/impersonation/[sessionId]', () => {
  afterEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('P19.4-T2 AC-1 redirects to /admin, replacing the address, and offers no approval', () => {
    const { calls } = stubFetch({});
    const { container } = render(<RetiredApprovalAddress />);
    expect(replace).toHaveBeenCalledWith('/admin');
    expect(container).not.toHaveTextContent(/approve/i);
    expect(container.querySelector('form, input, textarea, button')).toBeNull();
    expect(calls).toEqual([]);
  });
});
