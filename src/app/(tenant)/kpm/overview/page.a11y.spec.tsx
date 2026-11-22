import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { complianceView, overviewView, performanceView, trainingSelected } from './overview-fixtures';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm_overview:read', 'ab_group_target:read', 'ab_group_target:write', 'member:tag_group'],
});

const routes = () => ({
  '/kpm/overview/performance': { body: performanceView() },
  '/kpm/overview/compliance?category=training': { body: trainingSelected() },
  '/kpm/overview/compliance': { body: complianceView() },
  '/kpm/overview': { body: overviewView() },
});

/** Axe over the page, contrast aside (jsdom has no pixels; the tokens' contrast is `a11y.spec.tsx`'s). */
async function expectClean(name: string) {
  const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
  expect((results.violations ?? []).map((v) => `${name}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

const loaded = async () => {
  await screen.findByText('Total KPM');
  await waitFor(() => expect(document.querySelectorAll('[data-card]')).toHaveLength(7));
};

/**
 * **The KPM Overview through axe** (P19.19-T5; WCAG 2.1 AA): its populated state at the three sizes the brief draws, a
 * compliance list open, and the page in Indonesian with no English left but the kept terms. Kept beside the page, as well
 * as `screens.a11y.spec.tsx`'s cases, so the page is checked even while another screen's suite cannot load.
 */
describe('P19.19-T5 the KPM Overview has no axe violations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([1280, 1024, 390])('filled at %ipx', async (width) => {
    atWidth(width);
    stubFetch(routes());
    renderWithSession(<main><KpmOverviewPage /></main>, { me: OWNER });
    await loaded();
    await expectClean(`kpm/overview (${width}px)`);
  });

  it('a compliance list open', async () => {
    stubFetch(routes());
    renderWithSession(<main><KpmOverviewPage /></main>, { me: OWNER });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: /^Training/ }));
    await screen.findByRole('dialog', { name: 'Training · 3 of 5 done' });
    await expectClean('kpm/overview (a compliance list)');
  });

  it('in Indonesian: the mockup’s words, no English left but the kept terms', async () => {
    stubFetch(routes());
    renderInIndonesian(<main><KpmOverviewPage /></main>, { me: OWNER });
    await screen.findByText('Total KPM');
    const main = screen.getByRole('main');
    expect(englishShown(main, englishOnly(kpmOverviewMessages))).toEqual([]);
    expect(within(main).getByText('Sudah pakai AgencyBoost')).toBeInTheDocument();
    await expectClean('kpm/overview, in Indonesian');
  });
});
