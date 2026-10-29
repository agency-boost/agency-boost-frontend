import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInIndonesian, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import {
  BRIEF, HESITATIONS, MOTIVATIONS, NEXT_ACTION, plan, RETIREE_PLAN, RINA_ME, serverError, SHELL_STUBS, TYPES, view,
} from '@test/recruitment-plan-fixtures';
import { planMessages } from '@/i18n/messages/plan';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import RecruitmentAttackPlanPage from './attack-plan/page';
import RecruitmentLayout from './layout';
import RecruitmentIndex from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), search: '', path: '/recruitment/attack-plan' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

type Query = Record<string, string>;
type Routes = Record<string, StubReply | StubReply[]>;

/** The module's English that ID mode must not show: Recruitment's own, and the two plans' shared words. */
const RECRUITMENT_ENGLISH = englishOnly(recruitmentPlanMessages, planMessages);
const noEnglishLeft = () => expect(englishShown(document.body, RECRUITMENT_ENGLISH)).toEqual([]);

const page = (query: Query) => {
  nav.search = new URLSearchParams(query).toString();
  return <AgentLayout><RecruitmentLayout><RecruitmentAttackPlanPage /></RecruitmentLayout></AgentLayout>;
};

/** The bare read answers the vocabulary; a read with a brief, `plan()`. */
const answer = ({ url }: { url: string }) => ({ body: url.includes('?') ? view(plan()) : view() });

/** The page at an address, in Indonesian. */
function show(query: Query = {}, routes: Routes = {}) {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer, ...routes });
  renderInIndonesian(page(query), { me: RINA_ME });
  return stub;
}

const briefHeading = () => screen.findByRole('heading', { level: 2, name: 'Dengan siapa kita bicara?' });
const result = (name = 'Fresh graduate') => screen.findByRole('heading', { level: 2, name });
const group = (name: string) => screen.getByRole('group', { name });
const chips = (name: string) => within(group(name)).getAllByRole('button').map((b) => b.textContent);

/**
 * **P18.98-T4, Recruitment and its Attack Plan in ID mode** (field selling; ADR-0179 §3–§5): the section's line, the
 * brief's questions, the plan's frame and the states in the approved glossary's Indonesian; *Recruitment*, *Attack Plan*
 * and *Pitch Materials* English (§A); the company's playbook — the chips, the profile, the openings, the push-backs, the
 * next action — as typed. In English: `page.spec.tsx` and `attack-plan/page.spec.tsx`.
 */
describe('P18.98-T4 Recruitment in Indonesian', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
    nav.path = '/recruitment/attack-plan';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 the section: its title and tabs kept English, its line in Indonesian', async () => {
    show();
    await briefHeading();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Recruitment$/);
    expect(screen.getByText(
      'Susun pitch secara langsung, atau ambil materi siap pakai untuk ditunjukkan kepada kandidat.',
    )).toHaveClass('max-md:hidden');
    const tabs = within(screen.getByRole('navigation', { name: 'Recruitment' })).getAllByRole('link');
    expect(tabs.map((t) => [t.textContent, t.getAttribute('aria-current')])).toEqual([
      ['Attack Plan', 'page'], ['Pitch Materials', null],
    ]);
    noEnglishLeft();
  });

  it('AC-2 /recruitment hands off with its name in Indonesian', () => {
    nav.path = '/recruitment';
    renderInIndonesian(<RecruitmentIndex />, { me: RINA_ME });
    expect(screen.getByRole('status')).toHaveTextContent('Membuka Attack Plan…');
    expect(nav.replace).toHaveBeenCalledWith('/recruitment/attack-plan');
  });

  describe('the brief', () => {
    it('AC-2, AC-4 the steps, the card and the three questions in Indonesian; the chips the playbook’s, as typed', async () => {
      show();
      await briefHeading();
      expect(within(screen.getByRole('list', { name: 'Langkah' })).getAllByRole('listitem').map((s) => s.textContent))
        .toEqual(['11 Gambaran kandidat', '22 Rencana recruitment']);
      expect(screen.getByText('Jawab 3 pertanyaan untuk mendapatkan pitch Anda.')).toBeInTheDocument();
      expect(chips('Jenis kandidat')).toEqual(TYPES.map((t) => t.label));
      expect(chips('Apa yang mendorongnya')).toEqual(MOTIVATIONS.map((m) => m.label));
      expect(chips('Keraguan terbesarnya')).toEqual(HESITATIONS.map((h) => h.label));
      expect(screen.getByRole('button', { name: 'Susun rencana recruitment' })).toBeDisabled();
      noEnglishLeft();
    });

    it('AC-1 choosing in Indonesian builds the same address, the answers in the chips’ order', async () => {
      show();
      await briefHeading();
      await userEvent.click(within(group('Jenis kandidat')).getByRole('button', { name: 'Fresh grad' }));
      await userEvent.click(within(group('Apa yang mendorongnya')).getByRole('button', { name: 'Lead a team' }));
      await userEvent.click(within(group('Apa yang mendorongnya')).getByRole('button', { name: 'Side income' }));
      await userEvent.click(within(group('Keraguan terbesarnya')).getByRole('button', { name: 'Worried about time commitment' }));
      await userEvent.click(within(group('Keraguan terbesarnya')).getByRole('button', { name: 'No sales exp.' }));
      await userEvent.click(screen.getByRole('button', { name: 'Susun rencana recruitment' }));
      expect(nav.push).toHaveBeenCalledWith(
        '/recruitment/attack-plan?type=fresh-grad&motivation=side-income,leadership&hesitation=no-experience,time',
        { scroll: false },
      );
    });

    it('AC-2 a skeleton while the chips are read, and an error with its retry', async () => {
      show({}, { 'GET /recruitment/attack-plan': [serverError, { body: view() }] });
      expect((await screen.findByText('Memuat gambaran kandidat…')).closest('[role="status"]')).not.toBeNull();
      await screen.findByRole('alert');
      await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
      await briefHeading();
    });

    it('AC-2 a company with no playbook: the empty state in Indonesian, pointing to Pitch Materials, kept', async () => {
      show({}, { 'GET /recruitment/attack-plan': { body: view(null, false) } });
      expect(await screen.findByText('Belum ada rencana recruitment yang dapat disusun.')).toBeInTheDocument();
      expect(screen.getByText(
        'Kalimat pembuka, manfaat, dan jawaban atas keberatan yang menjadi bahan sebuah rencana belum ditulis untuk '
        + 'perusahaan Anda. Anda tetap dapat menunjukkan dokumen siap pakai di Pitch Materials kepada kandidat.',
      )).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Buka Pitch Materials' })).toHaveAttribute('href', '/recruitment/pitch-materials');
      noEnglishLeft();
    });
  });

  describe('the plan', () => {
    it('AC-2, AC-4 the summary, the head and the five blocks framed in Indonesian; every word of the playbook as typed', async () => {
      const { container } = renderAt(BRIEF);
      await result();
      expect(screen.getByLabelText('Gambaran kandidat').textContent).toBe(
        'Jenis: Fresh graduateMotivasi: Side income, Lead a teamKeraguan: No sales exp., Worried about time commitment',
      );
      expect(screen.getByText('Profil kandidat')).toBeInTheDocument();
      expect(screen.getByText('Rencana siap')).toHaveAttribute('data-tone', 'success');
      expect(screen.getByText('New to the workforce, deciding on a first real career move.')).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Cocok untuk', '11 Kalimat pembuka', '22 Tekankan manfaat berikut', '33 Jika ada keberatan', '44 Tindakan berikutnya',
      ]);
      expect([...container.querySelectorAll('[data-opening]')].map((o) => o.textContent)).toEqual([
        'Side income“Are you thinking of this as something on the side for now, or could it become your main thing if it works out?”',
        'Lead a team“Where do you want to be in three years — still doing the same role, or running your own team?”',
      ]);
      const boxes = [...container.querySelectorAll('[data-push-back]')] as HTMLElement[];
      expect(within(boxes[0]).getByText('Dia berkata:', { exact: false })).toHaveTextContent(
        'Dia berkata: “I don\'t have any sales experience — I don\'t think I could do this.”',
      );
      expect(within(boxes[0]).getByText('Anda menjawab:')).toBeInTheDocument();
      expect(screen.getByText(NEXT_ACTION)).toBeInTheDocument();
      const back = screen.getByRole('button', { name: 'Kembali' });
      expect(back.textContent).toBe('←Kembali');
      noEnglishLeft();
    });

    it('AC-3 one motivation: one opening line, its block one form for one and many', async () => {
      renderAt({ type: 'retiree', motivation: 'flexibility', hesitation: 'time' }, { 'GET /recruitment/attack-plan': { body: view(RETIREE_PLAN) } });
      await result('Retiree');
      expect(screen.getByRole('heading', { level: 3, name: '1 Kalimat pembuka' })).toBeInTheDocument();
    });

    it('AC-2 a skeleton while the plan is read, and an error with its retry', async () => {
      renderAt(BRIEF, { 'GET /recruitment/attack-plan': [serverError, { body: view(plan()) }] });
      expect((await screen.findByText('Menyusun rencana recruitment Anda…')).closest('[role="status"]')).not.toBeNull();
      await screen.findByRole('alert');
      await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
      await result();
    });
  });

  it('the check is live: the plan read in English shows the module’s English, which the check finds', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer });
    renderWithSession(page(BRIEF), { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Fresh graduate' });
    expect(englishShown(document.body, RECRUITMENT_ENGLISH))
      .toEqual(expect.arrayContaining(['Plan ready', 'Candidate profile', 'Back']));
  });
});

/** The plan at an address, in Indonesian, with the container for its `data-*` reads. */
function renderAt(query: Query, routes: Routes = {}) {
  stubFetch({ ...SHELL_STUBS, 'GET /recruitment/attack-plan': answer, ...routes });
  return renderInIndonesian(page(query), { me: RINA_ME });
}
