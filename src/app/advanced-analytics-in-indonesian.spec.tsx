import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import type { Me } from '@/lib/session';
import type { Shell } from '@/lib/advanced-analytics-page';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import AdvancedAnalyticsLayout from './kpm/advanced-analytics/layout';
import AdvancedAnalyticsIndexPage from './kpm/advanced-analytics/page';
import AdvancedAnalyticsSectionPage from './kpm/advanced-analytics/[section]/page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/kpm/advanced-analytics/demographics',
  useSearchParams: () => new URLSearchParams(),
}));

const OWNER: Me = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['advanced_analytics:read', 'advanced_analytics:write'],
});
const ENGLISH = englishOnly(advancedAnalyticsPageMessages);
const SHELL: Shell = {
  templateName: 'Prudential standar', version: 1, canWrite: true, canUpload: true,
  sections: [{ kode: 'DEMOGRAPHICS', slug: 'demographics' }, { kode: 'QUANT', slug: 'quant' }, { kode: 'EVENTS', slug: 'events' }],
};
const DEMOGRAPHICS = {
  month: '2026-11', ab: null, abs: [], manpower: 2,
  role: [{ key: 'AGENT', label: 'Agen', count: 2 }],
  workStatus: [{ key: 'full_time', count: 1 }, { key: 'part_time', count: 0 }, { key: 'unset', count: 1 }],
  gender: [{ key: 'male', count: 1 }, { key: 'female', count: 0 }, { key: 'unset', count: 1 }],
  ageBand: [{ key: 'gen_z', count: 1, from: 17, to: 29 }, { key: 'gen_y', count: 0, from: 30, to: 45 }, { key: 'gen_x', count: 0, from: 46, to: null }, { key: 'unset', count: 1 }],
  tenureBand: [{ key: '0', count: 2, from: null, to: 3 }, { key: 'unset', count: 0 }],
};

/**
 * **The KPM's *Advanced analytics* page in ID mode** (P18.10-T7 AC-1 for `/kpm/advanced-analytics` and
 * `/kpm/advanced-analytics/[section]`; P19.5-T3 AC-13): the layout's tabs and notice, the index's way to the first
 * section, and a section — no English left where Indonesian is written.
 */
describe('P19.5-T3 Advanced analytics in Indonesian', () => {
  afterEach(() => { vi.unstubAllGlobals(); replace.mockClear(); });

  it('/kpm/advanced-analytics opens the template’s first section', async () => {
    stubFetch({ 'GET /kpm/advanced-analytics': { body: SHELL } });
    renderInIndonesian(<AdvancedAnalyticsLayout><AdvancedAnalyticsIndexPage /></AdvancedAnalyticsLayout>, { me: OWNER });
    expect(await screen.findByText('Bagian mengikuti Prudential standar v1.')).toBeInTheDocument();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/kpm/advanced-analytics/demographics'));
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('/kpm/advanced-analytics/[section]', async () => {
    stubFetch({
      'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS },
      'GET /kpm/advanced-analytics': { body: SHELL },
    });
    renderInIndonesian(
      <AdvancedAnalyticsLayout><AdvancedAnalyticsSectionPage params={routeParams({ section: 'demographics' })} /></AdvancedAnalyticsLayout>,
      { me: OWNER },
    );
    expect(await screen.findByText('Paruh waktu')).toBeInTheDocument();
    expect(screen.getAllByText('Belum diisi').length).toBeGreaterThan(0);
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('P19.5-T3 AC-11 a section the template has off goes to the first that is on', async () => {
    stubFetch({ 'GET /kpm/advanced-analytics': { body: SHELL } });
    renderInIndonesian(
      <AdvancedAnalyticsLayout><AdvancedAnalyticsSectionPage params={routeParams({ section: 'mapa' })} /></AdvancedAnalyticsLayout>,
      { me: OWNER },
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/kpm/advanced-analytics/demographics'));
  });
});
