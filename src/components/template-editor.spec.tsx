import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActivationChecklistEditor, PipelineEditor, RatioSetEditor, TaxonomyEditor, TrainingEditor,
  withOrdinals,
  type ActivationChecklistPayload, type PipelinePayload, type RatioSetPayload, type TaxonomyPayload,
  type TrainingTaxonomyPayload,
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

  it('leaves the code to be typed — only training suggests one', async () => {
    render(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'Selling' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an activity type' }));
    await userEvent.type(within(card).getByLabelText('Name'), 'Referral masuk');

    expect(within(card).getByLabelText('Code')).toHaveValue('');
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

describe('TrainingEditor (P5-T1)', () => {
  const TRAINING: TrainingTaxonomyPayload = {
    categories: [
      { code: 'SALES', label: 'Sales', description: 'Structured modules.' },
      { code: 'PRODUCT', label: 'Product', description: null },
    ],
    skills: [
      { code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' },
      { code: 'CLOSING', categoryCode: 'SALES', label: 'Closing' },
    ],
    modules: [
      { code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' },
      { code: 'COLD_CALLS', skillCode: 'PROSPECTING', title: 'Cold calls', publishState: 'draft' },
    ],
  };

  /** The editor is controlled; this holds the payload the way the template screen does. */
  function Editor({ initial = TRAINING, onChange = vi.fn() }: {
    initial?: TrainingTaxonomyPayload; onChange?: (next: TrainingTaxonomyPayload) => void;
  }) {
    const [payload, setPayload] = useState(initial);
    return <TrainingEditor payload={payload} onChange={(next) => { setPayload(next); onChange(next); }} />;
  }

  const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
  const subtab = (name: string) => userEvent.click(
    within(screen.getByRole('navigation', { name: 'Training template sections' })).getByRole('link', { name }),
  );

  it('renders an unauthored preset as empty instead of crashing', () => {
    render(<TrainingEditor payload={{} as TrainingTaxonomyPayload} onChange={vi.fn()} />);

    expect(screen.getByText('0 categories')).toBeInTheDocument();
    expect(screen.getByText('No training categories yet.')).toBeInTheDocument();
  });

  it('mirrors the Owner’s screen: three subtabs, and the same badges', () => {
    render(<Editor />);

    expect(within(screen.getByRole('navigation', { name: 'Training template sections' }))
      .getAllByRole('link').map((l) => l.textContent)).toEqual(['Categories', 'Skills', 'Modules']);
    expect(within(rowOf('Sales')).getByText('2 skills · 1 module published')).toBeInTheDocument();
    expect(within(rowOf('Product')).getByText('Empty')).toBeInTheDocument();
  });

  it('removes an empty category, and not one that still holds skills', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);

    expect(within(rowOf('Sales')).getByRole('button', { name: 'Remove' })).toBeDisabled();
    await userEvent.click(within(rowOf('Product')).getByRole('button', { name: 'Remove' }));

    expect(onChange.mock.calls.at(-1)![0].categories.map((c: { code: string }) => c.code)).toEqual(['SALES']);
  });

  it('suggests a category’s code from its name, and refuses one the template already uses', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a category' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Sales');

    expect(screen.getByLabelText('Code')).toHaveValue('SALES');
    expect(screen.getByRole('alert')).toHaveTextContent('This template already has a category with this code.');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Soft Skills');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange.mock.calls.at(-1)![0].categories.at(-1)).toEqual({
      code: 'SOFT_SKILLS', label: 'Soft Skills', description: null,
    });
  });

  it('adds a skill to the category chosen, and keeps one with modules from being removed', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await subtab('Skills');

    expect(within(rowOf('Prospecting')).getByText('2 modules')).toBeInTheDocument();
    expect(within(rowOf('Prospecting')).getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(within(rowOf('Closing')).getByRole('button', { name: 'Remove' })).toBeEnabled();

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'PRODUCT');
    expect(screen.getByText('No skills for this category yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a skill' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Feature walkthroughs');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange.mock.calls.at(-1)![0].skills.at(-1)).toEqual({
      code: 'FEATURE_WALKTHROUGHS', categoryCode: 'PRODUCT', label: 'Feature walkthroughs',
    });
  });

  it('moves a skill to another category', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await subtab('Skills');
    await userEvent.click(within(rowOf('Closing')).getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { description: 'Its modules move with it.' }), 'PRODUCT');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange.mock.calls.at(-1)![0].skills.find((s: { code: string }) => s.code === 'CLOSING'))
      .toMatchObject({ categoryCode: 'PRODUCT' });
  });

  it('offers the chosen category’s skills, and adds a module only to a skill that is chosen', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await subtab('Modules');

    expect(within(screen.getByLabelText('Skill')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['All skills', 'Prospecting', 'Closing']);
    expect(screen.getByText('Choose a skill to add a module to it.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Skill'), 'CLOSING');
    expect(screen.getByText('No modules for this category/skill yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a module' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Trial closes');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    // A draft, as an office's own new module is.
    expect(onChange.mock.calls.at(-1)![0].modules.at(-1)).toEqual({
      code: 'TRIAL_CLOSES', skillCode: 'CLOSING', title: 'Trial closes', publishState: 'draft',
    });
    expect(within(rowOf('Trial closes')).getByText('Draft')).toBeInTheDocument();
  });

  it('publishes a module in the template through its edit panel', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    await subtab('Modules');
    await userEvent.click(within(rowOf('Cold calls')).getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Publish state'), 'published');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange.mock.calls.at(-1)![0].modules.find((m: { code: string }) => m.code === 'COLD_CALLS'))
      .toMatchObject({ publishState: 'published' });
    expect(within(rowOf('Cold calls')).getByText('Published')).toBeInTheDocument();
  });
});

describe('ActivationChecklistEditor (P5-T3)', () => {
  const CHECKLIST: ActivationChecklistPayload = {
    aspects: [
      {
        code: 'INTRODUCTION',
        label: '1. Introduction',
        items: [{ code: 'INSURANCE_BASICS', label: 'Learn insurance basics', autoLink: null }],
      },
      {
        code: 'INITIAL_SETUP',
        label: '2. Initial Setup',
        items: [{ code: 'GOAL_SETTING', label: 'Goal setting', autoLink: 'feature:goals' }],
      },
    ],
  };
  const MODULES = [{ code: 'PROSPECT_LIST', title: 'Building Your Prospect List' }];

  function Editor({ onChange = vi.fn() }: { onChange?: (next: ActivationChecklistPayload) => void }) {
    const [payload, setPayload] = useState(CHECKLIST);
    return (
      <ActivationChecklistEditor
        payload={payload}
        modules={MODULES}
        onChange={(next) => { setPayload(next); onChange(next); }}
      />
    );
  }

  const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

  it('renders an unauthored preset as empty instead of crashing', () => {
    render(<ActivationChecklistEditor
      payload={{} as ActivationChecklistPayload}
      modules={[]}
      onChange={vi.fn()}
    />);

    expect(screen.getByText('0 items across 0 aspects')).toBeInTheDocument();
    expect(screen.getByText('No aspects yet.')).toBeInTheDocument();
  });

  it('says of each item whether it completes on its own, or waits for a leader', () => {
    render(<Editor />);

    expect(within(rowOf('Goal setting')).getByText('Auto · Goal Settings')).toBeInTheDocument();
    expect(within(rowOf('Learn insurance basics')).getByText('Ticked by the leader')).toBeInTheDocument();
  });

  it('offers this company’s own training modules as links', async () => {
    render(<Editor />);
    await userEvent.click(within(rowOf('Learn insurance basics')).getByRole('button', { name: 'Edit' }));

    const options = within(screen.getByLabelText('Completes from')).getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'No link (manual)', 'Goal Settings', 'Leads Management', 'Activity Management',
      'Training · Building Your Prospect List',
    ]);
  });

  it('links an item to a module, and clears a link back to manual', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);

    await userEvent.click(within(rowOf('Learn insurance basics')).getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Completes from'), 'training:PROSPECT_LIST');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange.mock.calls.at(-1)![0].aspects[0].items[0].autoLink).toBe('training:PROSPECT_LIST');

    await userEvent.click(within(rowOf('Goal setting')).getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Completes from'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange.mock.calls.at(-1)![0].aspects[1].items[0].autoLink).toBeNull();
  });

  it('adds an item with its code suggested, and refuses a code already used', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    const card = screen.getByText('1. Introduction').closest('.rounded-lg') as HTMLElement;

    await userEvent.click(within(card).getByRole('button', { name: 'Add an item' }));
    await userEvent.type(within(card).getByLabelText('Item'), 'Goal setting');
    await userEvent.clear(within(card).getByLabelText('Code'));
    await userEvent.type(within(card).getByLabelText('Code'), 'GOAL_SETTING');
    expect(within(card).getByRole('alert')).toHaveTextContent('already has an item with this code');

    await userEvent.clear(within(card).getByLabelText('Code'));
    await userEvent.type(within(card).getByLabelText('Code'), 'SHADOW_SENIOR');
    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));

    expect(onChange.mock.calls.at(-1)![0].aspects[0].items.at(-1)).toEqual({
      code: 'SHADOW_SENIOR', label: 'Goal setting', autoLink: null,
    });
  });

it('removes an aspect with its items, saying how many are going', async () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} />);
    const card = screen.getByText('1. Introduction').closest('.rounded-lg') as HTMLElement;

    const remove = within(card).getAllByRole('button', { name: 'Remove' })[0];
    expect(remove).toHaveAttribute('title', 'Removes 1. Introduction and its 1 item.');

    await userEvent.click(remove);
    expect(onChange.mock.calls.at(-1)![0].aspects.map((a: { code: string }) => a.code))
      .toEqual(['INITIAL_SETUP']);
  });
});
