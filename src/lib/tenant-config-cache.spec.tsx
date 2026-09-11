import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  TenantConfigProvider, useActivityType, useTenantConfig,
} from './tenant-config-cache';

const LADDER = [
  { orgLevelId: 'l1', companyId: 'c1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active' },
];

const CONFIG = {
  activity: [{
    id: 'c1', code: 'SELLING', label: 'Selling', displayOrder: 1, version: 1, status: 'active',
    types: [{
      id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
      description: null, displayOrder: 1, version: 1, status: 'active',
    }],
  }],
  ratios: [],
  leadPipelines: [],
  version: 1,
};

function Reader() {
  const { config, loading, refresh } = useTenantConfig();
  const type = useActivityType('SELL_SUBMISSION');
  return (
    <div>
      <p>{loading ? 'loading' : `v${config?.version ?? 'none'}`}</p>
      <p>{type?.label ?? 'no type'}</p>
      <button type="button" onClick={() => void refresh()}>Refresh</button>
    </div>
  );
}

describe('the shared tenant configuration (P4-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads once and shares it with everything beneath', async () => {
    /*
     * Log Activity is the taxonomy, the ratio strip is the definitions, Leads is the
     * pipelines. Each fetching its own copy is three requests to render one screen, on a
     * connection budgeted for a mid-range Android over 4G.
     */
    const { calls } = stubFetch({
      '/kpm/config': { body: CONFIG },
      // Fetched alongside since P4-T9: every role badge is drawn from it.
      '/kpm/org-levels': { body: LADDER },
    });
    render(
      <TenantConfigProvider>
        <Reader />
        <Reader />
        <Reader />
      </TenantConfigProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('v1')).toHaveLength(3));
    expect(calls.filter((c) => c.url.includes('/kpm/config'))).toHaveLength(1);
  });

  it('resolves a stored code to its label, which is what a screen holding one needs', async () => {
    stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
    render(<TenantConfigProvider><Reader /></TenantConfigProvider>);
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
  });

  it('asks again when a settings screen says something changed', async () => {
    const { calls } = stubFetch({
      '/kpm/config': { body: CONFIG },
      // Fetched alongside since P4-T9: every role badge is drawn from it.
      '/kpm/org-levels': { body: LADDER },
    });
    render(<TenantConfigProvider><Reader /></TenantConfigProvider>);
    await screen.findByText('v1');

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/kpm/config')).length).toBe(2));
  });

  it('says it is loading before the first read settles', () => {
    stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
    render(<TenantConfigProvider><Reader /></TenantConfigProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('degrades to nothing configured outside a provider, rather than crashing a shell', () => {
    // A screen that renders in both applications should not take a shell down with it.
    render(<Reader />);
    expect(screen.getByText('vnone')).toBeInTheDocument();
    expect(screen.getByText('no type')).toBeInTheDocument();
  });

  it('survives a failed read without leaving the screen on a spinner for ever', async () => {
    stubFetch({ '/kpm/config': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } } });
    render(<TenantConfigProvider><Reader /></TenantConfigProvider>);
    await waitFor(() => expect(screen.getByText('vnone')).toBeInTheDocument());
  });
});
