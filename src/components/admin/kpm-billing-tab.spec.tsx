import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { TenantRow } from '@/lib/admin';
import type { BillingTier } from '@/lib/billing';
import { atWidth, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import { KpmBillingTab } from './kpm-billing-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'billing:read_prices', 'billing:send_quote'],
});

const rp = (major: number) => major * 100;
const TIERS: BillingTier[] = [
  { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), sixMonthMinor: rp(400_000), annualMinor: rp(380_000), customPricing: false },
  { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), sixMonthMinor: rp(375_000), annualMinor: rp(356_250), customPricing: false },
  { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), sixMonthMinor: rp(350_000), annualMinor: rp(332_500), customPricing: false },
  { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), sixMonthMinor: rp(300_000), annualMinor: rp(285_000), customPricing: false },
  { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: rp(375_000), sixMonthMinor: rp(250_000), annualMinor: rp(237_500), customPricing: true },
];
const PRICES = { currency: 'IDR', tiers: TIERS, annualDiscountPct: 5 };

/** KPM 0417, its Owner Rina, 8 leaders used and no plan: the calculator opens as the prototype's page did. */
const KPM = {
  _id: 'kpm-1', companyId: 'co-1', companyName: 'Prudential', code: '0417', branchName: 'BSD City Branch',
  address: null, contactPhone: null, ownerUserId: 'u-owner', ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null, suspendedReason: null,
  createdAt: '2026-09-01T00:00:00.000Z', settings: {}, fiscalYearStartMonth: 1,
  subscription: null, leadersUsed: 8, subscriptionState: 'none',
} as unknown as TenantRow;
const KPM_NAME = 'KPM 0417 · BSD City Branch';

/** The tab alone, as the KPM page mounts it at `?tab=billing`. */
function renderPage(
  routes: Parameters<typeof stubFetch>[0] = { '/admin/billing/prices': { body: PRICES } },
  kpm: TenantRow = KPM,
) {
  const fetched = stubFetch(routes);
  renderWithSession(<KpmBillingTab kpm={kpm} />, { me: SUPER_ADMIN });
  return fetched;
}

const cards = () => within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
const row = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
const leaders = () => screen.getByLabelText('Number of leaders');
const discount = () => screen.getByLabelText('Arbitrary discount (internal, per leader)');

async function setLeaders(n: string) {
  await userEvent.clear(leaders());
  if (n) await userEvent.type(leaders(), n);
}

/** *Name of KPM* is the KPM's, read-only; *Name of PIC* starts as the Owner's. */
async function fillDialog({ pic = 'Andi Wijaya', sales = 'Maya' } = {}) {
  const dialog = screen.getByRole('dialog', { name: 'Send quote' });
  const picField = within(dialog).getByLabelText('Name of PIC');
  await userEvent.clear(picField);
  if (pic) await userEvent.type(picField, pic);
  if (sales) await userEvent.type(within(dialog).getByLabelText('Sales input by'), sales);
  return dialog;
}

beforeEach(() => {
  // 01:30 on 8 October in Jakarta: still the 7th in UTC. Only the clock is faked; timers stay real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T18:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/*
 * **The quote tool, moved to a KPM's *Billing* tab** (P19.4-T3 AC-10; ADR-0211 §4): P13.2-T2's tests of the calculator,
 * the dialog, the quote and its print, now on the tab, followed by what the move adds — the KPM's own leaders and plan,
 * the dialog naming the KPM and its Owner, and *Send to {Owner}*.
 */
describe('the quote tool, on a KPM’s Billing tab (P13.2-T2, moved by P19.4-T3)', () => {
  describe('AC-4: the screen, verbatim', () => {
    it('draws the five cards, each with the six-month rate', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      expect(cards().map((c) => c.textContent)).toEqual([
        '1–10 leadersIDR 500,000/moIDR 400,000 /leader/moSave 20%Your tier',
        '11–20 leadersIDR 475,000/moIDR 375,000 /leader/moSave 21%',
        '21–50 leadersIDR 450,000/moIDR 350,000 /leader/moSave 22%',
        '51–100 leadersIDR 425,000/moIDR 300,000 /leader/moSave 29%',
        "101+ leadersCustom pricing based on your unit's structure.Talk to us",
      ]);
      // The 101+ tier's rates are never on a card.
      expect(cards()[4]).not.toHaveTextContent(/Rp|IDR/);
    });

    it('keeps the six-month rate on the cards on Annual, and moves *Your tier* with the count', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      expect(cards()[0]).toHaveTextContent('IDR 400,000 /leader/mo');

      await setLeaders('21');
      expect(cards()[0]).not.toHaveTextContent('Your tier');
      expect(cards()[2]).toHaveTextContent('Your tier');
      await setLeaders('101');
      expect(cards()[4]).toHaveTextContent('Your tier');
    });

    it('prices the page as it opens: 8 leaders, six months, no discount', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      expect(leaders()).toHaveValue(8);
      expect(screen.getByText(/falls in the/)).toHaveTextContent('8 leaders falls in the 1–10 tier.');
      expect(row('Standard price / leader / mo')).toHaveTextContent('IDR 500,000');
      expect(row('Offering price / leader / mo')).toHaveTextContent('IDR 400,000');
      expect(screen.queryByText('Offering price after discount / leader / mo')).not.toBeInTheDocument();
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 3,200,000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('IDR 19,200,000');
      expect(screen.getByRole('button', { name: '6-month' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Discounts applied')).toBeInTheDocument();
      expect(screen.getByText('Prices shown in IDR, per leader. Agents under each leader are included at no extra cost.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm plan' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send quote' })).toBeInTheDocument();
    });

    it('on Annual shows the offer after discount, the annual total and the annual discount', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));

      expect(screen.getByRole('button', { name: 'Annual' })).toHaveAttribute('aria-pressed', 'true');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('IDR 380,000');
      // The six-month offer is struck through whenever the row below it shows.
      expect(row('Offering price / leader / mo').querySelector('s')).toHaveTextContent('IDR 400,000');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 3,040,000');
      expect(row('Annual total (all leaders)')).toHaveTextContent('IDR 36,480,000');
      expect(screen.getByText('Annual discount (extra 5% off 6-month rate)')).toBeInTheDocument();
      expect(screen.getByText('-IDR 20,000/leader/mo')).toBeInTheDocument();
    });

    it('says the annual discount is not applied on six months, with the toggle above (a Fix)', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      expect(screen.getByText('Annual discount')).toBeInTheDocument();
      expect(screen.getByText('Not applied — switch to Annual above')).toBeInTheDocument();
      expect(screen.queryByText(/switch to Annual below/)).not.toBeInTheDocument();
    });

    it('reads one leader in the singular, a count below 1 as 1, and 101 as the custom tier', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      await setLeaders('1');
      expect(screen.getByText(/falls in the/)).toHaveTextContent('1 leader falls in the 1–10 tier.');
      await setLeaders('');
      expect(screen.getByText(/falls in the/)).toHaveTextContent('1 leader falls in the 1–10 tier.');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 400,000');

      await setLeaders('120');
      expect(screen.getByText(/falls in the/)).toHaveTextContent(
        '120 leaders falls in the 101+ tier — shown as "custom pricing" publicly, real rate calculated below for your own quoting.',
      );
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 30,000,000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('IDR 180,000,000');
      expect(screen.getByRole('button', { name: 'Send custom quote' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
    });
  });

  describe('AC-5: the manual override and its Fixes', () => {
    it('opens closed, applies a percent, and reads a decimal comma as a decimal', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      const details = screen.getByText('Manual override').closest('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);

      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      await userEvent.clear(discount());
      await userEvent.type(discount(), '10');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('IDR 342,000');
      expect(row('Annual total (all leaders)')).toHaveTextContent('IDR 32,832,000');

      await userEvent.clear(discount());
      await userEvent.type(discount(), '10,5');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('IDR 340,100');
    });

    it('sets the value to 0 when the type changes, and groups an amount as it is typed', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));

      await userEvent.clear(discount());
      await userEvent.type(discount(), '50');
      await userEvent.selectOptions(screen.getByLabelText('Discount type'), 'IDR/leader');
      expect(discount()).toHaveValue('0');

      await setLeaders('15');
      await userEvent.clear(discount());
      await userEvent.type(discount(), '25000');
      expect(discount()).toHaveValue('25,000');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('IDR 350,000');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 5,250,000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('IDR 31,500,000');
    });

    it('refuses a percent above 100 with a sentence, prices without it, and generates nothing', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.clear(discount());
      await userEvent.type(discount(), '150');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a percent from 0 to 100.');
      expect(discount()).toHaveAttribute('aria-invalid', 'true');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('IDR 3,200,000');

      // Close the disclosure, then press each way into the dialog: none opens it.
      await userEvent.click(screen.getByText('Manual override'));
      for (const name of ['Confirm plan', 'Send quote', 'Talk to us']) {
        await userEvent.click(screen.getByRole('button', { name }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // The disclosure is opened again and the field holding the reason takes the focus.
        expect((screen.getByText('Manual override').closest('details') as HTMLDetailsElement).open).toBe(true);
        await waitFor(() => expect(discount()).toHaveFocus());
      }
    });

    it('refuses an amount above the rate, naming the rate', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.selectOptions(screen.getByLabelText('Discount type'), 'IDR/leader');
      await userEvent.clear(discount());
      await userEvent.type(discount(), '400001');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount from IDR 0 to IDR 400,000.');
    });

    it.each(['Confirm plan', 'Send quote', 'Talk to us'])('%s opens the dialog (a Fix: two of them did nothing)', async (name) => {
      renderPage();
      await screen.findByText('Estimate your price');

      await userEvent.click(screen.getByRole('button', { name }));

      expect(screen.getByRole('dialog', { name: 'Send quote' })).toBeInTheDocument();
    });

    it('Send custom quote opens the dialog from 101 leaders', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await setLeaders('150');

      await userEvent.click(screen.getByRole('button', { name: 'Send custom quote' }));

      expect(screen.getByRole('dialog', { name: 'Send quote' })).toBeInTheDocument();
    });
  });

  /*
   * **P19.2-T2 AC-4 — the discount type with no native select below 1024px** (UI-134: *No native <select> on /admin at
   * 375 or 768*; *Desktop may keep selects*): a pill saying the type, opening its two choices; a change still sets the
   * value to 0, as the select's Fix does (`billing/editor.tsx`).
   */
  describe('P19.2-T2 AC-4 the discount type below 1024px (UI-134)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each([375, 768])('P19.2-T2 AC-4 at %ipx the discount type is a 44px pill; a choice sets the value to 0', async (px) => {
      atWidth(px);
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      expect(document.querySelector('select')).toBeNull();
      await userEvent.clear(discount());
      await userEvent.type(discount(), '50');
      const pill = screen.getByRole('button', { name: 'Discount type: %' });
      expect(wears(pill, px)).toContain('min-h-11');
      await userEvent.click(pill);
      const sheet = await screen.findByRole('dialog', { name: 'Choose discount type' });
      expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['%', 'IDR/leader']);
      await userEvent.click(within(sheet).getByRole('radio', { name: 'IDR/leader' }));
      expect(discount()).toHaveValue('0');
      expect(screen.getByRole('button', { name: 'Discount type: IDR/leader' })).toBeInTheDocument();
    });

    it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx a laptop keeps the discount type’s select', async (px) => {
      atWidth(px);
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      expect(screen.getByLabelText('Discount type').tagName).toBe('SELECT');
    });
  });

  describe('AC-6: the dialog', () => {
    it('draws the prototype’s fields and placeholders, the dates from the office’s today', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));

      const dialog = screen.getByRole('dialog', { name: 'Send quote' });
      expect(dialog).toHaveAccessibleDescription('Fill in the client details to generate a quote page you can send.');
      // P19.4-T3 AC-10 (ADR-0211 §4): the dialog names the KPM — read-only — and its Owner.
      expect(within(dialog).getByLabelText('Name of KPM')).toHaveValue(KPM_NAME);
      expect(within(dialog).getByLabelText('Name of KPM')).toHaveAttribute('readonly');
      expect(within(dialog).getByLabelText('Name of PIC')).toHaveValue('Rina Wijaya');
      expect(within(dialog).getByLabelText('Name of PIC')).toHaveAttribute('placeholder', 'e.g. Andi Wijaya');
      expect(within(dialog).getByLabelText('Sales input by')).toHaveAttribute('placeholder', 'e.g. your name or teammate');
      // 8 October in Jakarta + 7 days; six months less a day.
      expect(within(dialog).getByLabelText('Start date')).toHaveValue('15/10/2026');
      expect(within(dialog).getByLabelText('Start date')).toHaveAttribute('placeholder', 'DD/MM/YYYY');
      expect(within(dialog).getByLabelText('End date')).toHaveValue('14/04/2027');
      expect(within(dialog).getByRole('button', { name: 'Generate quote' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('ends an annual plan a year less a day after the start (a Fix: the prototype always added a year)', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));

      expect(screen.getByLabelText('End date')).toHaveValue('14/10/2027');
    });

    it('inserts the slashes as a date is typed, and the end follows the start until it is edited', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      const start = screen.getByLabelText('Start date');
      const end = screen.getByLabelText('End date');

      await userEvent.clear(start);
      await userEvent.type(start, '01112026');
      expect(start).toHaveValue('01/11/2026');
      expect(end).toHaveValue('30/04/2027');

      await userEvent.clear(end);
      await userEvent.type(end, '31122027');
      await userEvent.clear(start);
      await userEvent.type(start, '01122026');
      expect(end).toHaveValue('31/12/2027');
    });

    it('refuses empty names, an impossible date and an end before the start, each with its sentence', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.clear(within(dialog).getByLabelText('Start date'));
      await userEvent.type(within(dialog).getByLabelText('Start date'), '31022027');

      await userEvent.clear(within(dialog).getByLabelText('Name of PIC'));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Generate quote' }));

      // The KPM's own name is never empty here.
      expect(within(dialog).queryByText('Enter the KPM name.')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Enter the PIC name.')).toBeInTheDocument();
      expect(within(dialog).getByText("Enter who's submitting this quote.")).toBeInTheDocument();
      expect(within(dialog).getByText('Enter a valid start date, as DD/MM/YYYY.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name of PIC')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).getByLabelText('Name of PIC')).toHaveFocus();

      await fillDialog();
      await userEvent.clear(within(dialog).getByLabelText('Start date'));
      await userEvent.type(within(dialog).getByLabelText('Start date'), '01122026');
      await userEvent.clear(within(dialog).getByLabelText('End date'));
      await userEvent.type(within(dialog).getByLabelText('End date'), '30112026');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Generate quote' }));

      expect(within(dialog).getByText('Enter an end date on or after the start date.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('End date')).toHaveFocus();
      expect(screen.queryByText('Subscription quote')).not.toBeInTheDocument();
    });

    it('reopening keeps the three names, clears old errors and starts the dates again', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      await fillDialog({ pic: '', sales: '' });
      await userEvent.clear(screen.getByLabelText('Start date'));
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      expect(screen.getByText('Enter the PIC name.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));

      expect(screen.getByLabelText('Name of KPM')).toHaveValue(KPM_NAME);
      expect(screen.queryByText('Enter the PIC name.')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Start date')).toHaveValue('15/10/2026');
    });

    it('closes on Escape, as the product’s Modal does', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('AC-7: the quote', () => {
    async function generate(setup?: () => Promise<void>) {
      renderPage();
      await screen.findByText('Estimate your price');
      await setup?.();
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      await fillDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      return screen.getByRole('article');
    }

    it('replaces the editor with the quote, generated on the office’s today, the discounts hidden when none applies', async () => {
      const quote = await generate();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Estimate your price')).not.toBeVisible();
      expect(within(quote).getByRole('heading', { name: 'Subscription quote' })).toHaveFocus();
      // The paper writes its dates as every screen does (ADR-0167 §1); the dialog's fields keep DD/MM/YYYY.
      expect(quote).toHaveTextContent('Generated 8 Oct 2026');
      for (const [label, value] of [
        ['KPM', KPM_NAME], ['Person in charge (PIC)', 'Andi Wijaya'], ['Plan start date', '15 Oct 2026'],
        ['Plan end date', '14 Apr 2027'], ['Sales input by', 'Maya'],
      ]) {
        expect(within(quote).getByText(label).nextElementSibling).toHaveTextContent(value);
      }
      expect(within(quote).getByText('Plan details')).toBeInTheDocument();
      expect(within(quote).getByText('Tier').nextElementSibling).toHaveTextContent('1–10 leaders');
      expect(within(quote).getByText('Leaders on plan').nextElementSibling).toHaveTextContent('8');
      expect(within(quote).getByText('Billing period').nextElementSibling).toHaveTextContent('6-month plan');
      expect(within(quote).getByText('Standard price / leader / mo').nextElementSibling).toHaveTextContent('IDR 500,000');
      expect(within(quote).getByText('Offering price / leader / mo').nextElementSibling).toHaveTextContent('IDR 400,000');
      expect(within(quote).queryByText('Discounts')).not.toBeInTheDocument();
      expect(within(quote).queryByText('Annual discount')).not.toBeInTheDocument();
      expect(within(quote).getByText('Final price / leader / mo').nextElementSibling).toHaveTextContent('IDR 400,000');
      expect(within(quote).getByText('Total')).toBeInTheDocument();
      expect(within(quote).getByText('Monthly total (all leaders)').nextElementSibling).toHaveTextContent('IDR 3,200,000');
      expect(within(quote).getByText('6-month total (all leaders)').nextElementSibling).toHaveTextContent('IDR 19,200,000');
      expect(quote).toHaveTextContent(
        "This quote is valid for the plan period shown above. Rate is locked for the duration of the subscription under AgencyBoost's launch pricing, valid for signups before Mar 2027.",
      );
    });

    it('lists both discounts on an annual plan with a manual one, and the 13-leader case’s exact totals', async () => {
      const quote = await generate(async () => {
        await setLeaders('13');
        await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
        await userEvent.click(screen.getByText('Manual override'));
        await userEvent.clear(discount());
        await userEvent.type(discount(), '7');
      });

      expect(within(quote).getByText('Discounts')).toBeInTheDocument();
      expect(within(quote).getByText('Tier').nextElementSibling).toHaveTextContent('11–20 leaders');
      expect(within(quote).getByText('Billing period').nextElementSibling).toHaveTextContent('Annual plan');
      expect(within(quote).getByText('Annual discount').nextElementSibling).toHaveTextContent('-IDR 18,750/leader/mo');
      expect(within(quote).getByText('Manual discount').nextElementSibling).toHaveTextContent('-IDR 24,937/leader/mo');
      expect(within(quote).getByText('Final price / leader / mo').nextElementSibling).toHaveTextContent('IDR 331,313');
      // 13 × IDR 331,313, exactly — the prototype printed IDR 4,307,063 (ADR-0111 §4).
      expect(within(quote).getByText('Monthly total (all leaders)').nextElementSibling).toHaveTextContent('IDR 4,307,069');
      expect(within(quote).getByText('Annual total (all leaders)').nextElementSibling).toHaveTextContent('IDR 51,684,828');
    });

    it('marks the 101+ tier custom on the quote', async () => {
      const quote = await generate(() => setLeaders('120'));

      expect(within(quote).getByText('Tier').nextElementSibling).toHaveTextContent('101+ leaders (custom)');
    });

    it('Back to editor returns to the calculator as it was', async () => {
      await generate(async () => {
        await setLeaders('15');
        await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      });

      await userEvent.click(screen.getByRole('button', { name: 'Back to editor' }));

      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(screen.getByText('Estimate your price')).toBeVisible();
      expect(leaders()).toHaveValue(15);
      expect(screen.getByRole('button', { name: 'Annual' })).toHaveAttribute('aria-pressed', 'true');
      // The focus goes back to the button that opened the dialog.
      expect(screen.getByRole('button', { name: 'Send quote' })).toHaveFocus();
    });
  });

  describe('AC-8: Print / save as PDF', () => {
    it('prints the title, the launch line and the quote, and nothing else, under the quote’s name', async () => {
      const print = vi.fn();
      vi.stubGlobal('print', print);
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      await fillDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      const before = document.title;

      await userEvent.click(screen.getByRole('button', { name: 'Print / save as PDF' }));

      expect(print).toHaveBeenCalledTimes(1);
      expect(document.title).toBe(`Subscription quote – ${KPM_NAME}`);
      const paper = document.body.querySelector(':scope > [data-print-view]') as HTMLElement;
      expect(paper).not.toBeNull();
      // Off the screen, on the paper.
      expect(paper).toHaveClass('hidden', 'print:block');
      expect(paper).toHaveTextContent('Billing & subscription');
      expect(paper).toHaveTextContent('Launch pricing — locked in for signups before Mar 2027.');
      expect(paper).toHaveTextContent('Subscription quote');
      expect(paper).toHaveTextContent('IDR 19,200,000');
      expect(within(paper).queryAllByRole('button', { hidden: true })).toEqual([]);
      // On the screen the buttons are hidden from a print too.
      expect(screen.getByRole('button', { name: 'Print / save as PDF' }).parentElement).toHaveClass('print:hidden');

      act(() => {
        window.dispatchEvent(new Event('afterprint'));
      });
      expect(document.body.querySelector(':scope > [data-print-view]')).toBeNull();
      expect(document.title).toBe(before);
    });
  });

  describe('AC-9: nothing is stored', () => {
    it('makes one request, the prices read, through a whole quote and its print — nothing is sent unless asked', async () => {
      vi.stubGlobal('print', vi.fn());
      const { calls } = renderPage();
      await screen.findByText('Estimate your price');

      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.clear(discount());
      await userEvent.type(discount(), '5');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm plan' }));
      await fillDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      await userEvent.click(screen.getByRole('button', { name: 'Print / save as PDF' }));
      act(() => {
        window.dispatchEvent(new Event('afterprint'));
      });
      await userEvent.click(screen.getByRole('button', { name: 'Back to editor' }));

      expect(calls.map((c) => [c.init.method ?? 'GET', new URL(c.url).pathname])).toEqual([
        ['GET', '/api/v1/admin/billing/prices'],
      ]);
    });
  });

  describe('AC-10: states', () => {
    it('shows a skeleton while the prices are read, named for a screen reader', async () => {
      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent('Loading prices…');
      expect(await screen.findByText('Estimate your price')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('says the prices could not be read, prices nothing, and tries again', async () => {
      const { calls } = renderPage({
        '/admin/billing/prices': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-9' } } },
          { body: PRICES },
        ],
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("The prices couldn't be loaded, so nothing can be priced.");
      expect(alert).toHaveTextContent('INTERNAL_ERROR · req-9');
      expect(screen.queryByText('Estimate your price')).not.toBeInTheDocument();
      expect(screen.queryByText(/Rp|IDR/)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('Estimate your price')).toBeInTheDocument();
      expect(calls).toHaveLength(2);
    });

  });
});

describe('P19.4-T3 AC-10 the KPM’s own Billing tab (ADR-0211 §4, §5; SA UI-015)', () => {
  it('P19.4-T3 AC-10 opens filled with the KPM’s leaders used and its plan', async () => {
    renderPage(undefined, { ...KPM, leadersUsed: 13, subscription: { plan: 'annual' } } as unknown as TenantRow);
    await screen.findByText('Estimate your price');
    expect(leaders()).toHaveValue(13);
    expect(screen.getByRole('button', { name: 'Annual' })).toHaveAttribute('aria-pressed', 'true');
    expect(cards()[1]).toHaveTextContent('Your tier');
    expect(row('Annual total (all leaders)')).toHaveTextContent('IDR 55,575,000');
  });

  it('P19.4-T3 AC-10 a KPM with no leader yet is priced for one', async () => {
    renderPage(undefined, { ...KPM, leadersUsed: 0 } as unknown as TenantRow);
    await screen.findByText('Estimate your price');
    expect(leaders()).toHaveValue(1);
  });

  async function generateQuote(setup?: () => Promise<void>) {
    await screen.findByText('Estimate your price');
    await setup?.();
    await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await fillDialog({ pic: 'Rina Wijaya' });
    await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
    return screen.getByRole('article');
  }

  it('P19.4-T3 AC-10 Send to the Owner posts the inputs, never a figure, and says who received it', async () => {
    const { calls } = renderPage({
      '/admin/billing/prices': { body: PRICES },
      'POST /admin/tenants/kpm-1/quote': {
        body: { kpmId: 'kpm-1', recipient: { fullName: 'Rina Wijaya' }, pricing: { periodTotalMinor: 51_684_828_00 } },
      },
    });
    await generateQuote(async () => {
      await setLeaders('13');
      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.clear(discount());
      await userEvent.type(discount(), '7,5');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Send to Rina Wijaya' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Quote sent to Rina Wijaya, by email and in the app.');
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(new URL(post.url).pathname).toBe('/api/v1/admin/tenants/kpm-1/quote');
    // The typed comma is a decimal point; the dates office dates; no total, no rate.
    expect(JSON.parse(post.init.body as string)).toEqual({
      leaders: 13, plan: 'annual', discount: { type: 'percent', percent: '7.5' },
      startDate: '2026-10-15', endDate: '2027-10-14', pic: 'Rina Wijaya', salesBy: 'Maya',
    });
    // Sent once: the button is spent.
    expect(screen.getByRole('button', { name: 'Send to Rina Wijaya' })).toBeDisabled();
  });

  it('P19.4-T3 AC-10 sends an amount as the sen it took off, and no discount as none', async () => {
    const { calls } = renderPage({
      '/admin/billing/prices': { body: PRICES },
      'POST /admin/tenants/kpm-1/quote': { body: { kpmId: 'kpm-1', recipient: { fullName: 'Rina Wijaya' }, pricing: {} } },
    });
    await generateQuote(async () => {
      await setLeaders('15');
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.selectOptions(screen.getByLabelText('Discount type'), 'IDR/leader');
      await userEvent.clear(discount());
      await userEvent.type(discount(), '25000');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Send to Rina Wijaya' }));
    await screen.findByText(/Quote sent to/);
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string)).toMatchObject({
      leaders: 15, plan: 'six_months', discount: { type: 'flat', amountMinor: 25_000_00 },
    });
  });

  it('P19.4-T3 AC-10 shows the refusal when the Owner cannot receive it, and keeps the quote to print', async () => {
    renderPage({
      '/admin/billing/prices': { body: PRICES },
      'POST /admin/tenants/kpm-1/quote': {
        status: 409,
        body: { error: {
          code: 'BILLING_QUOTE_NO_OWNER', requestId: 'req-4', details: { kpmId: 'kpm-1', reason: 'unverified' },
          message: 'The Owner has not verified their email address, so the quote cannot be sent to it. Print it or save it as a PDF instead.',
        } },
      },
    });
    await generateQuote();
    await userEvent.click(screen.getByRole('button', { name: 'Send to Rina Wijaya' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Print it or save it as a PDF instead.');
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print / save as PDF' })).toBeEnabled();
  });

  it('P19.4-T3 AC-10 a KPM with no Owner offers no send — the quote prints', async () => {
    renderPage(undefined, { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null } as unknown as TenantRow);
    await generateQuote();
    expect(screen.queryByRole('button', { name: /^Send to/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print / save as PDF' })).toBeInTheDocument();
  });

  it.each([375, 1280])('P19.4-T3 AC-10 at %ipx the cards wrap and every control is reachable', async (px) => {
    renderPage();
    await screen.findByText('Estimate your price');
    expect(screen.getAllByRole('list')[0]).toHaveClass('grid-cols-[repeat(auto-fit,minmax(170px,1fr))]');
    // The estimate's padding steps up from a phone to a laptop.
    const estimate = screen.getByRole('region', { name: 'Estimate your price' });
    expect(wears(estimate, px)).toContain(px >= 768 ? 'p-7' : 'p-5');
    expect(screen.getByRole('button', { name: 'Send quote' })).toBeVisible();
  });

  it('P19.4-T3 AC-10 the editor, the dialog and the quote with its send pass axe', async () => {
    renderPage();
    await screen.findByText('Estimate your price');
    const clean = async (name: string) => {
      // Rendered alone, outside the KPM page's landmarks: `region` is the page's to pass (`screens.a11y.spec.tsx`).
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect((results.violations ?? []).map((v) => `${name}: ${v.id}`)).toEqual([]);
    };
    await clean('the editor');
    await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await clean('the dialog');
    await fillDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
    await clean('the quote');
  });
});
