import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession } from '@test/harness';
import type { ApiError } from '@/lib/api-client';
import type { PlaybookBody } from '@/lib/recruitment-playbook';
import { placeViolations, rawBody, RecruitmentPlaybookEditor, toBody, toForm } from './recruitment-playbook-tab';

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

/** The AgencyBoost words, shortened: the read's `playbook.defaults`. */
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

/** The bounds as the API serves them with the read (invariant §7): the editor declares none of its own. */
const LIMITS = { textMax: 600, benefitsMax: 6 };
const PLAYBOOK = { defaults: DEFAULTS, vocabulary: VOCABULARY, limits: LIMITS };
const SUPER_ADMIN = makeMe({ permissions: ['company_template:read', 'company_template:write'] });

/**
 * The section's editor over a draft held as the section page holds it: `onChange` is what the draft is saved from.
 * `refusal` is the section's last publish, refused.
 */
function mount({
  payload = DEFAULTS as unknown as Record<string, unknown>,
  refusal = null,
  disabled = false,
  limits = LIMITS,
}: { payload?: Record<string, unknown>; refusal?: ApiError | null; disabled?: boolean; limits?: typeof LIMITS } = {}) {
  const sent: Record<string, unknown>[] = [];
  function Section() {
    const [draft, setDraft] = useState(payload);
    return (
      <RecruitmentPlaybookEditor
        payload={draft}
        playbook={{ ...PLAYBOOK, limits }}
        disabled={disabled}
        refusal={refusal}
        onChange={(next) => { sent.push(next); setDraft(next); }}
      />
    );
  }
  const view = renderWithSession(<Section />, { me: SUPER_ADMIN });
  return { sent, ...view };
}

const card = (name: string) => within(screen.getByRole('group', { name }));
async function openCard(name: string) {
  await userEvent.click(card(name).getByRole('button', { name: 'Edit' }));
  return card(name);
}

/**
 * **A template's *Rekrutmen* section** (P19.4-T5 AC-6; ADR-0210 §1): the recruitment playbook as a section of the
 * template, its draft saved as it is typed and its words checked at *Terbitkan* — the editor the section page draws for
 * the `recruitment_playbook` kind. The words in Indonesian are `recruitment-playbook-tab-in-indonesian.spec.tsx`'s.
 */
describe('P19.4-T5 AC-6 the Rekrutmen section’s editor', () => {
  it('P19.4-T5 AC-6 a template with none says so and offers two starts, each becoming the draft', async () => {
    const { sent } = mount({ payload: {} });
    expect(screen.getByText(/This template has no recruitment playbook yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start from the AgencyBoost words' }));
    expect(sent.at(-1)).toEqual(DEFAULTS);
    expect(await screen.findByRole('group', { name: 'Retiree' })).toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 starts from nothing: every field empty in the draft, every card to write', async () => {
    const { sent } = mount({ payload: {} });
    await userEvent.click(screen.getByRole('button', { name: 'Start from nothing' }));
    const draft = sent.at(-1) as unknown as PlaybookBody;
    expect(Object.keys(draft.profiles)).toEqual(VOCABULARY.types.map((t) => t.code));
    expect(draft.nextAction).toBe('');
    expect(card('Retiree').getByText('Not written yet.')).toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 reads a card per candidate type, Objections and Next action, each as text until Edit', () => {
    mount();
    for (const { label } of VOCABULARY.types) expect(screen.getByRole('group', { name: label })).toBeInTheDocument();
    expect(card('Retiree').getByText('Re-entering the workforce after time away.')).toBeInTheDocument();
    expect(card('Next action').getByText(DEFAULTS.nextAction)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // Its draft, its Terbitkan and a conflict are the section's draft bar's: none of its own here.
    expect(screen.queryByRole('button', { name: /Save playbook|Discard/ })).not.toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 what is typed goes into the draft as it is typed, a trailing space kept for the next word', async () => {
    const { sent } = mount();
    const retiree = await openCard('Retiree');
    const tagline = retiree.getByLabelText('Tagline');
    await userEvent.clear(tagline);
    await userEvent.type(tagline, 'Back at work ');
    expect((sent.at(-1) as unknown as PlaybookBody).profiles.retiree.tagline).toBe('Back at work ');
    // Closing the card keeps it: it is in the draft.
    await userEvent.click(retiree.getByRole('button', { name: 'Close' }));
    expect(card('Retiree').getByText('Back at work')).toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 a refused Terbitkan: each violation beside its field, its card opened, the first focused; an edit clears it', async () => {
    const refusal: ApiError = {
      code: 'VALIDATION_FAILED',
      message: 'This playbook cannot be published: body.profiles.retiree.tagline — Must not be empty.',
      requestId: 'req-1',
      details: {
        violations: [
          { field: 'body.profiles.retiree.tagline', message: 'Must not be empty.' },
          { field: 'body.nextAction', message: 'Must be 600 characters or fewer.' },
          { field: 'body', message: 'Something about the whole.' },
        ],
      },
    };
    mount({ refusal });
    expect(screen.getByText('Not published. Each field marked below needs a fix.')).toBeInTheDocument();
    expect(screen.getByText('body — Something about the whole.')).toBeInTheDocument();
    const tagline = card('Retiree').getByLabelText('Tagline');
    expect(tagline).toHaveAttribute('aria-invalid', 'true');
    expect(card('Retiree').getByText('Must not be empty.')).toBeInTheDocument();
    expect(card('Next action').getByText('Must be 600 characters or fewer.')).toBeInTheDocument();
    expect(tagline).toHaveFocus();
    await userEvent.type(tagline, 'x');
    expect(card('Retiree').queryByText('Must not be empty.')).not.toBeInTheDocument();
  });

  it('P19.4-T5 AC-6 an archived template is read, never written: no start, every field disabled', async () => {
    mount({ payload: {}, disabled: true });
    expect(screen.queryByRole('button', { name: 'Start from nothing' })).not.toBeInTheDocument();
  });

  it('AC-4 draws every word as text, never as markup', () => {
    const body = structuredClone(DEFAULTS);
    body.nextAction = '<img src=x onerror="alert(1)"> Book it.';
    mount({ payload: body as unknown as Record<string, unknown> });
    expect(card('Next action').getByText('<img src=x onerror="alert(1)"> Book it.')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('stops a text and the benefits where the read says, not where a copy says (invariant §7)', async () => {
    mount({ limits: { textMax: 40, benefitsMax: 4 } });
    const fresh = await openCard('Fresh grad');
    expect(fresh.getByLabelText('Label')).toHaveAttribute('maxLength', '40');
    const add = fresh.getByRole('button', { name: /Add benefit/ });
    while (fresh.getAllByRole('textbox', { name: /^Benefit \d$/ }).length < 4) await userEvent.click(add);
    expect(add).toBeDisabled();
  });

  it('has no axe violations, with a candidate type and the objections open', async () => {
    const { container } = mount();
    await openCard('Retiree');
    await openCard('Objections');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
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
  });

  it('round-trips the AgencyBoost words unchanged; toBody trims, rawBody keeps what was typed', () => {
    expect(toBody(toForm(DEFAULTS, VOCABULARY), VOCABULARY)).toEqual(DEFAULTS);
    const form = toForm(DEFAULTS, VOCABULARY);
    form.nextAction = '  Book the date.  ';
    expect(toBody(form, VOCABULARY).nextAction).toBe('Book the date.');
    expect((rawBody(form, VOCABULARY) as unknown as PlaybookBody).nextAction).toBe('  Book the date.  ');
    expect(toForm(rawBody(form, VOCABULARY) as unknown as PlaybookBody, VOCABULARY)).toEqual(form);
  });

  it('places a violation by its path — dotted, bracketed, or with `body.` — on the nearest slot', () => {
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
    vi.unstubAllGlobals();
  });
});
