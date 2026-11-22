import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MovedAuditAddress from './page';

const address = vi.hoisted(() => ({ search: '' }));
const replace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(address.search),
}));

/** **P19.23-T6 AC-1 (ADR-0279): `/admin/audit` moved under *Platform*** — the old address forwards, its query with it. */
describe('/admin/audit, moved', () => {
  afterEach(() => {
    address.search = '';
    replace.mockReset();
  });

  it('P19.23-T6 AC-1 replaces itself with /admin/platform/audit', () => {
    render(<MovedAuditAddress />);
    expect(replace).toHaveBeenCalledWith('/admin/platform/audit');
  });

  it('P19.23-T6 AC-1 keeps the query a link named — Perubahan oleh pengelola’s scope, actor and action', () => {
    address.search = 'kpmId=66f0000000000000000000a1&action=rate_table.activated';
    render(<MovedAuditAddress />);
    expect(replace).toHaveBeenCalledWith('/admin/platform/audit?kpmId=66f0000000000000000000a1&action=rate_table.activated');
  });
});
