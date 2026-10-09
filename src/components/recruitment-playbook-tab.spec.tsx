import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import type { PlaybookBody, PlaybookDto } from '@/lib/recruitment-playbook';
import { blankFields, placeViolations, RecruitmentPlaybookTab, toBody, toForm } from './recruitment-playbook-tab';

/** The brief's vocabulary as the API serves it: codes and chip labels verbatim (`Recruitment_Section.html:305-330`). */
const VOCABULARY = {
  types: [
    { code: 'fresh-grad', label: 'Fresh grad' },
    { code: 'career-switch', label: 'Career switcher' },
    { code: 'business-owner', label: 'Business owner' },
    { code: 'retiree', label: 'Retiree' },
    { code: 'other-insurer', label: 'Agent (other insurer)' },
  ],
  motivations: [
    { code: 'side-income', label: 'Extra income on the side' },
    { code: 'full-career', label: 'Full career change' },
    { code: 'flexibility', label: 'Flexibility / time freedom' },
    { code: 'leadership', label: 'Building a team / leadership' },
  ],
  hesitations: [
    { code: 'no-experience', label: 'No sales experience' },
    { code: 'stable-job', label: 'Already has a stable job' },
    { code: 'reputation', label: 'Insurance has a bad reputation' },
    { code: 'no-network', label: 'No network to sell to' },
    { code: 'time', label: 'Worried about time commitment' },
  ],
};

const profile = (label: string, tagline: string) => ({
  label,
  tagline,
  goodFitFor: `${label}: who this fits.`,
  benefits: [`${label} benefit one.`, `${label} benefit two.`],
  openings: Object.fromEntries(VOCABULARY.motivations.map(({ code }) => [code, `${label} opening, ${code}?`])),
});

/** The AgencyBoost words, shortened: the API's `defaults`. */
const DEFAULTS: PlaybookBody = {
  profiles: {
    'fresh-grad': profile('Fresh graduate', 'New to the workforce, deciding on a first real career move.'),
    'career-switch': profile('Career switcher', 'Currently employed, evaluating whether to leave a stable job.'),
    'business-owner': profile('Business owner', 'Already running something.'),
    retiree: profile('Retiree', 'Re-entering the workforce after time away.'),
    'other-insurer': profile('Agent (other insurer)', 'Currently licensed and selling for a different insurance company.'),
  },
  objections: Object.fromEntries(VOCABULARY.hesitations.map(({ code }) => [code, {
    theySay: `They say: ${code}.`, youSay: `You say: ${code}.`,
  }])),
  profileObjections: {
    retiree: {
      time: {
        theySay: 'I’m not sure I have much time to give this right now.',
        youSay: 'That’s exactly why activity is tracked by outcome, not hours.',
      },
    },
  },
  nextAction: 'Send them the Opportunity Overview from Pitch Materials.',
};

const STORED: PlaybookDto = {
  companyId: 'c1', version: 3, body: DEFAULTS, updatedAt: '2026-10-09T07:05:00.000Z', updatedBy: { name: 'Root' },
};

const PATH = '/admin/companies/c1/recruitment-playbook';
/** The bounds as the API serves them with the read (invariant §7): the tab declares none of its own. */
const LIMITS = { textMax: 600, benefitsMax: 6 };
const PLAYBOOK_TEXT_MAX = LIMITS.textMax;
const PLAYBOOK_BENEFITS_MAX = LIMITS.benefitsMax;
const read = (playbook: PlaybookDto | null, limits = LIMITS) =>
  ({ body: { playbook, defaults: DEFAULTS, vocabulary: VOCABULARY, limits } });
/** The Super Admin: reads the template and writes the playbook. */
const WRITER = makeMe({ permissions: ['company_template:read', 'recruitment_playbook:write'] });

/** The tab, over a stubbed API; `sent` collects every PUT's body. */
function mount(
  { get = [read(STORED)], put = [], me = WRITER }: { get?: StubReply[]; put?: StubReply[]; me?: ReturnType<typeof makeMe> } = {},
) {
  const sent: { version: number | null; body: PlaybookBody }[] = [];
  const saved: StubReply = ({ body }) => {
    const write = body as { version: number | null; body: PlaybookBody };
    sent.push(write);
    return { body: { ...STORED, version: (write.version ?? 0) + 1, body: write.body, updatedAt: '2026-10-09T08:00:00.000Z' } };
  };
  const stub = stubFetch({
    [`GET ${PATH}`]: get,
    [`PUT ${PATH}`]: put.length > 0 ? put : [saved],
  });
  renderWithSession(<RecruitmentPlaybookTab companyId="c1" />, { me });
  return { stub, sent, saved };
}

/** A card, found by its heading as a reader finds it. */
const card = (name: string) => within(screen.getByRole('group', { name }));
async function openCard(name: string) {
  await userEvent.click(card(name).getByRole('button', { name: 'Edit' }));
  return card(name);
}
const puts = (stub: ReturnType<typeof mount>['stub']) => stub.calls.filter((c) => c.init.method === 'PUT');

describe('the Company template’s Recruitment tab (P17-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the company’s playbook: a card per candidate type, the answers, and who saved which version', async () => {
    mount();
    expect(await screen.findByText('This playbook is live.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Version 3 · saved by Root on October 9, 2026 · 2:05 PM');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Fresh grad', 'Career switcher', 'Business owner', 'Retiree', 'Agent (other insurer)', 'Objections', 'Next action',
    ]);
    expect(card('Fresh grad').getByText('Fresh graduate')).toBeInTheDocument();
    expect(card('Fresh grad').getByText('New to the workforce, deciding on a first real career move.')).toBeInTheDocument();
    expect(card('Next action').getByText('Send them the Opportunity Overview from Pitch Materials.')).toBeInTheDocument();
    // Nothing changed, so nothing to save or discard.
    expect(screen.getByRole('button', { name: 'Save playbook' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled();
  });

  it('opens a candidate type to every field the plan prints for it, in the plan’s order', async () => {
    mount();
    await screen.findByText('This playbook is live.');
    const fresh = await openCard('Fresh grad');
    expect(fresh.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-expanded', 'true');
    expect(fresh.getByLabelText('Label')).toHaveValue('Fresh graduate');
    expect(fresh.getByLabelText('Tagline')).toHaveValue('New to the workforce, deciding on a first real career move.');
    expect(fresh.getByLabelText('Good fit for')).toHaveValue('Fresh graduate: who this fits.');
    expect(fresh.getByLabelText('Benefit 1')).toHaveValue('Fresh graduate benefit one.');
    expect(fresh.getByLabelText('Benefit 2')).toHaveValue('Fresh graduate benefit two.');
    for (const { code, label } of VOCABULARY.motivations) {
      expect(fresh.getByLabelText(label)).toHaveValue(`Fresh graduate opening, ${code}?`);
    }
    expect(fresh.getByLabelText('Label')).toHaveAttribute('maxLength', String(PLAYBOOK_TEXT_MAX));
    // No answer of its own yet: each hesitation is offered.
    const add = fresh.getByRole('group', { name: 'Add its own objection for' });
    expect(within(add).getAllByRole('button').map((b) => b.textContent))
      .toEqual(VOCABULARY.hesitations.map(({ label }) => `+ ${label}`));
  });

  it('keeps what was typed when a card is closed, and saves the whole playbook pinned to its version', async () => {
    const { stub, sent } = mount();
    await screen.findByText('This playbook is live.');
    const fresh = await openCard('Fresh grad');
    await userEvent.clear(fresh.getByLabelText('Label'));
    await userEvent.type(fresh.getByLabelText('Label'), '  Fresh graduate, new words  ');
    await userEvent.click(fresh.getByRole('button', { name: 'Close' }));
    expect(card('Fresh grad').getByText(/Fresh graduate, new words/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(puts(stub)[0].url).toContain(PATH);
    expect(sent[0].version).toBe(3);
    expect(sent[0].body).toEqual({
      ...DEFAULTS,
      profiles: { ...DEFAULTS.profiles, 'fresh-grad': { ...DEFAULTS.profiles['fresh-grad'], label: 'Fresh graduate, new words' } },
    });
    expect(await screen.findByText('Version 4 · saved by Root on October 9, 2026 · 3:00 PM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save playbook' })).toBeDisabled();
  });

  it('discards edits back to the stored playbook', async () => {
    mount();
    await screen.findByText('This playbook is live.');
    const next = await openCard('Next action');
    await userEvent.type(next.getByRole('textbox', { name: 'Next action' }), ' Today.');
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(card('Next action').getByText('Send them the Opportunity Overview from Pitch Materials.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save playbook' })).toBeDisabled();
  });

  describe('a company with none', () => {
    it('says so, and offers to start from the AgencyBoost words or from nothing', async () => {
      mount({ get: [read(null)] });
      expect(await screen.findByText(
        'This company has no recruitment playbook yet, so its agents’ Attack Plan has nothing to build from.',
      )).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start from the AgencyBoost words' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start from nothing' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save playbook' })).toBeNull();
    });

    it('starts from the AgencyBoost words, saving nothing until Save, then creates it at no version', async () => {
      const { stub, sent } = mount({ get: [read(null)] });
      await userEvent.click(await screen.findByRole('button', { name: 'Start from the AgencyBoost words' }));
      expect(screen.getByText('Not saved yet.')).toBeInTheDocument();
      expect(card('Retiree').getByText('Re-entering the workforce after time away.')).toBeInTheDocument();
      const retiree = await openCard('Retiree');
      expect(within(retiree.getByRole('group', { name: 'Worried about time commitment' })).getByLabelText('They say'))
        .toHaveValue('I’m not sure I have much time to give this right now.');
      expect(puts(stub)).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toEqual({ version: null, body: DEFAULTS });
      expect(await screen.findByText('This playbook is live.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Version 1 · saved by Root');
    });

    it('starts from nothing: every field empty, and Save names each one rather than sending', async () => {
      const { stub } = mount({ get: [read(null)] });
      await userEvent.click(await screen.findByRole('button', { name: 'Start from nothing' }));
      expect(card('Fresh grad').getByText('Not written yet.')).toBeInTheDocument();
      expect(card('Next action').getByText('Not written yet.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));

      expect(puts(stub)).toHaveLength(0);
      expect(screen.getByText('Not saved. Each field marked below needs a fix.')).toBeInTheDocument();
      // Every card holding one opened, and the first marked field is where the reader lands.
      const label = card('Fresh grad').getByLabelText('Label');
      expect(label).toHaveAttribute('aria-invalid', 'true');
      expect(label).toHaveAccessibleDescription('Write this before saving.');
      expect(label).toHaveFocus();
      expect(card('Objections').getAllByText('Write this before saving.')).toHaveLength(2 * VOCABULARY.hesitations.length);
      expect(card('Next action').getByText('Write this before saving.')).toBeInTheDocument();
      // A type's own objections are optional: none is asked for.
      expect(card('Retiree').queryByRole('group', { name: 'Worried about time commitment' })).toBeNull();

      await userEvent.type(label, 'Fresh graduate');
      expect(label).not.toHaveAttribute('aria-invalid');
    });

    it('discards a start, back to the choice', async () => {
      mount({ get: [read(null)] });
      await userEvent.click(await screen.findByRole('button', { name: 'Start from nothing' }));
      await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
      expect(screen.getByRole('button', { name: 'Start from the AgencyBoost words' })).toBeInTheDocument();
    });
  });

  describe('benefits', () => {
    it('adds up to the API’s most, and says why it stops', async () => {
      mount();
      await screen.findByText('This playbook is live.');
      const fresh = await openCard('Fresh grad');
      const add = fresh.getByRole('button', { name: '+ Add benefit' });
      for (let n = 2; n < PLAYBOOK_BENEFITS_MAX; n += 1) await userEvent.click(add);
      expect(fresh.getAllByRole('textbox', { name: /^Benefit \d$/ })).toHaveLength(PLAYBOOK_BENEFITS_MAX);
      expect(add).toBeDisabled();
      expect(add).toHaveAccessibleDescription(`A candidate type lists at most ${PLAYBOOK_BENEFITS_MAX} benefits.`);
    });

    it('removes the one asked for, and never the last', async () => {
      const { sent } = mount();
      await screen.findByText('This playbook is live.');
      const fresh = await openCard('Fresh grad');
      await userEvent.click(fresh.getByRole('button', { name: 'Remove benefit 1' }));
      expect(fresh.getByLabelText('Benefit 1')).toHaveValue('Fresh graduate benefit two.');
      const last = fresh.getByRole('button', { name: 'Remove benefit 1' });
      expect(last).toBeDisabled();
      expect(last).toHaveAttribute('title', 'A candidate type lists at least one benefit.');

      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].body.profiles['fresh-grad'].benefits).toEqual(['Fresh graduate benefit two.']);
    });
  });

  describe('a candidate type’s own objections', () => {
    it('adds one for a hesitation and saves it under the type; removes another', async () => {
      const { sent } = mount();
      await screen.findByText('This playbook is live.');

      const retiree = await openCard('Retiree');
      await userEvent.click(retiree.getByRole('button', { name: 'Remove its own objection for Worried about time commitment' }));
      expect(retiree.queryByRole('group', { name: 'Worried about time commitment' })).toBeNull();
      expect(within(retiree.getByRole('group', { name: 'Add its own objection for' }))
        .getByRole('button', { name: '+ Worried about time commitment' })).toBeInTheDocument();

      const fresh = await openCard('Fresh grad');
      await userEvent.click(fresh.getByRole('button', { name: '+ No sales experience' }));
      const box = within(fresh.getByRole('group', { name: 'No sales experience' }));
      await userEvent.type(box.getByLabelText('They say'), 'I just graduated.');
      await userEvent.type(box.getByLabelText('You say'), 'So did half this team.');

      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].body.profileObjections).toEqual({
        'fresh-grad': { 'no-experience': { theySay: 'I just graduated.', youSay: 'So did half this team.' } },
      });
    });

    it('asks for both sides of one added and left empty', async () => {
      const { stub } = mount();
      await screen.findByText('This playbook is live.');
      const fresh = await openCard('Fresh grad');
      await userEvent.click(fresh.getByRole('button', { name: '+ Already has a stable job' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));
      expect(puts(stub)).toHaveLength(0);
      const box = within(fresh.getByRole('group', { name: 'Already has a stable job' }));
      expect(box.getByLabelText('They say')).toHaveAccessibleDescription('Write this before saving.');
      expect(box.getByLabelText('You say')).toHaveAccessibleDescription('Write this before saving.');
    });
  });

  describe('refusals', () => {
    const conflict = { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Saved by somebody else first.', requestId: 'r-1' } } };
    const FRESH: PlaybookDto = {
      ...STORED,
      version: 4,
      body: { ...DEFAULTS, nextAction: 'Book their licensing date before they leave.' },
      updatedAt: '2026-10-09T07:10:00.000Z',
      updatedBy: { name: 'Asih' },
    };

    async function editAndSave() {
      await screen.findByText('This playbook is live.');
      const fresh = await openCard('Fresh grad');
      await userEvent.clear(fresh.getByLabelText('Label'));
      await userEvent.type(fresh.getByLabelText('Label'), 'My new label');
      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));
      return fresh;
    }

    it('409: reads the playbook again, keeps the edits, and says which version is stored now', async () => {
      const sent: unknown[] = [];
      mount({
        get: [read(STORED), read(FRESH)],
        put: [conflict, ({ body }) => { sent.push(body); return { body: { ...FRESH, version: 5 } }; }],
      });
      const fresh = await editAndSave();

      const alert = await screen.findByText('This playbook was changed somewhere else.');
      const notice = alert.closest('[role="alert"]') as HTMLElement;
      expect(notice).toHaveTextContent(
        'It is now version 4, saved by Asih on October 9, 2026 · 2:10 PM. Your edits are still here, and saving them replaces that version.',
      );
      expect(fresh.getByLabelText('Label')).toHaveValue('My new label');
      expect(screen.getByRole('status')).toHaveTextContent('Version 4 · saved by Asih');

      await userEvent.click(within(notice).getByRole('button', { name: 'Keep my edits' }));
      expect(screen.queryByText('This playbook was changed somewhere else.')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Save playbook' }));
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({ version: 4, body: { profiles: { 'fresh-grad': { label: 'My new label' } } } });
    });

    it('409: offers to load the version stored now instead', async () => {
      mount({ get: [read(STORED), read(FRESH)], put: [conflict] });
      await editAndSave();
      await userEvent.click(await screen.findByRole('button', { name: 'Load version 4' }));
      expect(card('Next action').getByText('Book their licensing date before they leave.')).toBeInTheDocument();
      expect(card('Fresh grad').getByText('Fresh graduate')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save playbook' })).toBeDisabled();
      expect(screen.queryByText('This playbook was changed somewhere else.')).toBeNull();
    });

    it('400: each violation beside the field it names, its card opened; what names none in the banner', async () => {
      mount({
        put: [{
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_FAILED', message: 'Refused.', requestId: 'r-2',
              // The playbook check's own shape (`recruitment-playbook-input.ts`): a field and its message.
              details: {
                violations: [
                  { field: 'body.profiles.fresh-grad.tagline', message: 'Must be 600 characters or fewer.' },
                  { field: "body.objections['time'].youSay", message: 'Must not be empty.' },
                  { field: 'body.profiles.retiree.openings', message: 'Must be an object of fields.' },
                  { field: 'body.profiles.retiree.benefits[1]', message: 'Must not be empty.' },
                  { field: 'body', message: 'Must be an object of fields.' },
                ],
              },
            },
          },
        }],
      });
      await editAndSave();

      expect(await screen.findByText('Not saved. Each field marked below needs a fix.')).toBeInTheDocument();
      expect(card('Fresh grad').getByLabelText('Tagline')).toHaveAccessibleDescription('Must be 600 characters or fewer.');
      expect(within(card('Objections').getByRole('group', { name: 'Worried about time commitment' })).getByLabelText('You say'))
        .toHaveAccessibleDescription('Must not be empty.');
      // A path smaller than any field lands on its card.
      expect(card('Retiree').getByText('Must be an object of fields.')).toBeInTheDocument();
      expect(card('Retiree').getByLabelText('Benefit 2')).toHaveAccessibleDescription('Must not be empty.');
      // What names nothing on the screen goes to the banner, field and all.
      expect(screen.getByText('body — Must be an object of fields.')).toBeInTheDocument();
      expect(card('Fresh grad').getByLabelText('Tagline')).toHaveFocus();

      // Changing the field takes what was said about it away.
      await userEvent.type(card('Fresh grad').getByLabelText('Tagline'), '!');
      expect(card('Fresh grad').getByLabelText('Tagline')).not.toHaveAttribute('aria-invalid');
    });

    it('400 naming nothing on the screen: the server’s words, in the banner', async () => {
      mount({
        put: [{
          status: 400,
          body: { error: { code: 'VALIDATION_FAILED', message: 'The body could not be read.', requestId: 'r-3' } },
        }],
      });
      await editAndSave();
      expect(await screen.findByText('The body could not be read.')).toBeInTheDocument();
      expect(screen.queryByText('Not saved. Each field marked below needs a fix.')).toBeNull();
    });

    it('any other refusal: the server’s words, with the edits kept', async () => {
      mount({
        put: [{ status: 403, body: { error: { code: 'FORBIDDEN', message: 'You may not write this playbook.', requestId: 'r-4' } } }],
      });
      const fresh = await editAndSave();
      expect(await screen.findByText('You may not write this playbook.')).toBeInTheDocument();
      expect(fresh.getByLabelText('Label')).toHaveValue('My new label');
    });

    it('a failed read says so, and tries again', async () => {
      mount({
        get: [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r-5' } } },
          read(STORED),
        ],
      });
      expect(await screen.findByText('Could not read this company’s recruitment playbook. Something broke.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('This playbook is live.')).toBeInTheDocument();
    });
  });

  it('AC-4: draws every word as text, never as markup', async () => {
    const marked: PlaybookDto = {
      ...STORED,
      body: {
        ...DEFAULTS,
        profiles: {
          ...DEFAULTS.profiles,
          'fresh-grad': { ...DEFAULTS.profiles['fresh-grad'], label: '<b>Bold</b> grad', tagline: '<script>alert(1)</script>' },
        },
        nextAction: '<b>Now</b>',
      },
      updatedBy: { name: '<b>Root</b>' },
    };
    mount({ get: [read(marked)] });
    expect(await screen.findByText('<b>Bold</b> grad')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.getByText('<b>Now</b>')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('saved by <b>Root</b>');
    expect(document.body.querySelector('b, script')).toBeNull();
  });

  it('has no axe violations, with a candidate type and the objections open', async () => {
    mount();
    await screen.findByText('This playbook is live.');
    await openCard('Retiree');
    await openCard('Objections');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });
});

describe('the playbook’s form and its refusals', () => {
  it('draws every type, motivation and hesitation of the vocabulary, whatever the body lacks', () => {
    const form = toForm(null, VOCABULARY);
    expect(Object.keys(form.profiles)).toEqual(VOCABULARY.types.map((t) => t.code));
    expect(form.profiles.retiree.benefits).toEqual(['']);
    expect(Object.keys(form.profiles.retiree.openings)).toEqual(VOCABULARY.motivations.map((m) => m.code));
    expect(Object.keys(form.objections)).toEqual(VOCABULARY.hesitations.map((h) => h.code));
    expect(form.profileObjections.retiree).toEqual({});
    expect(blankFields(form, VOCABULARY)).toHaveLength(
      VOCABULARY.types.length * (3 + 1 + VOCABULARY.motivations.length) + VOCABULARY.hesitations.length * 2 + 1,
    );
  });

  it('round-trips the AgencyBoost words unchanged, and trims what it sends', () => {
    expect(toBody(toForm(DEFAULTS, VOCABULARY), VOCABULARY)).toEqual(DEFAULTS);
    const form = toForm(DEFAULTS, VOCABULARY);
    form.nextAction = '  Book the date.  ';
    expect(toBody(form, VOCABULARY).nextAction).toBe('Book the date.');
  });

  it('places a violation by its path — dotted, bracketed, or with `body.` — on the nearest slot', () => {
    const form = toForm(DEFAULTS, VOCABULARY);
    const slots = new Set([
      'profiles.retiree', 'profiles.retiree.benefits', 'profiles.retiree.benefits.1', 'objections', 'nextAction',
    ]);
    const { placed, rest } = placeViolations({
      violations: [
        'body.profiles.retiree.benefits[1] must not be empty.',
        'profiles.retiree.benefits must have 1 to 6 items',
        'profileObjections.retiree is not an object.',
        'objections.time is required.',
        'nextAction: must not be empty.',
        'Every hesitation needs an answer.',
        42,
      ],
    }, slots);
    expect(placed).toEqual({
      'profiles.retiree.benefits.1': 'Must not be empty.',
      'profiles.retiree.benefits': 'Must have 1 to 6 items',
      'profiles.retiree': 'Is not an object.',
      objections: 'Is required.',
      nextAction: 'Must not be empty.',
    });
    expect(rest).toEqual(['Every hesitation needs an answer.']);
    expect(form).toBeTruthy();
    // The playbook check's `{ field, message }`, read the same way.
    expect(placeViolations({
      violations: [
        { field: 'body.profiles.retiree.benefits[1]', message: 'Must not be empty.' },
        { field: 'body.profileObjections.retiree.time', message: 'Must be an object of fields.' },
        { field: 'body.profiles' },
        { message: 'no field' },
      ],
    }, slots)).toEqual({
      placed: { 'profiles.retiree.benefits.1': 'Must not be empty.', 'profiles.retiree': 'Must be an object of fields.' },
      rest: ['body.profiles'],
    });
    expect(placeViolations(undefined, slots)).toEqual({ placed: {}, rest: [] });
  });
});

/**
 * **The bounds the fields enforce are the API's**, served with the read (invariant §7): the tab declares
 * none, so a bound changed on the server is the bound on screen at the next read.
 */
describe('the playbook’s bounds are the API’s (invariant §7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stops a text and the benefits where the read says, not where a copy says', async () => {
    mount({ get: [read(STORED, { textMax: 40, benefitsMax: 4 })] });
    await screen.findByRole('group', { name: 'Fresh grad' });
    const fresh = await openCard('Fresh grad');
    expect(fresh.getByLabelText('Label')).toHaveAttribute('maxLength', '40');
    const add = fresh.getByRole('button', { name: /Add benefit/ });
    while (fresh.getAllByRole('textbox', { name: /^Benefit \d$/ }).length < 4) await userEvent.click(add);
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('A candidate type lists at most 4 benefits.');
  });
});

describe('who may save (recruitment_playbook:write)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers no Save, Discard or Start to a reader without the write grant', async () => {
    mount({ get: [read(null)], me: makeMe({ permissions: ['company_template:read'] }) });
    expect(await screen.findByText(/has no recruitment playbook yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start from the AgencyBoost words' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('offers no Save to a reader without the write grant on a stored playbook', async () => {
    mount({ me: makeMe({ permissions: ['company_template:read'] }) });
    await screen.findByRole('group', { name: 'Fresh grad' });
    await openCard('Fresh grad');
    expect(screen.queryByRole('button', { name: 'Save playbook' })).not.toBeInTheDocument();
  });
});
