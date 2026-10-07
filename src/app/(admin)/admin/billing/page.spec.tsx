import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import type { BillingTier } from '@/lib/billing';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import BillingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/billing',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `kpm:list_all` is the console's gate; `billing:read_prices` this route's own.
  permissions: ['kpm:list_all', 'billing:read_prices'],
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
const INBOX = { items: [], total: 0, page: 1, pageSize: 1, unread: 0 };

/** The page alone: its only request is its own, so AC-9 can count them. */
function renderPage(routes: Parameters<typeof stubFetch>[0] = { '/admin/billing/prices': { body: PRICES } }) {
  const fetched = stubFetch(routes);
  renderWithSession(<BillingPage />, { me: SUPER_ADMIN });
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

async function fillDialog({ kpm = 'Jakarta Selatan', pic = 'Andi Wijaya', sales = 'Maya' } = {}) {
  const dialog = screen.getByRole('dialog', { name: 'Send quote' });
  if (kpm) await userEvent.type(within(dialog).getByLabelText('Name of KPM'), kpm);
  if (pic) await userEvent.type(within(dialog).getByLabelText('Name of PIC'), pic);
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

describe('the quote tool (P13.2-T2)', () => {
  describe('AC-4: the screen, verbatim', () => {
    it('draws the header, the launch line and the five cards, each with the six-month rate', async () => {
      renderPage();

      expect(screen.getByRole('heading', { level: 1, name: 'Billing & subscription' })).toBeInTheDocument();
      expect(screen.getByText('Launch pricing — locked in for signups before March 2027.')).toBeInTheDocument();
      await screen.findByText('Estimate your price');

      expect(cards().map((c) => c.textContent)).toEqual([
        '1–10 leadersRp 500.000/moRp 400.000 /leader/moSave 20%Your tier',
        '11–20 leadersRp 475.000/moRp 375.000 /leader/moSave 21%',
        '21–50 leadersRp 450.000/moRp 350.000 /leader/moSave 22%',
        '51–100 leadersRp 425.000/moRp 300.000 /leader/moSave 29%',
        "101+ leadersCustom pricing based on your unit's structure.Talk to us",
      ]);
      // The 101+ tier's rates are never on a card.
      expect(cards()[4]).not.toHaveTextContent('Rp');
    });

    it('keeps the six-month rate on the cards on Annual, and moves *Your tier* with the count', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      await userEvent.click(screen.getByRole('button', { name: 'Annual' }));
      expect(cards()[0]).toHaveTextContent('Rp 400.000 /leader/mo');

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
      expect(row('Standard price / leader / mo')).toHaveTextContent('Rp 500.000');
      expect(row('Offering price / leader / mo')).toHaveTextContent('Rp 400.000');
      expect(screen.queryByText('Offering price after discount / leader / mo')).not.toBeInTheDocument();
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 3.200.000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('Rp 19.200.000');
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
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('Rp 380.000');
      // The six-month offer is struck through whenever the row below it shows.
      expect(row('Offering price / leader / mo').querySelector('s')).toHaveTextContent('Rp 400.000');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 3.040.000');
      expect(row('Annual total (all leaders)')).toHaveTextContent('Rp 36.480.000');
      expect(screen.getByText('Annual discount (extra 5% off 6-month rate)')).toBeInTheDocument();
      expect(screen.getByText('-Rp 20.000/leader/mo')).toBeInTheDocument();
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
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 400.000');

      await setLeaders('120');
      expect(screen.getByText(/falls in the/)).toHaveTextContent(
        '120 leaders falls in the 101+ tier — shown as "custom pricing" publicly, real rate calculated below for your own quoting.',
      );
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 30.000.000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('Rp 180.000.000');
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
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('Rp 342.000');
      expect(row('Annual total (all leaders)')).toHaveTextContent('Rp 32.832.000');

      await userEvent.clear(discount());
      await userEvent.type(discount(), '10,5');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('Rp 340.100');
    });

    it('sets the value to 0 when the type changes, and groups an amount as it is typed', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));

      await userEvent.clear(discount());
      await userEvent.type(discount(), '50');
      await userEvent.selectOptions(screen.getByLabelText('Discount type'), 'Rp/leader');
      expect(discount()).toHaveValue('0');

      await setLeaders('15');
      await userEvent.clear(discount());
      await userEvent.type(discount(), '25000');
      expect(discount()).toHaveValue('25.000');
      expect(row('Offering price after discount / leader / mo')).toHaveTextContent('Rp 350.000');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 5.250.000');
      expect(row('6-month total (all leaders)')).toHaveTextContent('Rp 31.500.000');
    });

    it('refuses a percent above 100 with a sentence, prices without it, and generates nothing', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      await userEvent.clear(discount());
      await userEvent.type(discount(), '150');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a percent from 0 to 100.');
      expect(discount()).toHaveAttribute('aria-invalid', 'true');
      expect(row('Monthly total (all leaders)')).toHaveTextContent('Rp 3.200.000');

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
      await userEvent.selectOptions(screen.getByLabelText('Discount type'), 'Rp/leader');
      await userEvent.clear(discount());
      await userEvent.type(discount(), '400001');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount from Rp 0 to Rp 400.000.');
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

  describe('AC-6: the dialog', () => {
    it('draws the prototype’s fields and placeholders, the dates from the office’s today', async () => {
      renderPage();
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));

      const dialog = screen.getByRole('dialog', { name: 'Send quote' });
      expect(dialog).toHaveAccessibleDescription('Fill in the client details to generate a quote page you can send.');
      expect(within(dialog).getByLabelText('Name of KPM')).toHaveAttribute('placeholder', 'e.g. Jakarta Selatan');
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

      await userEvent.click(within(dialog).getByRole('button', { name: 'Generate quote' }));

      expect(within(dialog).getByText('Enter the KPM name.')).toBeInTheDocument();
      expect(within(dialog).getByText('Enter the PIC name.')).toBeInTheDocument();
      expect(within(dialog).getByText("Enter who's submitting this quote.")).toBeInTheDocument();
      expect(within(dialog).getByText('Enter a valid start date, as DD/MM/YYYY.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name of KPM')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).getByLabelText('Name of KPM')).toHaveFocus();

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

      expect(screen.getByLabelText('Name of KPM')).toHaveValue('Jakarta Selatan');
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
      expect(quote).toHaveTextContent('Generated 08/10/2026');
      for (const [label, value] of [
        ['KPM', 'Jakarta Selatan'], ['Person in charge (PIC)', 'Andi Wijaya'], ['Plan start date', '15/10/2026'],
        ['Plan end date', '14/04/2027'], ['Sales input by', 'Maya'],
      ]) {
        expect(within(quote).getByText(label).nextElementSibling).toHaveTextContent(value);
      }
      expect(within(quote).getByText('Plan details')).toBeInTheDocument();
      expect(within(quote).getByText('Tier').nextElementSibling).toHaveTextContent('1–10 leaders');
      expect(within(quote).getByText('Leaders on plan').nextElementSibling).toHaveTextContent('8');
      expect(within(quote).getByText('Billing period').nextElementSibling).toHaveTextContent('6-month plan');
      expect(within(quote).getByText('Standard price / leader / mo').nextElementSibling).toHaveTextContent('Rp 500.000');
      expect(within(quote).getByText('Offering price / leader / mo').nextElementSibling).toHaveTextContent('Rp 400.000');
      expect(within(quote).queryByText('Discounts')).not.toBeInTheDocument();
      expect(within(quote).queryByText('Annual discount')).not.toBeInTheDocument();
      expect(within(quote).getByText('Final price / leader / mo').nextElementSibling).toHaveTextContent('Rp 400.000');
      expect(within(quote).getByText('Total')).toBeInTheDocument();
      expect(within(quote).getByText('Monthly total (all leaders)').nextElementSibling).toHaveTextContent('Rp 3.200.000');
      expect(within(quote).getByText('6-month total (all leaders)').nextElementSibling).toHaveTextContent('Rp 19.200.000');
      expect(quote).toHaveTextContent(
        "This quote is valid for the plan period shown above. Rate is locked for the duration of the subscription under AgencyBoost's launch pricing, valid for signups before March 2027.",
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
      expect(within(quote).getByText('Annual discount').nextElementSibling).toHaveTextContent('-Rp 18.750/leader/mo');
      expect(within(quote).getByText('Manual discount').nextElementSibling).toHaveTextContent('-Rp 24.937/leader/mo');
      expect(within(quote).getByText('Final price / leader / mo').nextElementSibling).toHaveTextContent('Rp 331.313');
      // 13 × Rp 331.313, exactly — the prototype printed Rp 4.307.063 (ADR-0111 §4).
      expect(within(quote).getByText('Monthly total (all leaders)').nextElementSibling).toHaveTextContent('Rp 4.307.069');
      expect(within(quote).getByText('Annual total (all leaders)').nextElementSibling).toHaveTextContent('Rp 51.684.828');
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
      expect(document.title).toBe('Subscription quote – Jakarta Selatan');
      const paper = document.body.querySelector(':scope > [data-print-view]') as HTMLElement;
      expect(paper).not.toBeNull();
      // Off the screen, on the paper.
      expect(paper).toHaveClass('hidden', 'print:block');
      expect(paper).toHaveTextContent('Billing & subscription');
      expect(paper).toHaveTextContent('Launch pricing — locked in for signups before March 2027.');
      expect(paper).toHaveTextContent('Subscription quote');
      expect(paper).toHaveTextContent('Rp 19.200.000');
      expect(within(paper).queryAllByRole('button', { hidden: true })).toEqual([]);
      // On the screen the two buttons are hidden from a print too.
      expect(screen.getByRole('button', { name: 'Print / save as PDF' }).parentElement).toHaveClass('print:hidden');

      act(() => {
        window.dispatchEvent(new Event('afterprint'));
      });
      expect(document.body.querySelector(':scope > [data-print-view]')).toBeNull();
      expect(document.title).toBe(before);
    });
  });

  describe('AC-9: nothing is stored', () => {
    it('makes one request, the prices read, through a whole quote and its print', async () => {
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
      expect(screen.queryByText(/Rp/)).not.toBeInTheDocument();
      // The page's own title stays, so the reader knows where they are.
      expect(screen.getByRole('heading', { level: 1, name: 'Billing & subscription' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('Estimate your price')).toBeInTheDocument();
      expect(calls).toHaveLength(2);
    });

    it('refuses a reader without the permission, and asks the API for nothing', () => {
      const { calls } = stubFetch({ '/admin/billing/prices': { body: PRICES } });
      renderWithSession(<BillingPage />, { me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] } });

      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.queryByText('Billing & subscription')).not.toBeInTheDocument();
      expect(calls).toEqual([]);
    });
  });

  describe('the console', () => {
    it('AC-4: “Billing & subscription” is the last item of the KPMs group, and it is current here', async () => {
      stubFetch({ '/admin/billing/prices': { body: PRICES }, '/notifications': { body: INBOX } });
      renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
      await screen.findByText('Estimate your price');

      const nav = screen.getByRole('navigation', { name: 'Main' });
      const names = within(nav).getAllByRole('link').map((a) => a.textContent?.trim());
      const kpms = names.indexOf('All KPMs');
      expect(names.slice(kpms, kpms + 3)).toEqual(['All KPMs', 'Pending KPM requests', 'Billing & subscription']);
      expect(names[kpms + 3]).toBe('KPM Owners & Admins');
      const link = within(nav).getByRole('link', { name: 'Billing & subscription' });
      expect(link).toHaveAttribute('href', '/admin/billing');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('AC-11: the cards wrap rather than scroll — a grid of columns at least 170px wide, as many as fit', async () => {
      renderPage();
      await screen.findByText('Estimate your price');

      expect(screen.getAllByRole('list')[0]).toHaveClass('grid-cols-[repeat(auto-fit,minmax(170px,1fr))]');
    });
  });

  describe('accessibility (WCAG 2.1 AA, axe)', () => {
    /** Contrast is checked from the tokens in `a11y.spec.tsx`: jsdom cannot sample rendered pixels. */
    async function expectClean(name: string) {
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      const violations = results.violations ?? [];
      expect(violations.map((v) => `${name}: ${v.id} (${v.nodes.length})`)).toEqual([]);
    }

    it('the editor, the dialog with its refusals, and the quote pass, in the console', async () => {
      stubFetch({ '/admin/billing/prices': { body: PRICES }, '/notifications': { body: INBOX } });
      renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
      await screen.findByText('Estimate your price');
      await userEvent.click(screen.getByText('Manual override'));
      await expectClean('the editor');

      await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      await expectClean('the dialog, refused');

      await fillDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Generate quote' }));
      await expectClean('the quote');
    });
  });
});
