import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { DEFAULT_TEMPLATE, PRUDENTIAL, SUPER_ADMIN, kindView } from '@test/kpm-template-fixtures';
import TemplateSettingsPage from './page';
import CompanyCampaignsPage from './campaigns/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/settings',
}));

const withDrafts = {
  ...DEFAULT_TEMPLATE,
  sections: {
    ...DEFAULT_TEMPLATE.sections,
    activity_taxonomy: { publishedVersion: 3, hasDraft: true },
    training_taxonomy: { publishedVersion: 1, hasDraft: true },
  },
};

function render(templates: unknown = [withDrafts], campaignDraft = false) {
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: templates },
    '/admin/companies/c1/template/campaign_kinds': {
      body: kindView('campaign_kinds' as never, {}, campaignDraft ? { status: 'draft', version: 2, publishedVersion: 1 } : {}),
    },
  } as never);
  renderInIndonesian(<TemplateSettingsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
}

/** **P19.23-T4 AC-4 — *Pengaturan template*** (ADR-0278 §1, §5; frame 35): the owner hub's groups, no *Tampilan*. */
describe('P19.23-T4 AC-4 Pengaturan template', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([390, 1024])('P19.23-T4 AC-4 at %ipx draws the four groups, objection handling under Produk & rekrut, no Tampilan', async (px) => {
    atWidth(px);
    render();
    const groups = await screen.findAllByRole('region');
    expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual([
      'Aktivitas & leads', 'Agent baru & training', 'Event & campaign', 'Produk & rekrut',
    ]);
    const produk = within(groups[3]);
    expect(produk.getAllByRole('link').map((l) => l.textContent)).toEqual(['Recruitment pitch', 'Objection handling']);
    expect(screen.queryByText(/Tampilan/)).toBeNull();
    expect(screen.getByText('Sama dengan Pengaturan owner, tapi untuk template: KPM baru menyalin ini')).toBeInTheDocument();
  });

  it('P19.23-T4 AC-4 each row opens its section of the default template, and says Belum diterbitkan only while a draft waits', async () => {
    render([withDrafts], true);
    await screen.findByText('Activity types');
    const row = async (key: string) => (await screen.findAllByRole('listitem')).find((li) => li.dataset.settingRow === key)!;
    expect(within(await row('activity_types')).getByRole('link')).toHaveAttribute('href', '/admin/companies/c1/templates/t-default/activity');
    expect(within(await row('objection_handling')).getByRole('link')).toHaveAttribute('href', '/admin/companies/c1/templates/t-default/recruitment');
    expect(within(await row('campaigns')).getByRole('link')).toHaveAttribute('href', '/admin/companies/c1/settings/campaigns');
    await vi.waitFor(async () => expect(within(await row('campaigns')).getByText('Belum diterbitkan')).toBeInTheDocument());
    expect(within(await row('activity_types')).getByText('Belum diterbitkan')).toBeInTheDocument();
    expect(within(await row('training')).getByText('Belum diterbitkan')).toBeInTheDocument();
    expect(within(await row('lead_statuses')).queryByText('Belum diterbitkan')).toBeNull();
  });

  it('P19.23-T4 AC-4 says a company with no template, and passes axe populated', async () => {
    render([]);
    expect(await screen.findByText('Perusahaan ini belum punya template.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    atWidth(1280);
    render();
    await screen.findAllByText('Belum diterbitkan');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });
});

/**
 * ***Campaigns*, the company's carrier rules** (P19.23-T4 AC-4; ADR-0278 §7): moved from the old *Pengaturan perusahaan*
 * tab to their own page, opened from *Pengaturan template*'s row — a pill per part, the draft's words, and *Terbitkan* for
 * an insurer taking the reader to *Terbitkan ke KPM*. Read in ID mode (P18.10-T7 AC-1).
 */
describe('P19.23-T4 AC-4 Campaigns, the carrier rules, in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.10-T7 AC-1 the parts, the draft’s words and the rule as typed, with no English left', async () => {
    const RULES = {
      rules: [{
        kind: 'production_club', code: 'PRESIDENTS_CLUB', name: 'President’s Club', rank: 1,
        criteriaGroups: [{ mode: 'all', criteria: [{ metricKey: 'ape', comparator: 'gte', value: 100000000 }] }],
      }],
    };
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL] },
      '/admin/companies/c1/template/campaign_kinds': {
        body: kindView('campaign_kinds' as never, RULES, { templateId: null, status: 'draft', version: 2, publishedVersion: 1 }),
      },
      '/metrics': { body: [{ key: 'ape', name: 'APE', unit: 'idr', description: '' }] },
    } as never);
    renderInIndonesian(<CompanyCampaignsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('President’s Club')).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(adminTemplateMessages))).toEqual([]);
  });
});
