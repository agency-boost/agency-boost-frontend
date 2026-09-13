import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import RatioBenchmarksPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/ratio-benchmarks',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const AGENT = makeMe({
  membership: { ...membership, orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const, isKpmOwner: false },
  permissions: ['tenant_config:read'],
});

const RATIOS = [
  {
    id: 'r1', code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate',
    numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION', 'SELL_FOLLOWUP'],
    benchmark: 0.15, comparison: 'gte', displayOrder: 1, version: 1, status: 'active',
    // Provisioned, so its formula is fixed and its benchmark is not (ADR-0021).
    origin: 'platform', appliesToOrgLevelCodes: [],
  },
  {
    id: 'r2', code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment',
    numerator: ['SELL_SUBMISSION'], denominator: ['RECRUIT_AGENT_CODE'],
    benchmark: 30, comparison: 'band', displayOrder: 2, version: 1, status: 'active',
    // The one an agent with no recruiting mandate must not be measured on (ADR-0020).
    origin: 'platform', appliesToOrgLevelCodes: ['AB', 'AAB'],
  },
  {
    id: 'r3', code: 'REFERRAL_RATE', label: 'Referral rate',
    numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'],
    benchmark: 0.5, comparison: 'gte', displayOrder: 3, version: 1, status: 'active',
    origin: 'office', appliesToOrgLevelCodes: [],
  },
];

/** The company's ladder, junior first — what the applicability control offers. */
const LADDER = [
  { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
  { orgLevelId: 'l2', companyId: 'co-1', code: 'AAB', label: 'AAB', displayOrder: 2, status: 'active', archivedAt: null },
  { orgLevelId: 'l3', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 3, status: 'active', archivedAt: null },
];

const TAXONOMY = [{
  id: 'c1', code: 'SELLING', label: 'Selling', displayOrder: 1, version: 1, status: 'active',
  types: [
    { id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: null, displayOrder: 1, version: 1, status: 'active' },
    { id: 't2', code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi penjualan', description: null, displayOrder: 2, version: 1, status: 'active' },
  ],
}];

function render(me = OWNER) {
  const stub = stubFetch({
    '/kpm/settings/ratio-benchmarks': { body: RATIOS },
    '/kpm/settings/activity-types': { body: TAXONOMY },
    // The provider's two reads. The ladder is the company's (ADR-0012) and this screen
    // reads it rather than owning a copy — so the test supplies it the same way.
    '/kpm/config': { body: { activity: TAXONOMY, ratios: RATIOS, leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: LADDER },
  });
  renderWithSession(
    <TenantConfigProvider><RatioBenchmarksPage /></TenantConfigProvider>,
    { me },
  );
  return stub;
}

describe('the office ratio benchmarks (P4-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a formula as the activity types it counts, not as numbers', async () => {
    /*
     * The prototype writes these as `6 / (4+5)` — item numbers, which are unreadable and
     * break the moment somebody reorders the taxonomy. Labels by default; the code is
     * behind *Show codes* since P4-T19, because an Owner reads this screen daily and the
     * identity is not what they are reading it for.
     */
    render();
    // Several formulas count it, so the label appears more than once — which is the point.
    expect((await screen.findAllByText('Submission polis')).length).toBeGreaterThan(0);
    expect(screen.queryByText('SELL_SUBMISSION')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show codes'));
    expect(screen.getAllByText('SELL_SUBMISSION').length).toBeGreaterThan(0);
  });

  it('shows a code with no label exactly once, not twice', async () => {
    /*
     * A ratio can name a type the office has since archived, and the code is already
     * rendered beside the label. Falling back to the code printed the same string twice
     * on precisely the rows an Owner most needs to read clearly.
     */
    render();
    expect(await screen.findAllByText('SELL_FOLLOWUP')).toHaveLength(1);
  });

  it('reads a gte benchmark and a band benchmark differently', async () => {
    render();
    // Scoped to the card since P4-T15 added a third ratio to the fixture — two `gte` rows
    // now read the same sentence, which is correct and made the bare query ambiguous.
    await screen.findByRole('heading', { name: 'Selling success rate' });
    expect(screen.getAllByText(/On track at or above/).length).toBeGreaterThan(0);
    expect(screen.getByText(/On track within/)).toBeInTheDocument();
    expect(screen.getByText('points')).toBeInTheDocument();
  });

  it('stages a benchmark change and sends nothing until Save changes', async () => {
    /*
     * P4-T19. An Owner restructuring used to write on every Save, so their own screen
     * walked through states the publish gate only ever hid from *agents*.
     */
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Change the benchmark' }))[0]);
    const input = screen.getByLabelText('Benchmark');
    await userEvent.clear(input);
    await userEvent.type(input, '0.25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Nothing has left the browser yet — and the screen says so.
    expect(calls.some((c) => c.init.method === 'POST' && c.url.includes('changes'))).toBe(false);
    expect(screen.getByText(/1 change not saved yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    expect(JSON.parse(post.init.body as string).ops).toEqual([{
      op: 'ratio.update', id: 'r1', expectedVersion: 1, body: { benchmark: 0.25 },
    }]);
  });

  it('collapses repeated edits to one row into a single change', async () => {
    const { calls } = render();
    for (const value of ['0.2', '0.3']) {
      await userEvent.click((await screen.findAllByRole('button', { name: 'Change the benchmark' }))[0]);
      const input = screen.getByLabelText('Benchmark');
      await userEvent.clear(input);
      await userEvent.type(input, value);
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    }
    expect(screen.getByText(/1 change not saved yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    const { ops } = JSON.parse(post.init.body as string);
    expect(ops).toHaveLength(1);
    expect(ops[0].body.benchmark).toBe(0.3);
  });

  it('discards staged edits without sending them', async () => {
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Change the benchmark' }))[0]);
    await userEvent.clear(screen.getByLabelText('Benchmark'));
    await userEvent.type(screen.getByLabelText('Benchmark'), '0.25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard them' }));

    expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);
  });

  it('shows an agent the ratios and none of the controls', async () => {
    render(AGENT);
    expect(await screen.findByText('Selling success rate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change the benchmark' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  describe('two kinds of ratio, and who each is for (P4-T15)', () => {
    it('AC-6: says a platform ratio’s formula is fixed, and why', async () => {
      /*
       * Stated on the card, not expressed as a disabled control. A field that will not
       * accept input and does not say why is the worst of both — the Owner learns only
       * that something is broken.
       */
      render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText(/Measured the same way in every office/))
        .toBeInTheDocument();
    });

    it('AC-6: says an office’s own ratio is entirely theirs', async () => {
      render();
      const card = (await screen.findByRole('heading', { name: 'Referral rate' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText(/Your office’s own/)).toBeInTheDocument();
    });

    it('AC-6: reads an empty applicability as Everyone, never as a blank', async () => {
      // A card showing nothing beside "Applies to" reads as a setting that failed to load.
      render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText('Everyone')).toBeInTheDocument();
    });

    it('AC-6: names the rungs by their company labels, not by their codes', async () => {
      render();
      const card = (await screen.findByRole('heading', { name: 'Selling vs Recruitment' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText('AB · AAB')).toBeInTheDocument();
    });

    it('AC-6: sends only the rungs when the applicability changes', async () => {
      const { calls } = render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      await userEvent.click(within(card).getByRole('button', { name: 'Change who it applies to' }));
      await userEvent.click(within(card).getByLabelText('AB'));
      await userEvent.click(within(card).getByRole('button', { name: 'Save' }));

      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
      expect(JSON.parse(post.init.body as string).ops[0]).toMatchObject({
        op: 'ratio.update', body: { appliesToOrgLevelCodes: ['AB'] },
      });
    });

    it('AC-6: offers every rung the company publishes, and nothing else', async () => {
      render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      await userEvent.click(within(card).getByRole('button', { name: 'Change who it applies to' }));
      for (const rung of ['Agent', 'AAB', 'AB']) {
        expect(within(card).getByLabelText(rung)).toBeInTheDocument();
      }
    });

    it('AC-6: adds a ratio of the office’s own', async () => {
      /*
       * `POST /kpm/settings/ratio-benchmarks` had no screen at all between P4-T2 and here
       * — the defect `backend-then-frontend.md` names, invisible because the gate matches
       * by path and `GET` shares it.
       */
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a ratio' }));
      await userEvent.type(screen.getByLabelText('Code'), 'REFERRALS');
      await userEvent.type(screen.getByLabelText('Name'), 'Referrals');

      const counts = screen.getByRole('group', { name: 'Counts' });
      await userEvent.click(within(counts).getByLabelText('Submission polis'));
      const outOf = screen.getByRole('group', { name: 'Out of' });
      await userEvent.click(within(outOf).getByLabelText('Presentasi penjualan'));

      await userEvent.type(screen.getByLabelText('On track at or above'), '0.3');
      await userEvent.click(screen.getByRole('button', { name: 'Add the ratio' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toMatchObject({
        code: 'REFERRALS', label: 'Referrals',
        numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'],
        benchmark: 0.3, comparison: 'gte',
      });
    });

    it('AC-7: shows a reader without write permission none of the controls', async () => {
      // Convenience, not control — `ratio.tenancy.spec.ts` proves the API refuses too.
      render(AGENT);
      await screen.findByRole('heading', { name: 'Selling success rate' });
      expect(screen.queryByRole('button', { name: 'Add a ratio' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Change who it applies to' }))
        .not.toBeInTheDocument();
    });
  });
});
