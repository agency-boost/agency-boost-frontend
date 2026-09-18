import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActivationChecklistEditor, CampaignKindsEditor, CapabilityLadderEditor, EventTypesEditor,
  PipelineEditor, RatioSetEditor, TaxonomyEditor, TrainingEditor,
  withOrdinals,
  type ActivationChecklistPayload, type CampaignKindsPayload, type CapabilityLadderPayload,
  type EventTypesPayload, type PipelinePayload, type RatioSetPayload, type TaxonomyPayload,
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

  it('puts the section heading hard left, with its count pushed right', () => {
    /*
     * Three children under `justify-between` floated the heading to the middle of the card;
     * the prototype's `.acttype-card-head` has two, heading left and count pill right.
     *
     * The head is an `EditableRow` now — the section can be renamed, which it could not be —
     * so the heading sits in the text block and the count is the row's badge, which
     * `EditableRow` places between the text and Edit.
     */
    render(<TaxonomyEditor payload={TAXONOMY} onChange={vi.fn()} />);

    const head = screen.getByRole('heading', { name: 'Selling' }).closest('.flex')!;
    expect(head.className).not.toContain('justify-between');
    const text = screen.getByRole('heading', { name: 'Selling' }).parentElement!;
    expect(text.className).toContain('flex-1');
    expect(within(head as HTMLElement).getByText('2 items')).toBeInTheDocument();
  });

  it('renames a section, which nothing could do before', async () => {
    // A typo in a section name was permanent: there was no control, and the only way out was
    // removing the section and everything under it.
    const onChange = vi.fn();
    render(<TaxonomyEditor payload={TAXONOMY} onChange={onChange} />);

    const head = screen.getByRole('heading', { name: 'Selling' }).closest('.flex') as HTMLElement;
    await userEvent.click(within(head).getByRole('button', { name: 'Edit' }));
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Penjualan');
    await userEvent.click(within(head).getByRole('button', { name: 'Save' }));

    expect(onChange.mock.calls[0][0].categories[0])
      .toMatchObject({ code: 'SELLING', label: 'Penjualan' });
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

/**
 * The three editors P5-T9 added (AC-4).
 *
 * Two of their tabs were `ComingInPhase` signs until the template kinds ADR-0034 named existed;
 * the third had validation and a provisioning reader since P5-T8 and no way to edit one.
 */
const EVENT_TYPES: EventTypesPayload = {
  types: [
    { code: 'TRAINING', label: 'Training', description: null, emoji: '📚', color: '#2D9CDB', displayOrder: 1 },
    { code: 'RECOGNITION', label: 'Recognition', description: null, emoji: '🏆', color: null, displayOrder: 2 },
  ],
};

const CAMPAIGN_KINDS: CampaignKindsPayload = {
  rules: [{
    kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', rank: 1,
    reward: 'Promotion bonus', groupMode: 'all',
    criteriaGroups: [{
      mode: 'all',
      criteria: [{ metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 120000000000 }],
    }],
  }],
};

const METRICS = [
  { key: 'APE_ACHIEVED', label: 'APE achieved', unit: 'idr_minor' },
  { key: 'NET_APE', label: 'Net APE', unit: 'idr_minor' },
];

const CAPABILITY: CapabilityLadderPayload = {
  stages: [
    { code: 'COMPETENT', label: 'Competent', requiredMilestoneCodes: ['SELLS'], stageOrder: 2 },
    { code: 'NEW', label: 'New agent', requiredMilestoneCodes: [], stageOrder: 1 },
  ],
  milestones: [{ code: 'SELLS', label: 'Sells independently' }],
  grids: [{
    code: 'PERSONAL', label: 'Personal selling', requiresDownline: false,
    items: [{ code: 'APPROACH', label: 'Approach' }],
  }],
};

describe('a create form offers what its edit panel does', () => {
  it('asks for an activity type’s description while creating it', async () => {
    // It was on the edit panel and not on Add, so describing a new type meant saving it and
    // immediately editing it to finish the job.
    const onChange = vi.fn();
    render(<TaxonomyEditor payload={TAXONOMY} onChange={onChange} />);

    const card = screen.getByRole('heading', { name: 'Selling' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an activity type' }));
    await userEvent.type(within(card).getByLabelText('Code'), 'SELL_REFERRAL');
    await userEvent.type(within(card).getByLabelText('Name'), 'Referral');
    await userEvent.type(within(card).getByLabelText('Description'), 'Asking a client for a name');
    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));

    const added = onChange.mock.calls[0][0].types.find((t: { code: string }) => t.code === 'SELL_REFERRAL');
    expect(added).toMatchObject({ label: 'Referral', description: 'Asking a client for a name' });
  });

  it('leaves a description that was never typed as null, not as an empty string', async () => {
    // `null` is "nobody wrote one"; `''` is "somebody cleared it". The API tells them apart.
    const onChange = vi.fn();
    render(<TaxonomyEditor payload={TAXONOMY} onChange={onChange} />);

    const card = screen.getByRole('heading', { name: 'Selling' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Add an activity type' }));
    await userEvent.type(within(card).getByLabelText('Code'), 'SELL_REFERRAL');
    await userEvent.type(within(card).getByLabelText('Name'), 'Referral');
    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));

    const added = onChange.mock.calls[0][0].types.find((t: { code: string }) => t.code === 'SELL_REFERRAL');
    expect(added.description).toBeNull();
  });
});

describe('EventTypesEditor (P5-T9)', () => {
  it('renders an unauthored preset as empty instead of crashing', () => {
    render(<EventTypesEditor payload={{} as EventTypesPayload} onChange={vi.fn()} />);

    expect(screen.getByText(/An office with none has nothing to file an event under/))
      .toBeInTheDocument();
  });

  it('adds a type with a code, and numbers it off the list', async () => {
    const onChange = vi.fn();
    render(<EventTypesEditor payload={EVENT_TYPES} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Add an event type/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'Town hall');
    // Suggested from the name, so a list of sentences does not end up TYPE_1, TYPE_2.
    expect(screen.getByLabelText('Code')).toHaveValue('TOWN_HALL');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange.mock.calls[0][0].types.map((t: { code: string }) => t.code))
      .toEqual(['TRAINING', 'RECOGNITION', 'TOWN_HALL']);
  });

  it('removes one, and edits a name without touching the code', async () => {
    const onChange = vi.fn();
    render(<EventTypesEditor payload={EVENT_TYPES} onChange={onChange} />);

    const row = screen.getByText('Training').closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    // The code is its own field now, not the name's description — and it is read-only.
    expect(within(row).getByLabelText('Code')).toHaveValue('TRAINING');
    expect(within(row).getByLabelText('Code')).toHaveAttribute('readonly');

    const name = within(row).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Pelatihan');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    const [next] = onChange.mock.calls[0];
    expect(next.types[0]).toMatchObject({ code: 'TRAINING', label: 'Pelatihan' });
  });

  it('reorders with the keyboard, and rewrites the ordinal', async () => {
    // The order reaches an office through `displayOrder`, so a drag that moves the row and
    // leaves the number behind shows one order and seeds another (P4-T24's defect).
    const onChange = vi.fn();
    render(<EventTypesEditor payload={EVENT_TYPES} onChange={onChange} />);

    const row = screen.getByText('Training').closest('li')!;
    within(row).getByRole('button', { name: /^Reorder Training\./ }).focus();
    await userEvent.keyboard('{ArrowDown}');

    const [next] = onChange.mock.calls[0];
    expect(next.types.map((t: { code: string; displayOrder: number }) => [t.code, t.displayOrder]))
      .toEqual([['RECOGNITION', 1], ['TRAINING', 2]]);
  });
});

describe('CampaignKindsEditor (P5-T9)', () => {
  it('renders an unauthored preset as empty instead of crashing', () => {
    render(<CampaignKindsEditor
      payload={{} as CampaignKindsPayload}
      metrics={METRICS}
      onChange={vi.fn()}
    />);

    expect(screen.getByRole('heading', { name: 'Production clubs' })).toBeInTheDocument();
  });

  it('adds a rule that already asks for something', async () => {
    // A rule asking for nothing is one everybody qualifies for on the day it publishes — and
    // publishing refuses it, so the Add cannot be the thing that creates one.
    const onChange = vi.fn();
    render(<CampaignKindsEditor payload={CAMPAIGN_KINDS} metrics={METRICS} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Add a production clubs rule/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'Elite Club');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const [next] = onChange.mock.calls[0];
    const added = next.rules.find((r: { code: string }) => r.code === 'ELITE_CLUB');
    expect(added.criteriaGroups[0].criteria).toHaveLength(1);
    expect(added.rank).toBe(2);
  });

  it('edits a threshold, and says money is in sen', async () => {
    const onChange = vi.fn();
    render(<CampaignKindsEditor payload={CAMPAIGN_KINDS} metrics={METRICS} onChange={onChange} />);

    const criterion = screen.getByText(/APE achieved/).closest('li')!;
    await userEvent.click(within(criterion).getByRole('button', { name: 'Edit' }));
    const value = screen.getByLabelText('Value');
    expect(screen.getByText(/Money is in sen/)).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, '200000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange.mock.calls[0][0].rules[0].criteriaGroups[0].criteria[0].value)
      .toBe(200000000000);
  });

  it('names a metric the registry does not define rather than hiding it', async () => {
    // ADR-0035: a rule records what it is waiting on. Dropping the row would show a rule that
    // silently never passes.
    render(<CampaignKindsEditor
      payload={{
        rules: [{
          ...CAMPAIGN_KINDS.rules[0],
          criteriaGroups: [{
            mode: 'all',
            criteria: [{ metricKey: 'MADE_UP_METRIC', comparator: 'gte', value: 1 }],
          }],
        }],
      }}
      metrics={METRICS}
      onChange={vi.fn()}
    />);

    expect(screen.getByText(/MADE_UP_METRIC — not in the registry yet/)).toBeInTheDocument();
  });
});

describe('CapabilityLadderEditor (P5-T9)', () => {
  it('renders an unauthored preset as empty instead of crashing', () => {
    render(<CapabilityLadderEditor payload={{} as CapabilityLadderPayload} onChange={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
  });

  it('lists stages by rank, not by the order they sit in the payload', async () => {
    // The prototype computes somebody's stage from the array index, so tidying the ladder for
    // readability moves everybody. Rank is the only seniority here.
    render(<CapabilityLadderEditor payload={CAPABILITY} onChange={vi.fn()} />);

    const labels = screen.getAllByText(/New agent|Competent/).map((el) => el.textContent);
    expect(labels).toEqual(['New agent', 'Competent']);
  });

  it('ticks a milestone onto a stage', async () => {
    const onChange = vi.fn();
    render(<CapabilityLadderEditor payload={CAPABILITY} onChange={onChange} />);

    const stage = screen.getByText('New agent').closest('li')!;
    await userEvent.click(within(stage).getByRole('checkbox', { name: 'Sells independently' }));

    const [next] = onChange.mock.calls[0];
    expect(next.stages.find((s: { code: string }) => s.code === 'NEW').requiredMilestoneCodes)
      .toEqual(['SELLS']);
  });

  it('refuses to let a grid item be added without a code, and suggests one', async () => {
    const onChange = vi.fn();
    render(<CapabilityLadderEditor payload={CAPABILITY} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Add an item/ }));
    await userEvent.type(screen.getByLabelText('Item'), 'Asking for referrals');

    expect(screen.getByLabelText('Code')).toHaveValue('ASKING_FOR_REFERRALS');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange.mock.calls[0][0].grids[0].items.map((i: { code: string }) => i.code))
      .toEqual(['APPROACH', 'ASKING_FOR_REFERRALS']);
  });

  it('says a milestone a stage still needs will be refused, rather than removing it quietly', async () => {
    render(<CapabilityLadderEditor payload={CAPABILITY} onChange={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'Milestones' }).closest('.rounded-lg')!;
    const row = within(card as HTMLElement).getByText('Sells independently').closest('li')!;
    expect(within(row).getByRole('button', { name: 'Remove' }))
      .toHaveAttribute('title', expect.stringContaining('refused at publish'));
  });
});
