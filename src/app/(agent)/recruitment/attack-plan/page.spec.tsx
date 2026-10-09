import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch, type StubReply } from '@test/harness';
import {
  BRIEF, HESITATIONS, MOTIVATIONS, NEXT_ACTION, plan, READ_ONLY_RINA, READERS, refused, RETIREE_PLAN, RINA_ME,
  serverError, SHELL_STUBS, TYPES, view,
} from '@test/recruitment-plan-fixtures';
import { SessionContext } from '@/lib/session';
import RecruitmentLayout from '../layout';
import RecruitmentAttackPlanPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/recruitment/attack-plan',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Query = Record<string, string>;
type Routes = Record<string, StubReply | StubReply[]>;

/** The page at an address, as the App Router hands it its query: a settled thenable. */
const searchParams = (query: Query) => Object.assign(Promise.resolve(query), { status: 'fulfilled', value: query });

const page = (query: Query) => <RecruitmentLayout><RecruitmentAttackPlanPage searchParams={searchParams(query)} /></RecruitmentLayout>;

/** The bare read answers the vocabulary; a read with a brief, `plan()`. */
const answer = ({ url }: { url: string }) => ({ body: url.includes('?') ? view(plan()) : view() });

function show(query: Query = {}, routes: Routes = {}, me = RINA_ME) {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer, ...routes });
  const shown = renderInLayout(AgentLayout, page(query), { me });
  return { ...stub, ...shown };
}

/** The same page at a new address, the tree kept — how the page keeps the brief and knows a plan was asked for. */
function navigate(shown: ReturnType<typeof renderInLayout>, query: Query) {
  shown.rerender(
    <SessionContext.Provider value={shown.session}>
      <Suspense fallback={null}>
        <AgentLayout>{page(query)}</AgentLayout>
      </Suspense>
    </SessionContext.Provider>,
  );
}

const reads = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/recruitment/')).map((c) => c.url);
const API = 'http://api.test/api/v1/recruitment/attack-plan';
const PLAN_URL = `${API}?type=fresh-grad&motivation=side-income,leadership&hesitation=no-experience,time`;

const briefHeading = () => screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
const result = (name = 'Fresh graduate') => screen.findByRole('heading', { level: 2, name });
const group = (name: string) => screen.getByRole('group', { name });
const chip = (question: string, name: string) => within(group(question)).getByRole('button', { name });
const pressed = (question: string) =>
  within(group(question)).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

async function chooseTheBrief() {
  await userEvent.click(chip('Candidate type', 'Fresh grad'));
  // Clicked out of order: the address lists them in the chips' order (`:521`).
  await userEvent.click(chip('What\'s driving them', 'Building a team / leadership'));
  await userEvent.click(chip('What\'s driving them', 'Extra income on the side'));
  await userEvent.click(chip('Their biggest hesitation', 'Worried about time commitment'));
  await userEvent.click(chip('Their biggest hesitation', 'No sales experience'));
}

describe('/recruitment/attack-plan, the Recruitment Attack Plan (P17-T3)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the page and the brief, verbatim (AC-2, AC-3)', () => {
    it('P17-T3 AC-2 the title, the sub-line and the two tabs as links, Attack Plan the current one', async () => {
      show();
      await briefHeading();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Recruitment$/);
      expect(screen.getByText('Build the pitch on the fly, or pull the ready-made materials to show a candidate.')).toBeInTheDocument();
      const tabs = within(screen.getByRole('navigation', { name: 'Recruitment' })).getAllByRole('link');
      expect(tabs.map((t) => [t.textContent, t.getAttribute('href'), t.getAttribute('aria-current')])).toEqual([
        ['Attack Plan', '/recruitment/attack-plan', 'page'],
        ['Pitch Materials', '/recruitment/pitch-materials', null],
      ]);
    });

    it('P17-T3 AC-1 the sidebar’s Recruitment is current here', async () => {
      show();
      await briefHeading();
      expect(screen.getByRole('link', { name: 'Recruitment' })).toHaveAttribute('aria-current', 'page');
    });

    it('P17-T3 AC-3 the step pills, the card and its hint; the chips read once, with no brief', async () => {
      const { calls } = show();
      await briefHeading();
      const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
      expect(steps.map((s) => s.textContent)).toEqual(['11 Candidate brief', '22 Recruitment plan']);
      expect(steps[0]).toHaveAttribute('aria-current', 'step');
      expect(screen.getByText('Three questions. Enough to get an opening line, a benefits list, and an objection response, fast.'))
        .toBeInTheDocument();
      expect(reads(calls)).toEqual([API]);
    });

    it('P17-T3 AC-3, AC-8 three labelled groups of toggle buttons, the chips verbatim, nothing chosen', async () => {
      show();
      await briefHeading();
      const labels = (name: string) => within(group(name)).getAllByRole('button').map((b) => b.textContent);
      expect(labels('Candidate type')).toEqual(TYPES.map((t) => t.label));
      expect(labels('What\'s driving them')).toEqual(MOTIVATIONS.map((m) => m.label));
      expect(labels('Their biggest hesitation')).toEqual(HESITATIONS.map((h) => h.label));
      expect(labels('Candidate type')).toEqual(['Fresh grad', 'Career switcher', 'Business owner', 'Retiree', 'Agent (other insurer)']);
      for (const name of ['Candidate type', 'What\'s driving them', 'Their biggest hesitation']) expect(pressed(name)).toEqual([]);
    });

    it('D-vocabulary the chips are the read’s, never declared here: a vocabulary of other words draws other chips', async () => {
      const vocabulary = {
        types: [{ code: 'fresh-grad', label: 'Lulusan baru' }],
        motivations: [{ code: 'side-income', label: 'Penghasilan tambahan' }],
        hesitations: [{ code: 'time', label: 'Waktu' }],
      };
      show({}, { 'GET /recruitment/attack-plan': { body: { hasPlaybook: true, vocabulary, plan: null } } });
      await briefHeading();
      expect(within(group('Candidate type')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lulusan baru']);
      expect(screen.queryByRole('button', { name: 'Fresh grad' })).not.toBeInTheDocument();
    });

    it('P17-T3 AC-3 Build recruitment plan: navy, full width, disabled until a type, a motivation and a hesitation', async () => {
      show();
      await briefHeading();
      const build = screen.getByRole('button', { name: 'Build recruitment plan' });
      expect(build).toHaveClass('bg-navy', 'text-white', 'w-full');
      expect(build).toBeDisabled();
      await userEvent.click(chip('Candidate type', 'Retiree'));
      await userEvent.click(chip('What\'s driving them', 'Full career change'));
      expect(build).toBeDisabled();
      await userEvent.click(chip('Their biggest hesitation', 'No network to sell to'));
      expect(build).toBeEnabled();
      // Unchoosing the only hesitation closes it again.
      await userEvent.click(chip('Their biggest hesitation', 'No network to sell to'));
      expect(build).toBeDisabled();
    });

    it('P17-T3 AC-3 a type is one of five; a motivation or a hesitation, any of them', async () => {
      show();
      await briefHeading();
      await userEvent.click(chip('Candidate type', 'Fresh grad'));
      await userEvent.click(chip('Candidate type', 'Retiree'));
      expect(pressed('Candidate type')).toEqual(['Retiree']);
      await userEvent.click(chip('What\'s driving them', 'Flexibility / time freedom'));
      await userEvent.click(chip('What\'s driving them', 'Full career change'));
      expect(pressed('What\'s driving them')).toEqual(['Full career change', 'Flexibility / time freedom']);
    });

    it('P17-T3 AC-5 Build puts the brief in the address, the answers comma-separated in the chips’ order', async () => {
      const { calls } = show();
      await briefHeading();
      await chooseTheBrief();
      await userEvent.click(screen.getByRole('button', { name: 'Build recruitment plan' }));
      expect(nav.push).toHaveBeenCalledWith(
        '/recruitment/attack-plan?type=fresh-grad&motivation=side-income,leadership&hesitation=no-experience,time',
        { scroll: false },
      );
      // Choosing reads nothing: the only read is the chips'.
      expect(reads(calls)).toEqual([API]);
    });
  });

  describe('the plan, verbatim (AC-4)', () => {
    it('P17-T3 AC-5 a refresh keeps the plan: the brief in the address is read, once', async () => {
      const { calls } = show(BRIEF);
      await result();
      expect(reads(calls)).toEqual([PLAN_URL]);
    });

    it('P17-T3 AC-4 the steps, Back, the summary with the profile’s label and the chips’ labels joined by commas', async () => {
      show(BRIEF);
      await result();
      const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
      expect(steps[1]).toHaveAttribute('aria-current', 'step');
      // Step 1's pill is not a control, as drawn; *← Back* is (`:342`, `:538-544`).
      expect(within(steps[0]).queryByRole('button')).not.toBeInTheDocument();
      const back = screen.getByRole('button', { name: 'Back' });
      expect(back.textContent).toBe('←Back');
      expect(within(back).getByText('←')).toHaveAttribute('aria-hidden', 'true');
      // *Type* is the profile's label, not the chip's: *Fresh grad* reads *Fresh graduate* (`:557`).
      expect(screen.getByLabelText('Candidate brief').textContent).toBe(
        'Type: Fresh graduateMotivation: Extra income on the side, Building a team / leadership'
        + 'Hesitation: No sales experience, Worried about time commitment',
      );
    });

    it('P17-T3 AC-4 the result’s head — Candidate profile, the label, its tagline, Plan ready — and the five blocks', async () => {
      show(BRIEF);
      await result();
      expect(screen.getByText('Candidate profile')).toBeInTheDocument();
      expect(screen.getByText('New to the workforce, deciding on a first real career move.')).toBeInTheDocument();
      expect(screen.getByText('Plan ready')).toHaveAttribute('data-tone', 'success');
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Good fit for', '11 Opening lines', '22 Lead with these benefits', '33 If they push back', '44 Next action',
      ]);
      expect(screen.getByText(/needs to know growth here isn't capped by tenure or hierarchy\.$/)).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').map((li) => li.textContent).filter((t) => t?.startsWith('No prior') || t?.startsWith('Income')))
        .toHaveLength(2);
      expect(screen.getByText(NEXT_ACTION)).toBeInTheDocument();
      // No alternatives row: the recruitment plan draws none (D-components).
      expect(screen.queryByText(/Also matches/)).not.toBeInTheDocument();
    });

    it('P17-T3 AC-4 Opening lines, each under its motivation’s tag, in the chips’ order', async () => {
      const { container } = show(BRIEF);
      await result();
      const openings = Array.from(container.querySelectorAll('[data-opening]'));
      expect(openings.map((o) => o.textContent)).toEqual([
        'Extra income on the side“Are you thinking of this as something on the side for now, or could it become your main thing if it works out?”',
        'Building a team / leadership“Where do you want to be in three years — still doing the same role, or running your own team?”',
      ]);
    });

    it('P17-T3 AC-4 one motivation: Opening line, with no tag (`:567-569`)', async () => {
      const { container } = show(
        { type: 'retiree', motivation: 'flexibility', hesitation: 'time' },
        { 'GET /recruitment/attack-plan': { body: view(RETIREE_PLAN) } },
      );
      await result('Retiree');
      expect(screen.getByRole('heading', { level: 3, name: '1 Opening line' })).toBeInTheDocument();
      expect(container.querySelector('[data-opening]')!.textContent)
        .toBe('“What\'s the actual time you have available in a normal week right now?”');
      // The retiree's own push-back, as the server chose it.
      expect(screen.getByText('“I\'m not sure I have much time to give this right now.”')).toBeInTheDocument();
    });

    it('P17-T3 AC-4 a box per hesitation, one under another — They say: “…”, You say: and the reply', async () => {
      const { container } = show(BRIEF);
      await result();
      const boxes = Array.from(container.querySelectorAll('[data-push-back]')) as HTMLElement[];
      expect(boxes.map((b) => b.getAttribute('data-push-back'))).toEqual(['no-experience', 'time']);
      expect(within(boxes[0]).getByText('They say:', { exact: false })).toHaveTextContent(
        'They say: “I don\'t have any sales experience — I don\'t think I could do this.”',
      );
      expect(within(boxes[0]).getByText('You say:')).toBeInTheDocument();
      expect(within(boxes[1]).getByText('Activity is tracked, not hours.')).toBeInTheDocument();
    });

    it('P17-T3 AC-4 every authored word is rendered as text', async () => {
      const marked = 'Halo <b>Pak</b><script>noop</script>';
      const choice = (code: string) => ({ code, label: marked });
      show(BRIEF, {
        'GET /recruitment/attack-plan': {
          body: view(plan({
            brief: { type: choice('fresh-grad'), motivations: [choice('side-income'), choice('leadership')], hesitations: [choice('time')] },
            profile: { code: 'fresh-grad', label: marked, tagline: marked, goodFitFor: marked, benefits: [marked, marked] },
            openings: [
              { motivation: choice('side-income'), text: marked },
              { motivation: choice('leadership'), text: marked },
            ],
            objections: [{ hesitation: choice('time'), theySay: marked, youSay: marked, profileOwn: false }],
            nextAction: marked,
          })),
        },
      });
      await result(marked);
      expect(document.querySelector('main b, main script')).toBeNull();
      // Summary 3, head 2, good fit 1, benefits 2, openings 2 tags + 2 lines, push-back 2, next action 1.
      expect(screen.getAllByText(/<b>Pak<\/b><script>noop<\/script>/)).toHaveLength(15);
    });
  });

  describe('the address (AC-5, D-urls)', () => {
    it('P17-T3 AC-5 Back from a plan opened by its address replaces it with the brief’s, adding no history', async () => {
      show(BRIEF);
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(nav.replace).toHaveBeenCalledWith('/recruitment/attack-plan', { scroll: false });
      expect(nav.push).not.toHaveBeenCalled();
      expect(nav.back).not.toHaveBeenCalled();
    });

    it('P17-T3 AC-5 Back from a plan this screen built goes back — the brief’s own entry', async () => {
      const stub = stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer });
      const shown = renderInLayout(AgentLayout, page({}), { me: RINA_ME });
      await briefHeading();
      await chooseTheBrief();
      await userEvent.click(screen.getByRole('button', { name: 'Build recruitment plan' }));
      navigate(shown, BRIEF);
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(nav.back).toHaveBeenCalledTimes(1);
      expect(nav.push).toHaveBeenCalledTimes(1);
      expect(nav.replace).not.toHaveBeenCalled();
      expect(reads(stub.calls)).toEqual([API, PLAN_URL]);
    });

    it('P17-T3 AC-5 back on the brief, it is as it was — read from the plan, with no second read of the chips', async () => {
      const stub = stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer });
      const shown = renderInLayout(AgentLayout, page(BRIEF), { me: RINA_ME });
      await result();
      navigate(shown, {});
      await briefHeading();
      expect(pressed('Candidate type')).toEqual(['Fresh grad']);
      expect(pressed('What\'s driving them')).toEqual(['Extra income on the side', 'Building a team / leadership']);
      expect(pressed('Their biggest hesitation')).toEqual(['No sales experience', 'Worried about time commitment']);
      expect(screen.getByRole('button', { name: 'Build recruitment plan' })).toBeEnabled();
      expect(reads(stub.calls)).toEqual([PLAN_URL]);
    });

    it('P17-T3 AC-8 Back puts the focus on the brief, not the page, once it is drawn again', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer });
      const shown = renderInLayout(AgentLayout, page(BRIEF), { me: RINA_ME });
      await result();
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      navigate(shown, {});
      await briefHeading();
      await waitFor(() => expect(document.activeElement).not.toBe(document.body));
      expect(document.activeElement?.contains(screen.getByRole('group', { name: 'Candidate type' }))).toBe(true);
    });

    it.each([
      ['a type alone', { type: 'fresh-grad' }],
      ['no hesitation', { type: 'fresh-grad', motivation: 'side-income' }],
      ['an empty list', { type: 'fresh-grad', motivation: '', hesitation: 'time' }],
      ['an empty code in a list', { type: 'fresh-grad', motivation: 'side-income,', hesitation: 'time' }],
      ['a code given twice', { type: 'fresh-grad', motivation: 'side-income,side-income', hesitation: 'time' }],
      ['two types', { type: 'fresh-grad,retiree', motivation: 'side-income', hesitation: 'time' }],
    ])('P17-T3 AC-5 %s opens the brief with nothing chosen, and asks for no plan', async (_name, query) => {
      const { calls } = show(query);
      await briefHeading();
      for (const name of ['Candidate type', 'What\'s driving them', 'Their biggest hesitation']) expect(pressed(name)).toEqual([]);
      expect(reads(calls)).toEqual([API]);
    });

    it('P17-T3 AC-5 a code the server does not know opens the brief with nothing chosen — never an error page', async () => {
      const { calls } = show(
        { type: 'astronaut', motivation: 'side-income', hesitation: 'time' },
        { 'GET /recruitment/attack-plan': ({ url }) => (url.includes('?') ? refused('type') : { body: view() }) },
      );
      await briefHeading();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      for (const name of ['Candidate type', 'What\'s driving them', 'Their biggest hesitation']) expect(pressed(name)).toEqual([]);
      expect(screen.getByRole('button', { name: 'Build recruitment plan' })).toBeDisabled();
      expect(reads(calls)).toEqual([`${API}?type=astronaut&motivation=side-income&hesitation=time`, API]);
    });

    it('P17-T3 AC-5 a brief a playbook answers with no plan is read as one it could not: the brief, nothing chosen', async () => {
      show(BRIEF, { 'GET /recruitment/attack-plan': { body: view(null) } });
      await briefHeading();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      for (const name of ['Candidate type', 'What\'s driving them', 'Their biggest hesitation']) expect(pressed(name)).toEqual([]);
    });
  });

  describe('the states the prototype lacks (AC-7)', () => {
    it('P17-T3 AC-7 a skeleton while the plan is read, and an error with a retry that keeps the brief', async () => {
      const { calls } = show(BRIEF, { 'GET /recruitment/attack-plan': [serverError, { body: view(plan()) }] });
      expect((await screen.findByText('Building your recruitment plan…')).closest('[role="status"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      // Still step 2, with Back to the brief.
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await result();
      expect(reads(calls)).toEqual([PLAN_URL, PLAN_URL]);
    });

    it('P17-T3 AC-7 a skeleton while the chips are read, and an error with a retry', async () => {
      const { calls } = show({}, { 'GET /recruitment/attack-plan': [serverError, { body: view() }] });
      expect((await screen.findByText('Loading the candidate brief…')).closest('[role="status"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await briefHeading();
      expect(reads(calls)).toEqual([API, API]);
    });

    it('P17-T3 AC-7 a company with no playbook: the empty state in the brief’s place, pointing to Pitch Materials', async () => {
      show({}, { 'GET /recruitment/attack-plan': { body: view(null, false) } });
      expect(await screen.findByText('No recruitment plan can be built yet.')).toBeInTheDocument();
      expect(screen.getByText(/haven't been written for your company yet/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to Pitch Materials' })).toHaveAttribute('href', '/recruitment/pitch-materials');
      expect(screen.queryByRole('heading', { name: 'Who are we talking to?' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Build recruitment plan' })).not.toBeInTheDocument();
    });

    it('P17-T3 AC-7 a plan’s address in a company with no playbook says the same, with no summary', async () => {
      show(BRIEF, { 'GET /recruitment/attack-plan': { body: view(null, false) } });
      expect(await screen.findByText('No recruitment plan can be built yet.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Candidate brief')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('focus (AC-8)', () => {
    it('P17-T3 AC-8 after Build recruitment plan the plan’s heading takes the focus', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer });
      const shown = renderInLayout(AgentLayout, page({}), { me: RINA_ME });
      await briefHeading();
      await chooseTheBrief();
      await userEvent.click(screen.getByRole('button', { name: 'Build recruitment plan' }));
      navigate(shown, BRIEF);
      const heading = await result();
      await waitFor(() => expect(document.activeElement).toBe(heading));
    });

    it.each([
      ['the playbook-empty state', { body: view(null, false) }, 'No recruitment plan can be built yet.'],
      ['an error', serverError, 'Something went wrong.'],
    ] as const)('P17-T3 AC-8 with no heading to land on, %s takes the focus', async (_name, reply, words) => {
      stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': ({ url }) => (url.includes('?') ? reply : { body: view() }) });
      const shown = renderInLayout(AgentLayout, page({}), { me: RINA_ME });
      await briefHeading();
      await chooseTheBrief();
      await userEvent.click(screen.getByRole('button', { name: 'Build recruitment plan' }));
      navigate(shown, BRIEF);
      const text = await screen.findByText(words);
      await waitFor(() => expect(document.activeElement!.contains(text)).toBe(true));
      expect(document.activeElement).toHaveAttribute('tabindex', '-1');
    });

    it('a plan opened by its address takes no focus: nobody asked for it on this page', async () => {
      show(BRIEF);
      const heading = await result();
      expect(document.activeElement).not.toBe(heading);
    });
  });

  describe('who may (AC-9)', () => {
    it.each(READERS)('P17-T3 AC-9 %s builds a plan', async (_who, me) => {
      show(BRIEF, {}, me);
      await result();
      expect(screen.getByText('Plan ready')).toBeInTheDocument();
    });

    it.each([
      ['a member without the grant', makeMe({ permissions: ['product_catalog:read'] })],
      ['a member with no grants at all', makeMe({ permissions: [] })],
    ])('P17-T3 AC-9 %s is refused, and nothing is read', async (_who, me) => {
      const { calls } = show(BRIEF, {}, me);
      expect(await screen.findByRole('heading', { name: 'Not available to you' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Recruitment' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Fresh graduate' })).not.toBeInTheDocument();
      expect(reads(calls)).toEqual([]);
    });

    it('P17-T3 AC-9 a read-only support session builds a plan, which writes nothing anyway', async () => {
      const { calls } = show(BRIEF, {}, READ_ONLY_RINA);
      await result();
      expect(calls.filter((c) => (c.init.method ?? 'GET') !== 'GET')).toEqual([]);
    });

    it('P17-T3 AC-9 the read names no office and no company: the server answers the reader’s own', async () => {
      const { calls } = show(BRIEF);
      await result();
      for (const url of reads(calls)) expect(url).not.toMatch(/kpm|company|office/i);
    });
  });
});
