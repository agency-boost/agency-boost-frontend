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
    benchmark: 0.15, comparison: 'gte', displayUnit: 'percent', displayOrder: 1, version: 1,
    status: 'active',
    // Provisioned. Since ADR-0024 the formula is the office's to change, and the row
    // records what it was seeded with so a divergence can be named.
    origin: 'platform', appliesToOrgLevelCodes: [],
    standardNumerator: ['SELL_SUBMISSION'],
    standardDenominator: ['SELL_PRESENTATION', 'SELL_FOLLOWUP'],
    divergesFromStandard: false,
  },
  {
    id: 'r2', code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment',
    numerator: ['SELL_SUBMISSION'], denominator: ['RECRUIT_AGENT_CODE'],
    benchmark: 30, comparison: 'band', displayUnit: 'points', displayOrder: 2, version: 1,
    status: 'active',
    // The one an agent with no recruiting mandate must not be measured on (ADR-0020).
    origin: 'platform', appliesToOrgLevelCodes: ['AB', 'AAB'],
    standardNumerator: ['SELL_SUBMISSION'],
    standardDenominator: ['RECRUIT_AGENT_CODE'],
    divergesFromStandard: false,
  },
  {
    id: 'r3', code: 'REFERRAL_RATE', label: 'Referral rate',
    numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'],
    benchmark: 0.5, comparison: 'gte', displayUnit: 'decimal', displayOrder: 3, version: 1,
    status: 'active',
    // Its own, so there is no standard it could have moved away from.
    origin: 'office', appliesToOrgLevelCodes: [],
    standardNumerator: null, standardDenominator: null, divergesFromStandard: false,
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

/** The seed's two sides of the balance, each its own section — what names them on the card (P13.1-T6). */
const TWO_SECTIONS = [...TAXONOMY, {
  id: 'c2', code: 'RECRUITMENT', label: 'Recruitment', displayOrder: 2, version: 1, status: 'active',
  types: [
    { id: 't3', code: 'RECRUIT_AGENT_CODE', categoryCode: 'RECRUITMENT', label: 'Proses NPA', description: null, displayOrder: 3, version: 1, status: 'active' },
  ],
}];

function render(me = OWNER, ratios = RATIOS, taxonomy = TAXONOMY) {
  const stub = stubFetch({
    '/kpm/settings/ratio-benchmarks': { body: ratios },
    '/kpm/settings/activity-types': { body: taxonomy },
    // The provider's two reads. The ladder is the company's (ADR-0012) and this screen
    // reads it rather than owning a copy — so the test supplies it the same way.
    '/kpm/config': { body: { activity: taxonomy, ratios, leadPipelines: [], version: 1 } },
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

  it('P13.2-T6 AC-8: an office with no ratio at all says so, and offers the first one — not "every ratio is archived"', async () => {
    render(OWNER, []);
    expect(await screen.findByText('No ratios yet')).toBeInTheDocument();
    expect(screen.queryByText('Every ratio is archived')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show archived' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a ratio' })).toBeInTheDocument();
  });

  it('renders a formula as the activity types it counts, not as numbers', async () => {
    /*
     * The prototype writes these as `6 / (4+5)` — item numbers, which are unreadable and break
     * the moment somebody reorders the taxonomy. Labels, always: an Owner reads this screen
     * daily and the identity is not what they are reading it for. The code survives as the
     * fallback for a type this office no longer defines, which the next test covers.
     */
    render();
    // Several formulas count it, so the label appears more than once — which is the point.
    expect((await screen.findAllByText('Submission polis')).length).toBeGreaterThan(0);
    expect(screen.queryByText('SELL_SUBMISSION')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show codes')).not.toBeInTheDocument();
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
  });

  it('writes each benchmark in its own unit, as typed — 15%, never 15,0% — not as the stored number (P4-T25, P18.97-T3 AC-2)', async () => {
    /*
     * Every card printed the stored value, so a success rate read `0.15` where the registry
     * and the prototype both say `15.0%`. The unit comes from the API because it cannot be
     * worked out: `0.50` is a plain number on the office's own ratio.
     */
    render();
    await screen.findByRole('heading', { name: 'Selling success rate' });
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('±30 points')).toBeInTheDocument();
    // The figures in the spec's language since P18.98-T4 wired them (the harness's English is a chosen English).
    expect(screen.getByText('0.50')).toBeInTheDocument();
    expect(screen.queryByText('0,15')).not.toBeInTheDocument();
    expect(screen.queryByText('0.15')).not.toBeInTheDocument();
  });

  it('asks for a percentage the way it is shown: 15 for 15%', async () => {
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Benchmark')).toHaveValue('15');
  });

  it('re-expresses what was typed when the unit changes, rather than reinterpreting it', async () => {
    // Switching 0.5 from a number to a percentage must read 50 — the same benchmark —
    // and not quietly become 0.5%.
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[2]);
    await userEvent.selectOptions(screen.getByLabelText('Shown as'), 'percent');
    expect(screen.getByLabelText('Benchmark')).toHaveValue('50');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const card = screen.getByRole('heading', { name: /Referral rate/ }).closest('div')!.parentElement!;
    expect(within(card).getByText('50%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    expect(JSON.parse(post.init.body as string).ops[0].body)
      .toMatchObject({ benchmark: 0.5, displayUnit: 'percent' });
  });

  it('P18.95-T1 AC-3 takes a benchmark typed with a comma, as the card writes it, and shows it back with one', async () => {
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const field = screen.getByLabelText('Benchmark');
    // Text with a decimal keypad: a number field would refuse the comma and answer an empty value.
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    await userEvent.clear(field);
    await userEvent.type(field, '17,5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    // Written back in the spec's language since P18.98-T4: a point in English, the comma `indonesian.spec.tsx`'s.
    expect(await screen.findByText('17.5%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    expect(JSON.parse(post.init.body as string).ops[0].body).toMatchObject({ benchmark: 0.175 });
  });

  it('offers no unit on a band ratio, which is judged in points and nothing else', async () => {
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
    expect(screen.queryByLabelText('Shown as')).not.toBeInTheDocument();
  });

  it('sends no unit when only the number moved', async () => {
    // The row keeps a unit nobody touched; a unit riding along on every edit would make
    // the audit log say somebody chose one.
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    await userEvent.clear(screen.getByLabelText('Benchmark'));
    await userEvent.type(screen.getByLabelText('Benchmark'), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    expect(JSON.parse(post.init.body as string).ops[0].body).not.toHaveProperty('displayUnit');
  });

  it('stages a benchmark change and sends nothing until Save changes', async () => {
    /*
     * P4-T19. An Owner restructuring used to write on every Save, so their own screen
     * walked through states the publish gate only ever hid from *agents*.
     */
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const input = screen.getByLabelText('Benchmark');
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Nothing has left the browser yet — and the screen says so.
    expect(calls.some((c) => c.init.method === 'POST' && c.url.includes('changes'))).toBe(false);
    expect(screen.getByText(/1 change not saved yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
    expect(JSON.parse(post.init.body as string).ops).toEqual([{
      op: 'ratio.update',
      id: 'r1',
      expectedVersion: 1,
      // One panel, one change: the name rides along, and since ADR-0024 so does the
      // formula — on a provisioned ratio too, where sending it used to be refused.
      body: {
        label: 'Selling success rate',
        benchmark: 0.25,
        numerator: ['SELL_SUBMISSION'],
        denominator: ['SELL_PRESENTATION', 'SELL_FOLLOWUP'],
      },
    }]);
  });

  it('shows the staged benchmark on the card, not the one the office still has', async () => {
    /*
     * The defect the client reported three times as *"edit Ratio di owner masih belum
     * bisa"*. Editing was never blocked: the panel opened, Save was enabled, and the
     * change was staged correctly — the test above proves all of it by reading the request
     * body. What no test read was the card, which went on rendering the row `load()` had
     * fetched, so the reader typed 0.25, pressed Save, and 0.15 was still on screen.
     *
     * Asserted on the row rather than on the staged count: the count was already right.
     */
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const input = screen.getByLabelText('Benchmark');
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const card = screen.getByRole('heading', { name: /Selling success rate/ }).closest('div')!
      .parentElement!;
    expect(within(card).getByText('25%')).toBeInTheDocument();
    expect(within(card).queryByText('15%')).not.toBeInTheDocument();
    expect(within(card).getByText('Edited — not saved yet')).toBeInTheDocument();
  });

  it('takes one row’s edit back without discarding the others', async () => {
    // *Discard them* drops every staged change, which is not what a reader who mistyped
    // one benchmark is asking for.
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const input = screen.getByLabelText('Benchmark');
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    const card = screen.getByRole('heading', { name: /Selling success rate/ }).closest('div')!
      .parentElement!;
    expect(within(card).getByText('15%')).toBeInTheDocument();
  });

  it('collapses repeated edits to one row into a single change', async () => {
    const { calls } = render();
    for (const value of ['20', '30']) {
      await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
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
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    await userEvent.clear(screen.getByLabelText('Benchmark'));
    await userEvent.type(screen.getByLabelText('Benchmark'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard them' }));

    expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/kpm/settings/changes'))).toBe(false);
  });

  it('shows an agent the ratios and none of the controls', async () => {
    render(AGENT);
    expect(await screen.findByText('Selling success rate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  describe('two kinds of ratio, and who each is for (P4-T15)', () => {
    it('AC-6: says where a provisioned ratio came from, and that it is theirs to change', async () => {
      // It read *"its formula is fixed"* until ADR-0024. Everything on it is the office's
      // now; what the card owes the reader is where it came from.
      render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText(/Provisioned with your company’s standard/))
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

      await userEvent.selectOptions(screen.getByLabelText('Shown as'), 'percent');
      await userEvent.type(screen.getByLabelText('On track at or above'), '30');
      await userEvent.click(screen.getByRole('button', { name: 'Add the ratio' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toMatchObject({
        code: 'REFERRALS', label: 'Referrals',
        numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'],
        // Typed as 30 because it is shown as a percentage; stored as the proportion.
        benchmark: 0.3, comparison: 'gte', displayUnit: 'percent',
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

  describe('editing what a ratio counts (P4-T22)', () => {
    it('opens the formula inside Edit on every ratio, provisioned ones included', async () => {
      /*
       * The formula was editable only on an office's own ratio, and a provisioned one said
       * *"What this counts is fixed"*. ADR-0024 opened all five: the comparison that
       * argument protected reads the seeded formula, which the row records, not this one.
       */
      render();
      for (const name of ['Referral rate', 'Selling success rate']) {
        const card = (await screen.findByRole('heading', { name })).closest('div')!.parentElement!;
        await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
        expect(within(card).getByRole('group', { name: 'Counts' })).toBeInTheDocument();
        await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
      }
      expect(screen.queryByText(/What this counts is fixed/)).not.toBeInTheDocument();
    });

    it('sends a formula change on a provisioned ratio, which used to be refused', async () => {
      const { calls } = render();
      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
      const counts = within(card).getByRole('group', { name: 'Counts' });
      await userEvent.click(within(counts).getByLabelText('Presentasi penjualan'));
      await userEvent.click(within(card).getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
      expect(JSON.parse(post.init.body as string).ops[0].body.numerator)
        .toEqual(['SELL_SUBMISSION', 'SELL_PRESENTATION']);
    });

    it('names a divergence on the card, and what the office was set up with', async () => {
      /*
       * The cost ADR-0024 accepts: one office can hold two numbers under one name — its own,
       * and the platform's. A reader must be told which they are looking at rather than
       * discovering it from a dashboard that disagrees.
       */
      render(OWNER, [{
        ...RATIOS[0],
        numerator: ['SELL_PRESENTATION'],
        divergesFromStandard: true,
      }, ...RATIOS.slice(1)]);

      const card = (await screen.findByRole('heading', { name: 'Selling success rate' }))
        .closest('div')!.parentElement!;
      expect(within(card).getByText(/not your company’s standard any more/i)).toBeInTheDocument();
      // Named in labels, the way the formula above it is — never as raw codes.
      expect(within(card).getByText(/Submission polis ÷ Presentasi penjualan/)).toBeInTheDocument();
    });

    it('says nothing about a standard on a ratio the office created', async () => {
      render();
      const own = (await screen.findByRole('heading', { name: 'Referral rate' }))
        .closest('div')!.parentElement!;
      expect(within(own).queryByText(/standard/i)).not.toBeInTheDocument();
    });

    it('stages both sides together, because a ratio is one division', async () => {
      const { calls } = render();
      const own = (await screen.findByRole('heading', { name: 'Referral rate' }))
        .closest('div')!.parentElement!;
      await userEvent.click(within(own).getByRole('button', { name: 'Edit' }));

      const counts = within(own).getByRole('group', { name: 'Counts' });
      await userEvent.click(within(counts).getByLabelText('Presentasi penjualan'));
      await userEvent.click(within(own).getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
      const [op] = JSON.parse(post.init.body as string).ops;
      expect(op).toMatchObject({ op: 'ratio.update', id: 'r3' });
      expect(op.body.numerator).toContain('SELL_PRESENTATION');
      expect(op.body.denominator).toEqual(['SELL_PRESENTATION']);
    });

    it('refuses to save a side with nothing in it', async () => {
      // An empty denominator is a division by zero, and it renders as ∞ on every agent's
      // screen. The server refuses it too — this is the convenience, not the gate.
      render();
      const own = (await screen.findByRole('heading', { name: 'Referral rate' }))
        .closest('div')!.parentElement!;
      await userEvent.click(within(own).getByRole('button', { name: 'Edit' }));

      const outOf = within(own).getByRole('group', { name: 'Out of' });
      await userEvent.click(within(outOf).getByLabelText('Presentasi penjualan'));
      expect(within(own).getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  describe('a balance, offered plainly and named by what it counts (P13.1-T6)', () => {
    const cardOf = async (name: string) => (await screen.findByRole('heading', { name }))
      .closest('div')!.parentElement!;

    it('AC-8: asks for the kind first, a ratio unless a balance is chosen', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a ratio' }));

      const kind = screen.getByRole('group', { name: 'Kind' });
      const radios = within(kind).getAllByRole('radio');
      expect(radios.map((r) => r.closest('label')!.textContent)).toEqual(['Ratio (A ÷ B)', 'Balance (A vs B)']);
      expect(within(kind).getByLabelText('Ratio (A ÷ B)')).toBeChecked();
      // First in the form, ahead of the code and both lists.
      const form = kind.closest('form')!;
      const fields = [...form.querySelectorAll('fieldset, input[type="text"], input:not([type])')];
      expect(fields[0]).toBe(kind);
      expect(screen.queryByLabelText('Rule')).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Counts' })).toBeInTheDocument();
      expect(screen.getByLabelText('Shown as')).toBeInTheDocument();
    });

    it('AC-8: turns the form into a balance — two sides, no unit, and the band read as shares as it is typed', async () => {
      const { calls } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a ratio' }));
      await userEvent.click(screen.getByLabelText('Balance (A vs B)'));

      expect(screen.queryByRole('group', { name: 'Counts' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Out of' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Shown as')).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Code'), 'PRESENT_VS_SUBMIT');
      await userEvent.type(screen.getByLabelText('Name'), 'Presenting vs submitting');
      await userEvent.click(within(screen.getByRole('group', { name: 'Side A' })).getByLabelText('Presentasi penjualan'));
      await userEvent.click(within(screen.getByRole('group', { name: 'Side B' })).getByLabelText('Submission polis'));

      const benchmark = screen.getByLabelText('Within, either side');
      expect(benchmark).toHaveAccessibleDescription('Percentage points either side of an even split.');
      await userEvent.type(benchmark, '30');
      expect(benchmark).toHaveAccessibleDescription(
        'Percentage points either side of an even split: each side between 35% and 65%.',
      );
      await userEvent.clear(benchmark);
      await userEvent.type(benchmark, '25');
      expect(benchmark).toHaveAccessibleDescription(/each side between 37\.5% and 62\.5%\.$/);

      await userEvent.click(screen.getByRole('button', { name: 'Add the ratio' }));
      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toMatchObject({
        code: 'PRESENT_VS_SUBMIT', label: 'Presenting vs submitting',
        numerator: ['SELL_PRESENTATION'], denominator: ['SELL_SUBMISSION'],
        benchmark: 25, comparison: 'band', displayUnit: 'points',
      });
    });

    it('AC-8: switches back to a ratio with its own lists', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'Add a ratio' }));
      await userEvent.click(screen.getByLabelText('Balance (A vs B)'));
      await userEvent.click(screen.getByLabelText('Ratio (A ÷ B)'));
      expect(screen.getByRole('group', { name: 'Counts' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Side A' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('On track at or above')).toBeInTheDocument();
    });

    it('AC-9: names the balance’s sides by the sections its codes come from, and says how agents read it', async () => {
      render(OWNER, RATIOS, TWO_SECTIONS);
      const balance = await cardOf('Selling vs Recruitment');
      expect(within(balance).getByText('Selling')).toBeInTheDocument();
      expect(within(balance).getByText('Recruitment')).toBeInTheDocument();
      expect(within(balance).queryByText(/Selling side|Recruitment side/)).not.toBeInTheDocument();
      expect(balance).toHaveTextContent(
        'Agents see each side’s share of the two — on track while each side is between 35% and 65%.',
      );
      expect(balance).not.toHaveTextContent(/−100(,0)?%/);
    });

    it('AC-9: calls an office’s own balance’s sides Side A and Side B when both count one section', async () => {
      const own = {
        ...RATIOS[2], id: 'r4', code: 'PRESENT_VS_SUBMIT', label: 'Presenting vs submitting',
        numerator: ['SELL_PRESENTATION'], denominator: ['SELL_SUBMISSION'],
        benchmark: 20, comparison: 'band', displayUnit: 'points', displayOrder: 4,
      };
      render(OWNER, [...RATIOS, own], TWO_SECTIONS);
      const balance = await cardOf('Presenting vs submitting');
      expect(within(balance).getByText('Side A')).toBeInTheDocument();
      expect(within(balance).getByText('Side B')).toBeInTheDocument();
      expect(balance).toHaveTextContent('between 40% and 60%');
    });

    it('AC-9: calls a side whose section this office no longer has Side B, never Recruitment by default', async () => {
      // RECRUIT_AGENT_CODE is in no section of the default fixture's taxonomy.
      render();
      const balance = await cardOf('Selling vs Recruitment');
      expect(within(balance).getByText('Selling')).toBeInTheDocument();
      expect(within(balance).getByText('Side B')).toBeInTheDocument();
    });

    it('AC-8: heads a balance’s sides Side A and Side B in Edit, and reads its band live there too', async () => {
      render(OWNER, RATIOS, TWO_SECTIONS);
      const balance = await cardOf('Selling vs Recruitment');
      await userEvent.click(within(balance).getByRole('button', { name: 'Edit' }));
      expect(within(balance).getByRole('group', { name: 'Side A' })).toBeInTheDocument();
      expect(within(balance).getByRole('group', { name: 'Side B' })).toBeInTheDocument();
      expect(within(balance).getByLabelText('Benchmark')).toHaveAccessibleDescription(
        'Percentage points either side of an even split: each side between 35% and 65%.',
      );
    });
  });
});
