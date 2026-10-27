import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeSession, stubFetch } from '@test/harness';
import { SessionContext, type SessionValue } from './session';
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

  describe('not before the session is (P11-T6 AC-13)', () => {
    /*
     * The provider sits outside the session gate, and a child's effect runs before its parent's: on
     * a hard load this read went out before the session's refresh, with no token, and drew two 401s.
     */
    const inSession = (session: SessionValue) => (
      <SessionContext.Provider value={session}>
        <TenantConfigProvider><Reader /></TenantConfigProvider>
      </SessionContext.Provider>
    );

    it('P11-T6 AC-13 waits while the session is loading, then reads once it has somebody', async () => {
      const { calls } = stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
      const { rerender } = render(inSession(makeSession({ me: null, loading: true })));

      expect(screen.getByText('loading')).toBeInTheDocument();
      expect(calls).toHaveLength(0);

      rerender(inSession(makeSession({ loading: false })));
      expect(await screen.findByText('v1')).toBeInTheDocument();
      expect(calls.map((c) => c.url.split('/api/v1')[1])).toEqual(['/kpm/config', '/kpm/org-levels']);
    });

    it('P11-T6 AC-13 reads nothing for a session with nobody in it, and stops waiting', async () => {
      const { calls } = stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
      render(inSession(makeSession({ me: null, loading: false })));
      expect(await screen.findByText('vnone')).toBeInTheDocument();
      expect(calls).toHaveLength(0);
    });
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

  describe('P18.95-T5 AC-3: the configuration settles on its own', () => {
    /*
     * The two reads were one `Promise.all`, so `loading` — which Log Activity's skeleton reads — waited for the
     * ladder too, and a ladder that failed threw away a configuration that had arrived (UI-030).
     */
    function LadderReader() {
      const { ladder } = useTenantConfig();
      return <p>{ladder.length ? `rungs ${ladder.length}` : 'no rungs'}</p>;
    }

    it('P18.95-T5 AC-3: stops loading once the configuration answers, the ladder still on its way', async () => {
      const { mock } = stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/kpm/org-levels')) await held;
        return mock(url, init);
      }));
      render(<TenantConfigProvider><Reader /><LadderReader /></TenantConfigProvider>);

      expect(await screen.findByText('v1')).toBeInTheDocument();
      expect(screen.getByText('no rungs')).toBeInTheDocument();
      release();
      expect(await screen.findByText('rungs 1')).toBeInTheDocument();
    });

    it('P18.95-T5 AC-3: keeps a configuration that arrived when the ladder fails', async () => {
      stubFetch({
        '/kpm/config': { body: CONFIG },
        '/kpm/org-levels': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } },
      });
      render(<TenantConfigProvider><Reader /><LadderReader /></TenantConfigProvider>);
      expect(await screen.findByText('v1')).toBeInTheDocument();
      expect(screen.getByText('no rungs')).toBeInTheDocument();
    });

    it('P18.95-T5 AC-3: still waits for both before a settings screen’s refresh resolves', async () => {
      const { mock } = stubFetch({ '/kpm/config': { body: CONFIG }, '/kpm/org-levels': { body: LADDER } });
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let gate = false;
      vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        if (gate && url.includes('/kpm/org-levels')) await held;
        return mock(url, init);
      }));
      let refreshOf!: () => Promise<void>;
      function Grab() {
        refreshOf = useTenantConfig().refresh;
        return null;
      }
      render(<TenantConfigProvider><Reader /><Grab /></TenantConfigProvider>);
      await screen.findByText('v1');

      gate = true;
      let done = false;
      const refreshing = refreshOf().then(() => { done = true; });
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      expect(done).toBe(false);
      release();
      await refreshing;
      expect(done).toBe(true);
    });
  });

  describe('a read that lands after the provider is gone', () => {
    /*
     * On CI the answer arrived after the spec's environment was torn down: no `window`, so setting state threw,
     * and the unhandled rejection failed a run whose every test had passed (2026-10-24). Reproduced as it
     * happened: the provider unmounted, `window` taken away as the teardown takes it, and only then the answer.
     */
    for (const outcome of ['answered', 'refused'] as const) {
      it(`is dropped when ${outcome}, and touches nothing`, async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const fetchMock = vi.fn(async (url: string) => {
          await gate;
          return outcome === 'answered'
            ? { ok: true, status: 200, json: async () => (url.includes('/kpm/org-levels') ? LADDER : CONFIG) }
            : { ok: false, status: 500, json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } }) };
        });
        vi.stubGlobal('fetch', fetchMock);
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        try {
          const { unmount } = render(<TenantConfigProvider><Reader /></TenantConfigProvider>);
          expect(fetchMock).toHaveBeenCalledTimes(2);
          unmount();
          vi.stubGlobal('window', undefined);
          release();
          for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
        } finally {
          vi.unstubAllGlobals();
          process.off('unhandledRejection', unhandled);
        }
        expect(unhandled).not.toHaveBeenCalled();
      });
    }
  });
});
