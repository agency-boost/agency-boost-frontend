import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderWithSession, routeParams, stubFetch, wears, type StubReply } from '@test/harness';
import { LIBRARY, PRUDENTIAL, SUPER_ADMIN, kindView } from '@test/kpm-template-fixtures';
import CompanySettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/settings',
}));
// The two parts that load on demand, as the doubles they are here: their own specs are theirs.
vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<unknown>) => {
    const name = String(load).includes('products-tab') ? 'products' : 'recruitment';
    return ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => (
      <div data-testid={name}>
        {onDirtyChange && <button type="button" onClick={() => onDirtyChange(true)}>edit</button>}
      </div>
    );
  },
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const RULES = {
  rules: [{
    kind: 'production_club', code: 'PRESIDENTS_CLUB', name: 'President’s Club', rank: 1,
    criteriaGroups: [{ mode: 'all', criteria: [{ metricKey: 'ape', comparator: 'gte', value: 100000000 }] }],
  }],
};

function render(extra: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/template/campaign_kinds': {
      body: kindView('campaign_kinds', RULES, { templateId: null, status: 'draft', version: 2, publishedVersion: 1 }),
    },
    '/metrics': { body: [{ key: 'ape', name: 'APE', unit: 'idr', description: '' }] },
    ...extra,
  });
  const view = renderWithSession(<CompanySettingsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
  return { ...view, stub };
}

/**
 * **A company's page, tab *Company settings*** (ADR-0185 §2; P18.11-T20 AC-1): the company's own — products, carrier
 * rules — said once to apply at once to every office; the carrier rules asked about before they publish. The playbook
 * left for the templates' *Rekrutmen* section (P19.4-T5, ADR-0210 §3).
 */
describe('P18.11-T20 a company’s own settings', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1 says once that it applies at once to every office, under the company’s second tab', async () => {
    render();
    expect(await screen.findByRole('heading', { level: 1, name: 'Prudential' })).toBeInTheDocument();
    expect(screen.getByText('Applies at once to every office of this company.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Company pages' })).getByRole('link', { name: 'Company settings' }))
      .toHaveAttribute('aria-current', 'page');
    const parts = within(screen.getByRole('navigation', { name: 'Company settings' }));
    // P19.4-T5 AC-6 (ADR-0210 §3; B1-11): Produk · Campaign — Rekrutmen is a template's section now.
    expect(parts.getAllByRole('link').map((l) => l.textContent)).toEqual(['Products', 'Campaigns']);
    expect(screen.getByTestId('products')).toBeVisible();
  });

  it('keeps a part once opened, so moving between them loses nothing', async () => {
    render();
    await screen.findByTestId('products');
    await userEvent.click(await screen.findByRole('link', { name: 'Campaigns' }));
    expect(window.location.hash).toBe('#campaigns');
    // Hidden, never unmounted: its edit is still there to come back to.
    expect(screen.getByTestId('products')).not.toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Products' }));
    expect(screen.getByTestId('products')).toBeVisible();
  });

  it('P19.4-T5 AC-6 an old link to #recruitment opens Products: the playbook is no longer the company’s', async () => {
    window.history.replaceState(null, '', '/admin/companies/c1/settings#recruitment');
    render();
    expect(await screen.findByTestId('products')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Recruitment' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('recruitment')).not.toBeInTheDocument();
  });

  it('Campaigns: the carrier rules through their editor, a pill per heading, the draft’s words', async () => {
    render();
    await userEvent.click(await screen.findByRole('link', { name: 'Campaigns' }));
    expect(window.location.hash).toBe('#campaigns');
    expect(await screen.findByText('Draft v2 · v1 published')).toBeInTheDocument();
    const pills = within(screen.getByRole('navigation', { name: 'Campaigns parts' }));
    expect(pills.getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Production club tiers', 'Maintenance of Contract', 'Promotion paths']);
    expect(screen.getByText('President’s Club')).toBeInTheDocument();
  });

  it('Campaigns: Publish asks first, because it reaches the offices that exist, then publishes the company’s rules', async () => {
    const { stub } = render({
      'POST /admin/companies/c1/template/campaign_kinds/publish': {
        body: kindView('campaign_kinds', RULES, { templateId: null, version: 2, publishedVersion: 2 }),
      },
    });
    await userEvent.click(await screen.findByRole('link', { name: 'Campaigns' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const question = within(screen.getByRole('dialog'));
    expect(question.getByText(/including the ones that already exist/)).toBeInTheDocument();
    expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
    await userEvent.click(question.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published v2')).toBeInTheDocument();
    const post = stub.calls.find((c) => c.init.method === 'POST');
    // The company's own, under no template.
    expect(post?.url).toMatch(/\/admin\/companies\/c1\/template\/campaign_kinds\/publish\?$/);
  });

  it('has no axe violations: the products, and the carrier rules with Publish asked', async () => {
    render();
    await screen.findByTestId('products');
    await clean();
    await userEvent.click(screen.getByRole('link', { name: 'Campaigns' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await clean();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx draws Products · Campaigns and the carrier rules’ parts as 44px tabs (UI-135)', async (px) => {
    atWidth(px);
    render();
    await screen.findByTestId('products');
    for (const tab of within(screen.getByRole('navigation', { name: 'Company settings' })).getAllByRole('link')) {
      expect(wears(tab, px)).toContain('min-h-11');
    }
    await userEvent.click(screen.getByRole('link', { name: 'Campaigns' }));
    for (const tab of within(await screen.findByRole('navigation', { name: 'Campaigns parts' })).getAllByRole('link')) {
      expect(wears(tab, px)).toContain('min-h-11');
    }
  });

  /*
   * **The company's slug, currency and time zone, moved here from the companies list's columns** (P19.2-T2 AC-1;
   * UI-126: *Slug, Mata uang and Zona waktu move to the company page*). Read, not edited; an insurer's only.
   */
  it.each([375, 768, 1024, 1280])('P19.2-T2 AC-1 at %ipx reads the company’s slug, currency and time zone on its settings tab', async (px) => {
    atWidth(px);
    render();
    await screen.findAllByRole('definition');
    const facts = document.querySelector<HTMLElement>('[data-company-facts]')!;
    expect(facts).toHaveAttribute('aria-label', 'Company details');
    expect([...facts.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Slug', 'Currency', 'Time zone']);
    expect([...facts.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['prudential', 'IDR', 'Asia/Jakarta']);
    // Facts of the company, not a sub-line under the title (AC-7): the shared header draws none.
    expect(screen.getByText('Applies at once to every office of this company.')).toBeInTheDocument();
  });

  // AC-10 (*Don't change*: the *Pengaturan perusahaan* explanation stays as it is until Phase 19.4's B1-11): its line
  // first on the tab, at every size, its words as they were — the facts after it.
  it.each([375, 768, 1280])('P19.2-T2 AC-10 at %ipx keeps the Pengaturan perusahaan line as it was, first on the tab', async (px) => {
    atWidth(px);
    render();
    const line = await screen.findByText('Applies at once to every office of this company.');
    expect(line.tagName).toBe('P');
    expect(line.className).not.toMatch(/hidden/);
    const facts = await screen.findAllByRole('definition').then(() => document.querySelector('[data-company-facts]')!);
    expect(line.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P19.2-T2 AC-1 draws no facts for the built-in templates’ company, which holds no office', async () => {
    stubFetch({
      '/admin/companies': { body: [LIBRARY] },
      '/admin/companies/lib/template/campaign_kinds': {
        body: kindView('campaign_kinds', RULES, { templateId: null, status: 'draft', version: 2, publishedVersion: 1 }),
      },
      '/metrics': { body: [] },
    });
    renderWithSession(<CompanySettingsPage params={routeParams({ companyId: 'lib' })} />, { me: SUPER_ADMIN });
    await screen.findByTestId('products');
    expect(document.querySelector('[data-company-facts]')).toBeNull();
  });

  it('P19.2-T2 AC-5 keeps the tabs as they were from 1024px', async () => {
    render();
    await screen.findByTestId('products');
    for (const tab of within(screen.getByRole('navigation', { name: 'Company settings' })).getAllByRole('link')) {
      expect(wears(tab, 1280)).not.toContain('min-h-11');
    }
  });
});
