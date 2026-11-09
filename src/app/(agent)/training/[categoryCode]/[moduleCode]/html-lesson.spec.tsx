import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch } from '@test/harness';
import { LEARNER, modulePage, progressView, SHELL_STUBS } from '@test/training-fixtures';
import type { Me } from '@/lib/session';
import TrainingLayout from '../../layout';
import TrainingModulePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/training/SALES/CLOSING_TECHNIQUES',
  useParams: () => ({}),
}));

/** The fake storage host: a signed link on a host that is neither the app's nor the API's. */
const SIGNED = 'https://storage.googleapis.com/test-bucket/dev/company/c1/training/01LESSON?X-Goog-Signature=abc';
const OPEN_LESSON = 'POST /training/modules/CLOSING_TECHNIQUES/items/it-lesson/open';

/** The module with an HTML lesson first, the PDF beside it, as P19.6-T3 attaches the owner's lessons. */
const WITH_LESSON = modulePage({
  items: [
    { id: 'it-lesson', kind: 'file', label: 'Pelajaran: Closing', mimeType: 'text/html', bytes: 48_000, url: null },
    { id: 'it-file', kind: 'file', label: 'closing-techniques.pdf', mimeType: 'application/pdf', bytes: 120_000, url: null },
  ],
  openedItemIds: [],
});

function show(me: Me = LEARNER) {
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /training/progress': { body: progressView() },
    'GET /training/modules/CLOSING_TECHNIQUES': { body: WITH_LESSON },
    [OPEN_LESSON]: { body: { url: SIGNED, openedItemIds: ['it-lesson'], recorded: true } },
  });
  renderInLayout(
    AgentLayout,
    <TrainingLayout><TrainingModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} /></TrainingLayout>,
    { me },
  );
  return stub;
}

const ready = () => screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
/** An item's row, by the label it is drawn with — the first, the page's, before any window is titled with it. */
const tile = (label: string) => screen.getAllByText(label)[0].closest('li') as HTMLElement;

describe('P19.6-T2 an HTML lesson on a module’s page (ADR-0217 §4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P19.6-T2 AC-2 opens the lesson in the sandboxed window, never a tab, and records the open', async () => {
    const open = vi.spyOn(window, 'open');
    const { calls } = show();
    await ready();
    const button = within(tile('Pelajaran: Closing')).getByRole('button', {
      name: 'Open File: Pelajaran: Closing (opens in this window)',
    });
    await userEvent.click(button);

    const dialog = await screen.findByRole('dialog', { name: 'Pelajaran: Closing' });
    const frame = await within(dialog).findByTitle('Pelajaran: Closing');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    // Served from the storage host alone: never the app's origin.
    expect(new URL(frame.getAttribute('src')!).origin).toBe('https://storage.googleapis.com');
    expect(new URL(frame.getAttribute('src')!).origin).not.toBe(window.location.origin);
    expect(open).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.url.includes('/items/it-lesson/open'))).toHaveLength(1);
    // The open is recorded, as a file's is: *Sudah dibuka* under the lesson.
    await waitFor(() => expect(within(tile('Pelajaran: Closing')).getByText('Opened')).toBeInTheDocument());
  });

  it('P19.6-T2 AC-6 a PDF beside it opens in a tab, as it always did', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    stubFetch({
      ...SHELL_STUBS,
      'GET /training/progress': { body: progressView() },
      'GET /training/modules/CLOSING_TECHNIQUES': { body: WITH_LESSON },
      'POST /training/modules/CLOSING_TECHNIQUES/items/it-file/open': {
        body: { url: 'https://cdn.example/signed.pdf', openedItemIds: ['it-file'], recorded: true },
      },
    });
    renderInLayout(
      AgentLayout,
      <TrainingLayout><TrainingModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} /></TrainingLayout>,
      { me: LEARNER },
    );
    await ready();
    await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File.*new tab/ }));
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P19.6-T2 the lesson receives the office’s colours in the fragment', async () => {
    show({ ...LEARNER, branding: { kpmId: 'kpm-1', version: 2, palette: null, lesson: { accent: '0f766e', accentSoft: 'eef7f6' } } } as never);
    await ready();
    await userEvent.click(within(tile('Pelajaran: Closing')).getByRole('button', { name: /opens in this window/ }));
    const frame = await screen.findByTitle('Pelajaran: Closing');
    expect(frame.getAttribute('src')).toBe(`${SIGNED}#accent=0f766e&accentSoft=eef7f6`);
  });
});
