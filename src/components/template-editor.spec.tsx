import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PipelineEditor, RatioSetEditor, TaxonomyEditor, withOrdinals,
  type PipelinePayload, type RatioSetPayload, type TaxonomyPayload,
} from '@/components/template-editor';

const TAXONOMY: TaxonomyPayload = {
  categories: [
    { code: 'SELLING', label: 'Selling', displayOrder: 1 },
    { code: 'RECRUITING', label: 'Recruiting', displayOrder: 2 },
  ],
  types: [
    { code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi', description: null, displayOrder: 1 },
    { code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission', description: null, displayOrder: 2 },
    { code: 'RECRUIT_APPROACH', categoryCode: 'RECRUITING', label: 'Approach', description: null, displayOrder: 3 },
  ],
};

describe('withOrdinals', () => {
  /*
   * P4-T24. `useRowDrag` reordered the array and nothing rewrote the ordinal, so the order
   * a Super Admin set reached no office: provisioning copies `displayOrder` verbatim and an
   * office reads sorted by it. The circled numbers on screen showed the new order and the
   * data kept the old one.
   */
  it('numbers rows from their position, not from what they carried', () => {
    const out = withOrdinals(
      [{ displayOrder: 7 }, { displayOrder: 2 }, { displayOrder: 5 }],
      'displayOrder',
    );

    expect(out.map((r) => r.displayOrder)).toEqual([1, 2, 3]);
  });

  it('restarts the count per group, so two ladders both begin at 1', () => {
    // A lead status's `rank` is per pipeline. Renumbering both in one sequence would hand
    // the recruitment ladder ranks carrying on from where sales stopped.
    const rows = [
      { pipeline: 'sales', rank: 0 },
      { pipeline: 'recruitment', rank: 0 },
      { pipeline: 'sales', rank: 0 },
    ];

    expect(withOrdinals(rows, 'rank', (r) => r.pipeline).map((r) => r.rank)).toEqual([1, 1, 2]);
  });

  it('leaves every other field alone', () => {
    expect(withOrdinals([{ code: 'A', displayOrder: 9 }], 'displayOrder')).toEqual([
      { code: 'A', displayOrder: 1 },
    ]);
  });

  it('closes the gap a removal leaves rather than counting the survivors', () => {
    // `rows.length + 1` on the next add would collide with a number still in use.
    const after = withOrdinals(
      [{ displayOrder: 1 }, { displayOrder: 3 }],
      'displayOrder',
    );

    expect(after.map((r) => r.displayOrder)).toEqual([1, 2]);
  });
});

describe('an unauthored preset', () => {
  /*
   * The template screen casts each payload with `as unknown as`, so TypeScript is told the
   * arrays are there and cannot check it. A preset nobody has filled in arrives as `{}`,
   * and every editor took the whole screen down on `.filter of undefined`. Empty is a real
   * state for all three.
   */
  it('renders the taxonomy editor as empty instead of crashing', () => {
    render(<TaxonomyEditor payload={{} as TaxonomyPayload} onChange={vi.fn()} />);

    expect(screen.getByText(/0 activity types across 0 sections/)).toBeInTheDocument();
  });

  it('renders the pipeline editor as empty instead of crashing', () => {
    render(<PipelineEditor payload={{} as PipelinePayload} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Add a sales stage/ })).toBeInTheDocument();
  });

  it('renders the ratio editor as empty instead of crashing', () => {
    render(<RatioSetEditor payload={{} as RatioSetPayload} available={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add a ratio' })).toBeInTheDocument();
  });
});

describe('TaxonomyEditor', () => {
  it('offers Add a section from the toolbar, not as the grid’s last cell', async () => {
    // It was a bare unlabelled Card after the sections, so in a two-column grid it read as
    // a sixth section that had failed to load. Reported as "cannot add a section".
    render(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    const toolbar = screen.getByText(/3 activity types across 2 sections/).parentElement!;
    expect(within(toolbar).getByRole('button', { name: 'Add a section' })).toBeInTheDocument();
  });

  it('renumbers every type when one is removed', async () => {
    const onChange = vi.fn();
    render(<TaxonomyEditor payload={TAXONOMY} onChange={onChange} />);

    const row = screen.getByText('Presentasi').closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(onChange.mock.calls[0][0].types.map((t: { displayOrder: number }) => t.displayOrder))
      .toEqual([1, 2]);
  });

  it('numbers a new type off the renumbered list, never off its length', async () => {
    const onChange = vi.fn();
    // A list with a gap is exactly the state `length + 1` gets wrong.
    render(<TaxonomyEditor
      payload={{ ...TAXONOMY, types: [{ ...TAXONOMY.types[0], displayOrder: 5 }] }}
      onChange={onChange}
    />);

    const card = screen.getByRole('heading', { name: 'Selling' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an activity type' }));
    await userEvent.type(within(card).getByLabelText('Code'), 'SELL_REFERRAL');
    await userEvent.type(within(card).getByLabelText('Name'), 'Referral');
    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));

    expect(onChange.mock.calls[0][0].types.map((t: { displayOrder: number }) => t.displayOrder))
      .toEqual([1, 2]);
  });

  it('puts the section heading hard left, with the meta pushed right', () => {
    // Three children under `justify-between` floated the heading to the middle of the card;
    // the prototype's `.acttype-card-head` has two, heading left and count pill right.
    render(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    const head = screen.getByRole('heading', { name: 'Selling' }).parentElement!;
    expect(head.className).not.toContain('justify-between');
    expect(head.lastElementChild?.className).toContain('ml-auto');
  });

  it('builds field ids from a slug, so a hint points at an id that exists', async () => {
    render(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'Selling' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an activity type' }));

    // `what` is prose — "activity type" — and went straight into the id, so the field was
    // `add-code-activity type`. A space separates ids in `aria-describedby` and `for`.
    const code = within(card).getByLabelText('Code');
    expect(code.id).toBe('add-code-activity-type');
    expect(document.getElementById(code.getAttribute('aria-describedby')!)).toBeTruthy();
  });
});

describe('RatioSetEditor writes benchmarks in their unit (P4-T25)', () => {
  const ratio = (over: Partial<RatioSetPayload['ratios'][number]>) => ({
    code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity',
    numerator: ['A'], denominator: ['B'], benchmark: 0.3, comparison: 'gte' as const,
    displayUnit: 'decimal' as const, displayOrder: 1, ...over,
  });

  it('shows a percentage, a number and a band the way the registry writes them', () => {
    render(<RatioSetEditor
      available={[]}
      onChange={vi.fn()}
      payload={{ ratios: [
        ratio({ code: 'SELLING_SUCCESS_RATE', label: 'Selling', benchmark: 0.15, displayUnit: 'percent' }),
        ratio({}),
        ratio({ code: 'SELLING_VS_RECRUITMENT', label: 'Balance', benchmark: 30, comparison: 'band', displayUnit: 'points' }),
      ] }}
    />);

    expect(screen.getByText('15.0%')).toBeInTheDocument();
    expect(screen.getByText('0.30')).toBeInTheDocument();
    expect(screen.getByText('±30 points')).toBeInTheDocument();
  });

  it('re-expresses the typed benchmark when the unit changes, and saves the proportion', async () => {
    // The field takes 30 for 30.0%, so switching units must change the text — saving the
    // same "0.3" as a percentage would publish a benchmark a hundred times too small.
    const onChange = vi.fn();
    render(<RatioSetEditor available={[]} onChange={onChange} payload={{ ratios: [ratio({})] }} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await userEvent.selectOptions(screen.getByLabelText('Shown as'), 'percent');
    expect(screen.getByLabelText('On track at or above')).toHaveValue('30');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange.mock.calls.at(-1)![0].ratios[0]).toMatchObject({
      benchmark: 0.3, displayUnit: 'percent',
    });
  });

  it('offers no unit on a band ratio', async () => {
    render(<RatioSetEditor
      available={[]}
      onChange={vi.fn()}
      payload={{ ratios: [ratio({ comparison: 'band', benchmark: 30, displayUnit: 'points' })] }}
    />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.queryByLabelText('Shown as')).not.toBeInTheDocument();
  });

  it('starts a new ratio as a plain number', async () => {
    const onChange = vi.fn();
    render(<RatioSetEditor available={[]} onChange={onChange} payload={{ ratios: [] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a ratio' }));
    await userEvent.type(screen.getByLabelText('Code'), 'REFERRAL_RATE');
    await userEvent.type(screen.getByLabelText('Name'), 'Referral rate');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange.mock.calls.at(-1)![0].ratios[0]).toMatchObject({ displayUnit: 'decimal' });
  });
});
