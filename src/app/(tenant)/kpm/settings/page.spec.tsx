import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import type { HubCounts, HubSetting, HubStatus, SettingsOverview } from '@/lib/tenant-config';
import SettingsHubPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const READ_ONLY = makeMe({ membership, permissions: ['tenant_config:read'] });

const NONE: HubCounts = {
  activities: null, categories: null, skills: null, modules: null, windowDays: null, version: null, stages: null,
  skillGroups: null, products: null, sold: null, materials: null, kpmCode: null, fiscalYearStartMonth: null,
};
const COUNTS: Partial<Record<HubSetting, Partial<HubCounts>>> = {
  activity_types: { activities: 12, categories: 5 },
  activation_checklist: { windowDays: 90, version: 1 },
  training: { categories: 5, skills: 7, modules: 13 },
  capability_mapping: { stages: 4, skillGroups: 4 },
  products: { products: 31, sold: 29 },
  recruitment_pitch: { materials: 6 },
  branch_info: { kpmCode: '0417', fiscalYearStartMonth: 1 },
};
const ORDER: HubSetting[] = [
  'activity_types', 'lead_statuses', 'activation_checklist', 'training', 'capability_mapping', 'events',
  'campaigns', 'products', 'recruitment_pitch', 'branch_info', 'branding',
];

/** The mockup's frame 11: Activity types unpublished, two scripts waiting, three materials missing, no logo. */
function overview(statuses: Partial<Record<HubSetting, HubStatus>> = {
  activity_types: { kind: 'unpublished' },
  products: { kind: 'waiting', count: 2 },
  recruitment_pitch: { kind: 'missing', count: 3 },
  branding: { kind: 'no_logo' },
}): SettingsOverview {
  return {
    settings: ORDER.map((setting) => ({
      setting, status: statuses[setting] ?? null, counts: { ...NONE, ...COUNTS[setting] },
    })),
    unpublished: ORDER.filter((s) => statuses[s]?.kind === 'unpublished') as SettingsOverview['unpublished'],
  };
}

function render(body: SettingsOverview | { status: number; body: unknown } = overview(), me = OWNER, indonesian = false) {
  const reply = 'settings' in body ? { body } : body;
  const stub = stubFetch({
    '/kpm/settings/overview': [reply, { body: overview({}) }],
    '/kpm/settings/publish': { body: { publishedVersion: 2, workingVersion: 2, hasUnpublishedChanges: false, publishedAt: null, settings: [] } },
  });
  const ui = <SettingsHubPage />;
  if (indonesian) renderInIndonesian(ui, { me });
  else renderWithSession(ui, { me });
  return stub;
}

describe('the Pengaturan hub (P19.21-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T2 AC-1 draws five groups of list cards, each row a link to its setting’s page', async () => {
    render();
    const groups = await screen.findAllByRole('region');
    expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual([
      'Activity & leads', 'New agents & training', 'Events & campaigns', 'Products & recruitment', 'KPM',
    ]);
    expect(screen.getByRole('link', { name: 'Activity types' })).toHaveAttribute('href', '/kpm/settings/activity-types');
    // Training, Events and Campaigns open their current pages (Phase 19.25 redraws them).
    expect(screen.getByRole('link', { name: 'Training' })).toHaveAttribute('href', '/kpm/settings/training');
    expect(screen.getByRole('link', { name: 'Campaigns' })).toHaveAttribute('href', '/kpm/settings/campaigns');
    expect(screen.getByRole('link', { name: 'KPM branding' })).toHaveAttribute('href', '/kpm/settings/branding');
    expect(screen.getAllByRole('link')).toHaveLength(11);
  });

  it('P19.21-T2 AC-1 keeps the same order of groups in one column and in two', async () => {
    render();
    const rows = await screen.findAllByRole('link');
    expect(rows.map((r) => r.closest('[data-hub-row]')?.getAttribute('data-hub-row'))).toEqual(ORDER);
  });

  it('P19.21-T2 AC-2 shows a status only where the owner must act — dot and words', async () => {
    render();
    await screen.findByText('Not published');
    const statuses = [...document.querySelectorAll('[data-hub-status]')].map((s) => [
      s.closest('[data-hub-row]')!.getAttribute('data-hub-row'), s.textContent,
    ]);
    expect(statuses).toEqual([
      ['activity_types', 'Not published'], ['products', '2 waiting'], ['recruitment_pitch', '3 missing'],
      ['branding', 'No logo yet'],
    ]);
  });

  it('P19.21-T2 AC-2 a hub with nothing to do shows no status and no bar', async () => {
    render(overview({}));
    await screen.findByRole('link', { name: 'Activity types' });
    expect(document.querySelectorAll('[data-hub-status]')).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('P19.21-T2 AC-1 one unpublished setting: named in the bar, and Terbitkan publishes it alone', async () => {
    const { calls } = render();
    const bar = await screen.findByRole('status');
    expect(bar).toHaveTextContent('Activity types has changes that are not published. Agents are still on the previous version.');
    await userEvent.click(within(bar).getByRole('button', { name: 'Publish' }));
    const post = calls.find((c) => c.url.includes('/kpm/settings/publish') && c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ settings: ['activity_types'] });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('P19.21-T2 AC-1 several: counted, and Terbitkan semua publishes every one of them', async () => {
    const { calls } = render(overview({ activity_types: { kind: 'unpublished' }, events: { kind: 'unpublished' } }));
    const bar = await screen.findByRole('status');
    expect(bar).toHaveTextContent('2 settings have changes that are not published.');
    await userEvent.click(within(bar).getByRole('button', { name: 'Publish all' }));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ settings: ['activity_types', 'events'] });
  });

  it('P19.21-T2 AC-1 a reader who cannot publish reads the bar without its button', async () => {
    render(overview(), READ_ONLY);
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('P19.21-T2 AC-1 says what each row counts', async () => {
    render();
    expect(await screen.findByText('12 activity types · 5 categories · ratio benchmarks')).toBeInTheDocument();
    expect(screen.getByText('90 days for a new hire · version 1')).toBeInTheDocument();
    expect(screen.getByText('5 categories · 7 skills · 13 modules')).toBeInTheDocument();
    expect(screen.getByText('31 products · 29 sold by agents')).toBeInTheDocument();
    expect(screen.getByText('KPM code 0417 · book year from January')).toBeInTheDocument();
  });

  it('P19.21-T2 AC-1 AC-2 reads the mockup’s words in Indonesian', async () => {
    render(overview(), OWNER, true);
    expect(await screen.findByRole('heading', { name: 'Pengaturan' })).toBeInTheDocument();
    expect(screen.getByText('Activity types punya perubahan yang belum diterbitkan.')).toBeInTheDocument();
    expect(screen.getByText('12 jenis aktivitas · 5 kategori · Ratio benchmarks')).toBeInTheDocument();
    expect(screen.getByText('90 hari untuk new hire · versi 1')).toBeInTheDocument();
    expect(screen.getByText('Ladder 4 tahap · Skill tracker 4 kelompok')).toBeInTheDocument();
    expect(screen.getByText('31 produk · 29 dijual agent')).toBeInTheDocument();
    expect(screen.getByText('Kode KPM 0417 · tahun buku Januari')).toBeInTheDocument();
    expect(screen.getByText('Nama sistem, logo, warna, maskot')).toBeInTheDocument();
    expect(screen.getByText('Belum diterbitkan')).toBeInTheDocument();
    expect(screen.getByText('2 menunggu')).toBeInTheDocument();
    expect(screen.getByText('3 belum ada')).toBeInTheDocument();
    expect(screen.getByText('Logo belum ada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tampilan KPM' })).toBeInTheDocument();
  });

  it('P19.21-T2 a reader who is not a steward is told the page is not theirs (the API’s 404)', async () => {
    render({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM not found', requestId: 'r' } } });
    expect(await screen.findByText(/for the KPM Owner, an Admin and core leaders/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('P19.21-T2 an error is said, and Try again reads again', async () => {
    const { calls } = render({ status: 500, body: { error: { code: 'INTERNAL', message: 'Something broke', requestId: 'r' } } });
    expect(await screen.findByText('Something broke')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Activity types' })).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/kpm/settings/overview'))).toHaveLength(2);
  });

  it('P19.21-T2 draws a skeleton while it reads', () => {
    stubFetch({ '/kpm/settings/overview': { body: overview() } });
    renderWithSession(<SettingsHubPage />, { me: OWNER });
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('P19.21-T2 passes axe in its populated state', async () => {
    render();
    await screen.findByText('Not published');
    // jsdom draws no colours: contrast is the tokens' own (`tokens.md`); the page is rendered without the shell's `main`.
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });
});
