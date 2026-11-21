import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import RetiredNewKpmAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('/admin/tenants/new — the old three-step address (P19.23-T2 AC-3)', () => {
  it('P19.23-T2 AC-3 sends the reader to KPM baru on the list, replacing the address', () => {
    render(<RetiredNewKpmAddress />);
    expect(replace).toHaveBeenCalledWith('/admin/tenants?baru=1');
  });
});
