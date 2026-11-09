import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeParams, stubFetch } from '@test/harness';
import RetiredRosterAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/tenants/kpm-1/roster',
}));

/**
 * **P19.4-T2 AC-3, AC-8 — *Impor roster* is retired** (UI-151; Overview case 10; ADR-0206 §6): the people are the
 * KPM's, and its Owner or an Admin imports them. The old address lands on the KPM's page, and imports nothing.
 */
describe('P19.4-T2 AC-3 /admin/tenants/[kpmId]/roster', () => {
  afterEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('P19.4-T2 AC-3 redirects to the KPM’s page, replacing the address, with no import on it', () => {
    const { calls } = stubFetch({});
    const { container } = render(<RetiredRosterAddress params={routeParams({ kpmId: 'kpm-1' })} />);
    expect(replace).toHaveBeenCalledWith('/admin/tenants/kpm-1');
    expect(container.querySelector('form, input, button')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('P19.4-T2 AC-3 keeps an odd id inside the path it names', () => {
    stubFetch({});
    render(<RetiredRosterAddress params={routeParams({ kpmId: 'a/b' })} />);
    expect(replace).toHaveBeenCalledWith('/admin/tenants/a%2Fb');
  });
});
