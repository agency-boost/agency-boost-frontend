import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import RetiredAnalyticsAddress from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('/admin/analytics — Cross-platform analytics, retired (P19.23-T1 AC-4; ADR-0277 §1)', () => {
  it('P19.23-T1 AC-4 sends the reader to the Dashboard, whose Adopsi per KPM replaces it, replacing the address', () => {
    render(<RetiredAnalyticsAddress />);
    expect(replace).toHaveBeenCalledWith('/admin');
  });
});
