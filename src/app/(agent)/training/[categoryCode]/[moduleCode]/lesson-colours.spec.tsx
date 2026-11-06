import { screen, within } from '@testing-library/react';
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

/** The storage host's signed link to the company's copy of lesson 04, as the import stores it. */
const SIGNED = 'https://storage.googleapis.com/test-bucket/prod/company/c1/training/lessons/04-handling-objections-closing-3f2a9c1b7d4e.html?X-Goog-Signature=abc';
const TITLE = 'Handling objections: menjawab keberatan lalu closing';

/** A module as the import leaves it (P19.6-T3 AC-1): the lesson first, named as the index names it, its A4 PDF beside it. */
const WITH_LESSON = modulePage({
  items: [
    { id: 'lesson-html', kind: 'file', label: TITLE, mimeType: 'text/html', bytes: 41_000, url: null },
    { id: 'lesson-pdf', kind: 'file', label: `${TITLE}.pdf`, mimeType: 'application/pdf', bytes: 391_007, url: null },
  ],
  openedItemIds: [],
});

function show(me: Me) {
  stubFetch({
    ...SHELL_STUBS,
    'GET /training/progress': { body: progressView() },
    'GET /training/modules/CLOSING_TECHNIQUES': { body: WITH_LESSON },
    'POST /training/modules/CLOSING_TECHNIQUES/items/lesson-html/open': {
      body: { url: SIGNED, openedItemIds: ['lesson-html'], recorded: true },
    },
  });
  renderInLayout(
    AgentLayout,
    <TrainingLayout><TrainingModulePage params={routeParams({ categoryCode: 'SALES', moduleCode: 'CLOSING_TECHNIQUES' })} /></TrainingLayout>,
    { me },
  );
}

/** Open the module's lesson and answer the frame's address. */
async function lessonAddress(): Promise<string> {
  await screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
  const row = screen.getAllByText(TITLE)[0].closest('li') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: /opens in this window/ }));
  const frame = await screen.findByTitle(TITLE);
  return frame.getAttribute('src')!;
}

/**
 * **The KPM's colours reach the owner's lesson through its address** (P19.6-T3 AC-5; ADR-0217 §5, OD-269): the module's
 * page draws T2's frame with the session's `branding.lesson` in the fragment — the primary in its readable form, its
 * tint, and the secondary where white reads on it. The lesson's served copy reads them; without them it keeps its own.
 */
describe('P19.6-T3 the owner’s lesson in the KPM’s colours', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('P19.6-T3 AC-5 an embedded lesson receives the KPM’s primary, its tint and its secondary in the fragment, never the query', async () => {
    show({
      ...LEARNER,
      branding: { kpmId: 'kpm-1', version: 3, palette: null, lesson: { accent: '0e7c66', accentSoft: 'e7f2f0', ink: '1f2a44' } },
    } as never);
    const src = await lessonAddress();
    expect(src).toBe(`${SIGNED}#accent=0e7c66&accentSoft=e7f2f0&ink=1f2a44`);
    // The signed query is as storage signed it: a parameter added there would break the signature.
    expect(new URL(src).search).toBe('?X-Goog-Signature=abc');
  });

  it('P19.6-T3 AC-5 without the KPM’s branding the address carries no colours, and the lesson keeps its own', async () => {
    show(LEARNER);
    expect(await lessonAddress()).toBe(SIGNED);
  });
});
