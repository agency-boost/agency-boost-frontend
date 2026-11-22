import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeParams, stubFetch } from '@test/harness';
import RetiredOwnerAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/tenants/kpm-1/owner',
}));

/**
 * **P19.27-T3 AC-4 — *Ganti Owner*'s page is retired** (UI-212 (21 Nov); ADR-0285 §4): a KPM has one or more owners,
 * added and removed in *KPM Owner · n* on its page. The old address lands on that section, and assigns nothing.
 */
describe('P19.27-T3 AC-4 /admin/tenants/[kpmId]/owner', () => {
  afterEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });

  it('P19.27-T3 AC-4 redirects to the KPM page’s owner section, replacing the address, calling nothing', () => {
    const { calls } = stubFetch({});
    const { container } = render(<RetiredOwnerAddress params={routeParams({ kpmId: 'kpm-1' })} />);
    expect(replace).toHaveBeenCalledWith('/admin/tenants/kpm-1#owners');
    expect(container.querySelector('form, input, button')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('P19.27-T3 AC-4 keeps an odd id inside the path it names', () => {
    stubFetch({});
    render(<RetiredOwnerAddress params={routeParams({ kpmId: 'a/b' })} />);
    expect(replace).toHaveBeenCalledWith('/admin/tenants/a%2Fb#owners');
  });
});
