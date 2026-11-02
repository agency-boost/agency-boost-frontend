import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import MyCoachingTrainingPage from '@/app/(agent)/coaching/me/training/page';
import { atWidth, InLanguage, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import {
  category, LEARNER, modulePage, NOT_FOUND, progressView, SALES, SHELL_STUBS, skill, SUPPORT,
} from '@test/training-fixtures';
import { trainingMessages } from '@/i18n/messages/training';
import type { Me } from '@/lib/session';
import TrainingLayout from './layout';
import TrainingPage from './page';
import TrainingCategoryPage from './[categoryCode]/page';
import TrainingModulePage from './[categoryCode]/[moduleCode]/page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), pathname: '/training/SALES' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

/** Training's English that ID mode must not show. */
const TRAINING_ENGLISH = englishOnly(trainingMessages);
const noEnglishLeft = () => expect(englishShown(document.body, TRAINING_ENGLISH)).toEqual([]);

/** A page under the field shell, in Indonesian. */
function inIndonesian(path: string, page: React.ReactElement, routes: Routes = {}, me: Me = LEARNER) {
  nav.pathname = path;
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() }, ...routes });
  renderWithSession(<InLanguage language="id"><AgentLayout>{page}</AgentLayout></InLanguage>, { me });
  return stub;
}

const list = (code = 'SALES', routes: Routes = {}) => inIndonesian(
  `/training/${code}`,
  <TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: code })} /></TrainingLayout>,
  routes,
);

const PAGE = 'GET /training/modules/CLOSING_TECHNIQUES';
const modulePageAt = (routes: Routes = {}, me: Me = LEARNER) => inIndonesian(
  '/training/SALES/CLOSING_TECHNIQUES',
  <TrainingLayout>
    <TrainingModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} />
  </TrainingLayout>,
  { [PAGE]: { body: modulePage() }, ...routes },
  me,
);

const title = () => screen.findByRole('heading', { level: 1, name: 'Training Modules' });

/**
 * **P18.98-T4, Training in ID mode** (ADR-0179 §3–§5): the learner's list, a module's page and the coaching *Training*
 * tab in the approved glossary's Indonesian; the title, the nav item, *Training*, *Skill* and *Module* English (§A); every
 * category, skill, module and item as the office typed it. In English: `page.spec.tsx` and its module page's spec.
 */
describe('P18.98-T4 Training in Indonesian', () => {
  beforeEach(() => { nav.replace.mockReset(); nav.push.mockReset(); });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('AC-2, UI-006, UI-066 the list: the columns, the pills and the formats in Indonesian, the title and Module kept English', async () => {
    list();
    await title();
    expect(screen.getByRole('navigation', { name: 'Training' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Daftar skill' })).not.toBeInTheDocument();
    const prospecting = screen.getByRole('list', { name: 'Modul Prospecting' });
    expect(prospecting.closest('[data-skill]')!.querySelector('div[aria-hidden="true"]')!.textContent).toBe('ModuleFormatStatus');
    const needs = screen.getByRole('list', { name: 'Modul Needs Analysis' });
    expect(within(needs).getByText('Selesai')).toBeInTheDocument();
    expect(within(needs).getByText('Berjalan')).toBeInTheDocument();
    const closing = screen.getByRole('list', { name: 'Modul Closing' });
    expect(within(closing).getByText('Belum dimulai')).toBeInTheDocument();
    expect(within(closing).getByRole('link').textContent).toContain('FileTautan');
    const retention = screen.getByRole('list', { name: 'Modul Retention' });
    expect(within(retention).getByText('Belum ada materi')).toHaveClass('sr-only');
    noEnglishLeft();
  });

  it('AC-4 shows the office’s category, skills, modules and description as typed', async () => {
    list();
    await title();
    expect(screen.getByText('Structured modules — tracked here.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Training' })).getAllByRole('link').map((a) => a.textContent))
      .toEqual(['Sales', 'Product']);
    expect(screen.getByRole('link', { name: /^Building Your Prospect List/ })).toHaveAttribute('href', '/training/SALES/PROSPECT_LIST');
  });

  it('AC-1 a category with nothing offered: its card titled Training {label}, and the line in Indonesian', async () => {
    list('PRODUCT');
    await title();
    expect(screen.getByText('Training Product')).toBeInTheDocument();
    expect(screen.getAllByText('Modul untuk kategori ini segera hadir.')).toHaveLength(2);
    noEnglishLeft();
  });

  it('AC-1 no category at all, and a category not offered, say so in Indonesian', async () => {
    inIndonesian('/training', <TrainingLayout><TrainingPage /></TrainingLayout>, {
      'GET /training/progress': { body: progressView([]) },
    });
    expect(await screen.findByText('Belum ada pelatihan untuk ditampilkan.')).toBeInTheDocument();
    expect(screen.getByText('Modul akan muncul di sini setelah diterbitkan untuk Anda.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a category the office does not offer: not found, the way back kept English', async () => {
    list('NOPE');
    expect(await screen.findByRole('heading', { name: 'Kategori ini tidak ditemukan.' })).toBeInTheDocument();
    expect(screen.getByText('Mungkin sudah ditarik, atau alamatnya salah ketik.')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Training modules' })).toHaveAttribute('href', '/training');
    noEnglishLeft();
  });

  it('AC-1, UI-065 on a phone, one card of rows, each module’s name as typed and its status in Indonesian', async () => {
    atWidth(375);
    list();
    await title();
    const rows = within(screen.getByRole('list', { name: 'Modul Needs Analysis' })).getAllByRole('link');
    expect(rows.map((r) => r.textContent)).toEqual(['Conducting a Financial Needs AnalysisSelesai', 'Asking the Right Discovery QuestionsBerjalan']);
    noEnglishLeft();
  });

  it('AC-2, UI-067 to UI-069 a module’s page: the way back, the lesson card and the status in Indonesian, its title and items as typed', async () => {
    modulePageAt();
    await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
    expect(screen.queryByText(/Modul pelatihan terstruktur|Diunggah oleh admin|Sumber eksternal/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke Training Modules' })).toHaveAttribute('href', '/training/SALES');
    expect(screen.getByText('Skill: Closing')).toBeInTheDocument();
    expect(screen.getByText('Modul 1 dari 1')).toHaveClass('sr-only');
    const file = screen.getByText('closing-techniques.pdf').closest('li')!;
    expect(within(file).getByRole('button', { name: 'Buka file: closing-techniques.pdf (terbuka di tab baru)' }))
      .toHaveTextContent(/^Buka file$/);
    expect(within(file).getByText('Sudah dibuka')).toBeInTheDocument();
    const link = screen.getByText('Closing in practice').closest('li')!;
    expect(within(link).getByRole('link', { name: 'Buka tautan: Closing in practice (terbuka di tab baru)' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Status Closing Techniques That Work' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Belum dimulai', 'Berjalan', 'Selesai']);
    noEnglishLeft();
  });

  it('UI-067 a video’s play button in Indonesian: Putar video, the app’s own words (O-7)', async () => {
    modulePageAt({ [PAGE]: { body: modulePage({ items: [{ id: 'it-v', kind: 'video', label: 'closing.mp4', mimeType: 'video/mp4', bytes: 9, url: null }] }) } });
    await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
    expect(screen.getByRole('button', { name: 'Putar video: closing.mp4' })).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 setting a status toasts one whole sentence per status', async () => {
    modulePageAt({
      'PUT /training/modules/CLOSING_TECHNIQUES/progress': ({ body }) => ({
        body: modulePage({ status: (body as { status: 'done' }).status }),
      }),
    });
    await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
    await userEvent.click(screen.getByRole('button', { name: 'Berjalan' }));
    expect(await screen.findByText('"Closing Techniques That Work" ditandai sedang berjalan.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Selesai' }));
    expect(await screen.findByText('"Closing Techniques That Work" ditandai selesai.')).toBeInTheDocument();
  });

  it('AC-1 opening a link records it and says so in Indonesian; a refused status names the server’s reason', async () => {
    modulePageAt({
      'POST /training/modules/CLOSING_TECHNIQUES/items/it-link/open': {
        body: { url: 'https://example.com/closing', openedItemIds: ['it-file', 'it-link'], recorded: true },
      },
      'PUT /training/modules/CLOSING_TECHNIQUES/progress': {
        status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan.', requestId: 'r-3' } },
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
    const anchor = screen.getByRole('link', { name: /^Buka tautan/ });
    anchor.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(anchor);
    expect(await screen.findByText('Ditandai sudah dibuka.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Selesai' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Tidak tersimpan\. Terjadi kesalahan\.$/);
  });

  it('AC-1 an empty module, a support session’s pill and a module not offered, in Indonesian', async () => {
    modulePageAt({ [PAGE]: { body: modulePage({ items: [], openedItemIds: [], can: { update: false } }) } }, SUPPORT);
    expect(await screen.findByText('Belum ada yang bisa dibuka di modul ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum dimulai')).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
    noEnglishLeft();
  });

  it('AC-1 a module the office does not offer is not found, in Indonesian', async () => {
    modulePageAt({ [PAGE]: NOT_FOUND });
    expect(await screen.findByRole('heading', { name: 'Modul ini tidak ditemukan.' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2 the coaching Training tab: each category’s counts, its cards and an archived row in Indonesian', async () => {
    const sales = category('SALES', 'Sales', [
      ...SALES.skills.slice(0, 1),
      skill('RETENTION', 'Retention', [], {
        archived: [{ code: 'OLD', title: 'The old retention talk', formats: ['video'], status: 'done', completedAt: '2026-03-02T00:00:00.000Z' }],
      }),
    ]);
    inIndonesian('/coaching/me/training', <MyCoachingTrainingPage />, {
      'GET /training/progress': { body: progressView([sales]) },
    });
    await screen.findByRole('heading', { level: 2, name: 'Sales (3/3)' });
    const old = screen.getByText('The old retention talk').closest('li')!;
    expect(within(old).getByText('Selesai')).toBeInTheDocument();
    expect(within(old).getByText('Diarsipkan')).toBeInTheDocument();
    expect(within(old).getByText('Video')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the coaching Training tab with nothing offered, and its wait, in Indonesian', async () => {
    inIndonesian('/coaching/me/training', <MyCoachingTrainingPage />, { 'GET /training/progress': { body: progressView([]) } });
    expect(screen.getByText('Memuat pelatihan…')).toBeInTheDocument();
    expect(await screen.findByText('Belum ada pelatihan untuk ditampilkan.')).toBeInTheDocument();
    await waitFor(() => noEnglishLeft());
  });

  it('the check is live: the list read in English shows the module’s English, which the check finds', async () => {
    nav.pathname = '/training/SALES';
    stubFetch({ ...SHELL_STUBS, 'GET /training/progress': { body: progressView() } });
    renderWithSession(
      <AgentLayout><TrainingLayout><TrainingCategoryPage params={routeParams({ categoryCode: 'SALES' })} /></TrainingLayout></AgentLayout>,
      { me: LEARNER },
    );
    await title();
    expect(englishShown(document.body, TRAINING_ENGLISH)).toEqual(expect.arrayContaining(['In progress', 'Done']));
  });
});
