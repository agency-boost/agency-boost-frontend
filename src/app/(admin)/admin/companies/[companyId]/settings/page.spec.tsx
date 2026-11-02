import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { PRUDENTIAL, SUPER_ADMIN, kindView } from '@test/kpm-template-fixtures';
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
 * **A company's page, tab *Company settings*** (ADR-0185 §2; P18.99-T20 AC-1): the company's own — products, carrier
 * rules, playbook — said once to apply at once to every office; the carrier rules asked about before they publish.
 */
describe('P18.99-T20 a company’s own settings', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1 says once that it applies at once to every office, under the company’s second tab', async () => {
    render();
    expect(await screen.findByRole('heading', { level: 1, name: 'Prudential' })).toBeInTheDocument();
    expect(screen.getByText('Applies at once to every office of this company.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Company pages' })).getByRole('link', { name: 'Company settings' }))
      .toHaveAttribute('aria-current', 'page');
    const parts = within(screen.getByRole('navigation', { name: 'Company settings' }));
    expect(parts.getAllByRole('link').map((l) => l.textContent)).toEqual(['Products', 'Campaigns', 'Recruitment']);
    expect(screen.getByTestId('products')).toBeVisible();
  });

  it('keeps a part once opened, so moving between them loses nothing — and asks before leaving an unsaved playbook', async () => {
    render();
    await userEvent.click(await screen.findByRole('link', { name: 'Recruitment' }));
    expect(window.location.hash).toBe('#recruitment');
    expect(screen.getByTestId('recruitment')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'edit' }));
    await userEvent.click(screen.getByRole('link', { name: 'Products' }));
    // Hidden, never unmounted: its edit is still there to come back to.
    expect(screen.getByTestId('recruitment')).not.toBeVisible();
    expect(screen.getByTestId('products')).toBeVisible();
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
});
