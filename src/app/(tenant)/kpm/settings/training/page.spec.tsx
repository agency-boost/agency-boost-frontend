import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import TrainingSettingsPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/kpm/settings/training',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

/** A support session reads an office's configuration and writes none of it. */
const READER = makeMe({ ...OWNER, permissions: ['tenant_config:read'] });

const moduleRow = (over: Record<string, unknown>) => ({
  id: 'm-x', code: 'X', skillCode: 'PROSPECTING', title: 'X', publishState: 'published',
  displayOrder: 1, version: 1, status: 'active', ...over,
});

const TREE = [
  {
    id: 'c-sales', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
    skills: [
      {
        id: 's-prospecting', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting',
        displayOrder: 1, version: 2, status: 'active',
        modules: [
          moduleRow({ id: 'm-list', code: 'PROSPECT_LIST', title: 'Building Your Prospect List', version: 4 }),
          moduleRow({ id: 'm-cold', code: 'COLD_APPROACH_SCRIPTS', title: 'Cold Approach Scripts', publishState: 'draft', displayOrder: 2 }),
        ],
      },
      {
        id: 's-closing', code: 'CLOSING', categoryCode: 'SALES', label: 'Closing',
        displayOrder: 2, version: 1, status: 'active',
        modules: [moduleRow({ id: 'm-close', code: 'CLOSING_TECHNIQUES', skillCode: 'CLOSING', title: 'Closing Techniques That Work' })],
      },
    ],
  },
  {
    id: 'c-product', code: 'PRODUCT', label: 'Product', description: null, displayOrder: 2, version: 1,
    status: 'active', skills: [],
  },
  {
    id: 'c-old', code: 'OLD', label: 'Old ways', description: null, displayOrder: 3, version: 3,
    status: 'archived',
    skills: [{
      id: 's-old', code: 'OLD_SKILL', categoryCode: 'OLD', label: 'Door knocking', displayOrder: 1,
      version: 2, status: 'archived',
      modules: [moduleRow({ id: 'm-old', code: 'OLD_MODULE', skillCode: 'OLD_SKILL', title: 'Knock twice', status: 'archived' })],
    }],
  },
];

const PUBLISH_STATE = {
  publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null,
};

function render(me = OWNER, changes: { status?: number; body?: unknown } = { body: { training: [], version: 2 } }) {
  const stub = stubFetch({
    '/kpm/settings/training': { body: TREE },
    '/kpm/settings/publish-state': { body: PUBLISH_STATE },
    '/kpm/settings/changes': changes,
  });
  renderWithSession(<TrainingSettingsPage />, { me });
  return stub;
}

/** Press Save changes and read the batch that went out. */
async function saved(calls: { url: string; init: RequestInit }[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const post = calls.find((c) => c.url.includes('/kpm/settings/changes'))!;
  return JSON.parse(post.init.body as string).ops as Record<string, unknown>[];
}

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
const tabs = () => within(screen.getByRole('navigation', { name: 'Training sections' }));

async function openTab(name: 'Categories' | 'Skills' | 'Modules') {
  await userEvent.click(tabs().getByRole('link', { name }));
}

describe('Settings › Training (P5-T1)', () => {
  beforeEach(() => window.history.replaceState(null, '', '/kpm/settings/training'));
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  describe('the three subtabs (AC-9)', () => {
    it('draws Categories · Skills · Modules, with Categories first', async () => {
      render();
      await screen.findByText('Sales');

      expect(tabs().getAllByRole('link').map((l) => l.textContent)).toEqual(['Categories', 'Skills', 'Modules']);
      expect(tabs().getByRole('link', { name: 'Categories' })).toHaveAttribute('aria-current', 'page');
    });

    it('opens on the subtab the address names, so a link can land on Modules', async () => {
      window.history.replaceState(null, '', '/kpm/settings/training#modules');
      render();

      expect(await screen.findByText('Building Your Prospect List')).toBeInTheDocument();
      expect(tabs().getByRole('link', { name: 'Modules' })).toHaveAttribute('aria-current', 'page');
    });

    it('writes the subtab into the address when one is chosen', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Skills');

      expect(window.location.hash).toBe('#skills');
    });
  });

  describe('categories', () => {
    it('badges each with what agents are offered, or Empty — the prototype’s own words', async () => {
      render();

      await screen.findByText('Sales');
      expect(within(rowOf('Sales')).getByText('2 skills · 2 modules published')).toBeInTheDocument();
      expect(within(rowOf('Product')).getByText('Empty')).toBeInTheDocument();
    });

    it('keeps an archived category off the list until Show archived is on', async () => {
      render();
      await screen.findByText('Sales');
      expect(screen.queryByText('Old ways')).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Show archived'));

      expect(within(rowOf('Old ways')).getByText('archived')).toBeInTheDocument();
      expect(within(rowOf('Old ways')).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    });

    it('fills the code in from the name, and sends both when saved', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await userEvent.click(screen.getByRole('button', { name: '+ Add category' }));
      await userEvent.type(screen.getByLabelText('Name'), 'Product Knowledge');

      expect(screen.getByLabelText('Code')).toHaveValue('PRODUCT_KNOWLEDGE');

      await userEvent.click(screen.getByRole('button', { name: 'Add the category' }));
      expect(within(rowOf('Product Knowledge')).getByText('Added — not saved yet')).toBeInTheDocument();

      expect(await saved(calls)).toEqual([
        { op: 'trainingCategory.create', body: { code: 'PRODUCT_KNOWLEDGE', label: 'Product Knowledge' } },
      ]);
    });

    it('stops following the name once somebody types a code', async () => {
      render();
      await screen.findByText('Sales');
      await userEvent.click(screen.getByRole('button', { name: '+ Add category' }));
      await userEvent.type(screen.getByLabelText('Code'), 'pk');
      await userEvent.type(screen.getByLabelText('Name'), 'Product Knowledge');

      expect(screen.getByLabelText('Code')).toHaveValue('PK');
    });

    it('refuses a code already used, counting archived rows (AC-3)', async () => {
      render();
      await screen.findByText('Sales');
      await userEvent.click(screen.getByRole('button', { name: '+ Add category' }));
      await userEvent.type(screen.getByLabelText('Name'), 'Old');

      expect(screen.getByRole('alert')).toHaveTextContent(/already has a category with this code/);
      expect(screen.getByRole('button', { name: 'Add the category' })).toBeDisabled();
    });

    it('edits the name and shows the code it cannot change, sending only what changed', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Edit' }));

      expect(screen.getByText('SALES')).toBeInTheDocument();
      const name = screen.getByLabelText('Name');
      await userEvent.clear(name);
      await userEvent.type(name, 'Selling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(within(rowOf('Selling')).getByText('Edited — not saved yet')).toBeInTheDocument();
      expect(await saved(calls)).toEqual([
        { op: 'trainingCategory.update', id: 'c-sales', expectedVersion: 1, body: { label: 'Selling' } },
      ]);
    });
  });

  describe('archiving reaches down, and restoring does not (AC-3, AC-10)', () => {
    it('shows a category’s skills going with it before anything is saved', async () => {
      render();
      await screen.findByText('Sales');
    await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Archive' }));
      expect(within(rowOf('Sales')).getByText('Archived — not saved yet')).toBeInTheDocument();

      await openTab('Skills');

      expect(within(rowOf('Prospecting')).getByText('Archived with Sales — not saved yet')).toBeInTheDocument();
      // Its Undo is on the category, so the skill offers neither Archive nor Restore.
      expect(within(rowOf('Prospecting')).queryByRole('button', { name: /Archive|Restore/ })).not.toBeInTheDocument();
    });

    it('takes a staged archive back when Restore is pressed, rather than sending both', async () => {
      render();
      await screen.findByText('Sales');
    await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Archive' }));
      await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Restore' }));

      expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    });

    it('offers no Restore under an archived category, and names what to restore first', async () => {
      render();
      await screen.findByText('Sales');
      await userEvent.click(screen.getByLabelText('Show archived'));
      await openTab('Skills');
      await userEvent.selectOptions(screen.getByLabelText('Category'), 'OLD');

      const row = rowOf('Door knocking');
      expect(within(row).getByText('Restore Old ways first')).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    });
  });

  describe('skills', () => {
    it('lists the chosen category’s skills, with how many modules teach each', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Skills');

      expect(within(rowOf('Prospecting')).getByText('2 modules')).toBeInTheDocument();
      expect(within(rowOf('Closing')).getByText('1 module')).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText('Category'), 'PRODUCT');
      expect(screen.getByText('No skills for this category yet.')).toBeInTheDocument();
    });

    it('moves a skill to another category, which takes its modules with it (AC-2)', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await openTab('Skills');
      await userEvent.click(within(rowOf('Closing')).getByRole('button', { name: 'Edit' }));
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category', description: /modules move with it/ }), 'PRODUCT');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      // Gone from Sales, because it will be in Product.
      expect(screen.queryByText('Closing')).not.toBeInTheDocument();
      expect(await saved(calls)).toEqual([
        { op: 'trainingSkill.update', id: 's-closing', expectedVersion: 1, body: { categoryCode: 'PRODUCT' } },
      ]);
    });

    it('adds a skill to the category chosen', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await openTab('Skills');
      await userEvent.click(screen.getByRole('button', { name: '+ Add skill' }));
      await userEvent.type(screen.getByLabelText('Name'), 'Needs Analysis');
      await userEvent.click(screen.getByRole('button', { name: 'Add the skill' }));

      expect(within(rowOf('Needs Analysis')).getByText('Added — not saved yet')).toBeInTheDocument();
      expect(await saved(calls)).toEqual([
        { op: 'trainingSkill.create', body: { code: 'NEEDS_ANALYSIS', categoryCode: 'SALES', label: 'Needs Analysis' } },
      ]);
    });
  });

  describe('modules', () => {
    it('offers the chosen category’s skills, not Sales’s whatever is chosen (AC-2, F-13)', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Modules');

      const skill = screen.getByLabelText('Skill');
      expect(within(skill).getAllByRole('option').map((o) => o.textContent)).toEqual(['All skills', 'Prospecting', 'Closing']);

      await userEvent.selectOptions(screen.getByLabelText('Category'), 'PRODUCT');
      expect(within(screen.getByLabelText('Skill')).getAllByRole('option').map((o) => o.textContent)).toEqual(['All skills']);
      expect(screen.getByText('No modules for this category/skill yet.')).toBeInTheDocument();
    });

    it('badges each module Published or Draft, under the skill it teaches', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Modules');

      expect(within(rowOf('Building Your Prospect List')).getByText('Published')).toBeInTheDocument();
      expect(within(rowOf('Cold Approach Scripts')).getByText('Draft')).toBeInTheDocument();
      expect(within(rowOf('Closing Techniques That Work')).getByText('Closing')).toBeInTheDocument();
    });

    it('stages Unpublish as an edit, and publishing it again takes the edit back', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Modules');
      const row = rowOf('Building Your Prospect List');

      await userEvent.click(within(row).getByRole('button', { name: 'Unpublish' }));
      expect(within(row).getByText('Draft')).toBeInTheDocument();
      expect(within(row).getByText('Edited — not saved yet')).toBeInTheDocument();

      await userEvent.click(within(row).getByRole('button', { name: 'Publish' }));
      expect(within(row).queryByText(/not saved yet/)).not.toBeInTheDocument();
    });

    /*
     * The batch moves a row's version on after each op against it. Unpublishing and archiving one
     * module in one Save named version 4 twice, and the archive came back as a conflict.
     */
    it('sends two edits to one module at the versions the batch will find it at', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await openTab('Modules');
      const row = rowOf('Building Your Prospect List');
      await userEvent.click(within(row).getByRole('button', { name: 'Unpublish' }));
      await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));

      expect(await saved(calls)).toEqual([
        { op: 'trainingModule.update', id: 'm-list', expectedVersion: 4, body: { publishState: 'draft' } },
        { op: 'trainingModule.archive', id: 'm-list', expectedVersion: 5 },
      ]);
    });

    it('adds a module as a draft, to the skill chosen', async () => {
      const { calls } = render();
      await screen.findByText('Sales');
      await openTab('Modules');
      await userEvent.click(screen.getByRole('button', { name: '+ Add module' }));
      // The panel's own Skill, not the filter's of the same name.
      const panel = within(screen.getByRole('heading', { name: 'Add a module' }).closest('div')!);
      await userEvent.selectOptions(panel.getByLabelText('Skill'), 'CLOSING');
      await userEvent.type(panel.getByLabelText('Title'), 'Trial closes');
      expect(panel.getByLabelText('Code')).toHaveValue('TRIAL_CLOSES');
      await userEvent.click(panel.getByRole('button', { name: 'Add the module' }));

      expect(within(rowOf('Trial closes')).getByText('Draft')).toBeInTheDocument();
      expect(await saved(calls)).toEqual([
        { op: 'trainingModule.create', body: { code: 'TRIAL_CLOSES', skillCode: 'CLOSING', title: 'Trial closes' } },
      ]);
    });

    it('opens a module as its own page', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Modules');

      expect(within(rowOf('Building Your Prospect List')).getByRole('link', { name: 'Edit' }))
        .toHaveAttribute('href', '/kpm/settings/training/m-list');
    });

    it('asks before opening a module would discard unsaved changes', async () => {
      render();
      await screen.findByText('Sales');
      await openTab('Modules');
      await userEvent.click(within(rowOf('Cold Approach Scripts')).getByRole('button', { name: 'Publish' }));
      await userEvent.click(within(rowOf('Building Your Prospect List')).getByRole('link', { name: 'Edit' }));

      expect(screen.getByRole('alert')).toHaveTextContent('You have changes here that are not saved.');
      expect(push).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Discard and open Building Your Prospect List' }));
      expect(push).toHaveBeenCalledWith('/kpm/settings/training/m-list');
    });
  });

  it('reads again after saving, rather than drawing the list from what agents are offered', async () => {
    const { calls } = render();
    await screen.findByText('Sales');
    await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Archive' }));
    await saved(calls);

    await screen.findByText('Product');
    expect(calls.filter((c) => c.url.includes('/kpm/settings/training')).length).toBe(2);
    expect(screen.queryByText(/not saved yet/)).not.toBeInTheDocument();
  });

  it('keeps what is staged when the batch is refused, and says why', async () => {
    render(OWNER, {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Change 1 (trainingCategory.archive): That row not found.',
          requestId: 'req-1',
        },
      },
    });
    await screen.findByText('Sales');
    await userEvent.click(within(rowOf('Sales')).getByRole('button', { name: 'Archive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/That row not found/)).toBeInTheDocument();
    expect(within(rowOf('Sales')).getByText('Archived — not saved yet')).toBeInTheDocument();
  });

  it('keeps codes off the lists, with nothing that puts them back', async () => {
    // A module title is a sentence; a code beside it is the same thing again in shouting case.
    // It is on the module's own page, where it is the value being set.
    render();
    await screen.findByText('Sales');

    expect(screen.queryByText('SALES')).not.toBeInTheDocument();
    expect(screen.queryByText('PROSPECT_LIST')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show codes')).not.toBeInTheDocument();
  });

  it('gives a reader without write permission the lists and none of the controls', async () => {
    render(READER);
    await screen.findByText('Sales');

    expect(screen.queryByRole('button', { name: '+ Add category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    await openTab('Modules');
    expect(screen.getByText('Building Your Prospect List')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
  });
});
