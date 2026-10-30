import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, wears, type StubReply } from '@test/harness';
import {
  LEARNER, modulePage, NOT_FOUND, progressView, SHELL_STUBS, SUPPORT,
} from '@test/training-fixtures';
import type { Me } from '@/lib/session';
import TrainingLayout from '../../layout';
import TrainingModulePage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), pathname: '/training/SALES/CLOSING_TECHNIQUES' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const PAGE = 'GET /training/modules/CLOSING_TECHNIQUES';
const PUT = 'PUT /training/modules/CLOSING_TECHNIQUES/progress';
const OPEN_FILE = 'POST /training/modules/CLOSING_TECHNIQUES/items/it-file/open';
const OPEN_LINK = 'POST /training/modules/CLOSING_TECHNIQUES/items/it-link/open';

function show(routes: Routes = {}, me: Me = LEARNER, { categoryCode = 'SALES', moduleCode = 'CLOSING_TECHNIQUES' } = {}) {
  nav.pathname = `/training/${categoryCode}/${moduleCode}`;
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /training/progress': { body: progressView() },
    [PAGE]: { body: modulePage() },
    ...routes,
  });
  const rendered = renderInLayout(
    AgentLayout,
    <TrainingLayout><TrainingModulePage params={routeParams({ categoryCode, moduleCode })} /></TrainingLayout>,
    { me },
  );
  return { ...stub, session: rendered.session };
}

const ready = () => screen.findByRole('heading', { level: 1, name: 'Closing Techniques That Work' });
const tile = (label: string) => screen.getByText(label).closest('li') as HTMLElement;
const sent = (calls: { url: string; init: RequestInit }[], fragment: string, method: string) =>
  calls.filter((c) => c.url.includes(fragment) && (c.init.method ?? 'GET') === method);

describe('/training/[categoryCode]/[moduleCode], a module’s page (P18.5-T1)', () => {
  beforeEach(() => {
    nav.replace.mockReset();
    nav.push.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('the page, verbatim (AC-5)', () => {
    it('UI-067 says the title once, as the lesson card’s heading: no subtitle, no category row, no Uploaded by admin', async () => {
      show();
      await ready();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByText('Closing Techniques That Work')).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 }).closest('[data-lesson-card]')).not.toBeNull();
      expect(screen.queryByText(/Structured training module|Uploaded by admin|External resource/)).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Training' })).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-5, P18.95-T9 AC-2 links back to the category’s list by that page’s title, Back to Training Modules', async () => {
      show();
      await ready();
      const back = screen.getByRole('link', { name: 'Back to Training Modules' });
      expect(back).toHaveAttribute('href', '/training/SALES');
      // UI-067: *‹ Training Modules* in a 48px row below 1024px, the long words from 1024px.
      expect(wears(back, 375)).toContain('min-h-12');
      expect(within(back).getByText('Training Modules')).toHaveClass('lg:hidden');
      expect(within(back).getByText('Back to Training Modules')).toHaveClass('max-lg:hidden');
    });

    it('UI-067 heads the navy lesson card with Skill: {label} and the module’s place in its skill', async () => {
      show();
      await ready();
      const card = screen.getByRole('region', { name: 'Closing Techniques That Work' });
      expect(card.className).toContain('bg-navy');
      expect(within(card).getByText('Skill: Closing')).toBeInTheDocument();
      // *Closing* holds one module in the catalog the layout read: *1/1*, said in words to a screen reader.
      expect(within(card).getByText('1/1')).toHaveAttribute('aria-hidden', 'true');
      expect(within(card).getByText('Module 1 of 1')).toHaveClass('sr-only');
    });

    it('UI-067 draws a block per item by its kind: a file’s row and Open File, a link’s row with its site and Open Link', async () => {
      show();
      await ready();
      const file = tile('closing-techniques.pdf');
      expect(within(file).getByRole('button', { name: /^Open File/ })).toHaveTextContent(/^Open File$/);
      const link = tile('Closing in practice');
      expect(within(link).getByText('example.com')).toBeInTheDocument();
      expect(within(link).getByRole('link', { name: /^Open Link/ })).toHaveAttribute('href', 'https://example.com/closing');
      expect(screen.queryByText('Closing Techniques That Work.pdf')).not.toBeInTheDocument();
      // The accent's button, full width below 1024px and at the row's end from 1024px; navy words on it (I-542).
      const button = within(file).getByRole('button', { name: /^Open File/ });
      expect(wears(button, 375).split(' ')).toEqual(expect.arrayContaining(['w-full', 'h-[52px]', 'bg-amber', 'text-navy']));
      expect(wears(button, 1280).split(' ')).toEqual(expect.arrayContaining(['w-auto', 'h-12']));
    });

    it('UI-067 a video plays in place: Play Video asks for its address and draws the player here, nothing opened elsewhere', async () => {
      const open = vi.spyOn(window, 'open');
      const { calls } = show({
        [PAGE]: { body: modulePage({ items: [{ id: 'it-v', kind: 'video', label: 'closing.mp4', mimeType: 'video/mp4', bytes: 9, url: null }], openedItemIds: [] }) },
        'POST /training/modules/CLOSING_TECHNIQUES/items/it-v/open': { body: { url: 'https://cdn.example/closing.mp4', openedItemIds: ['it-v'], recorded: true } },
      });
      await ready();
      const video = tile('closing.mp4');
      const play = within(video).getByRole('button', { name: 'Play Video: closing.mp4' });
      expect(play.className).toContain('h-[150px]');

      await userEvent.click(play);

      await waitFor(() => expect(video.querySelector('video')).toHaveAttribute('src', 'https://cdn.example/closing.mp4'));
      expect(video.querySelector('video')).toHaveAttribute('controls');
      expect(open).not.toHaveBeenCalled();
      expect(sent(calls, '/items/it-v/open', 'POST')).toHaveLength(1);
      expect(within(video).getByText('Opened')).toBeInTheDocument();
    });

    it('UI-069 says Opened in words under an opened item’s name, never a lone tick, from the record (D-opened)', async () => {
      show();
      await ready();
      const opened = within(tile('closing-techniques.pdf')).getByText('Opened');
      expect(opened).toHaveAttribute('data-opened');
      expect(opened.className).toContain('text-on-navy-green');
      expect(screen.queryByRole('img', { name: 'Opened' })).not.toBeInTheDocument();
      expect(within(tile('Closing in practice')).queryByText('Opened')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-5 says “Nothing to open in this module yet.” for a module holding nothing', async () => {
      show({ [PAGE]: { body: modulePage({ items: [], openedItemIds: [] }) } });
      await ready();
      expect(screen.getByText('Nothing to open in this module yet.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Open File|Play Video/ })).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-5, OD-150 draws no footer: nothing promises a Skill Tracker', async () => {
      show();
      await ready();
      expect(document.body.textContent).not.toMatch(/Skill Tracker/i);
    });
  });

  describe('opening (AC-6)', () => {
    it('P18.5-T1 AC-6 opens a file’s tab as the click lands, then points it at the signed address', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      const { calls } = show({
        [OPEN_FILE]: { body: { url: 'https://cdn.example/signed.pdf', openedItemIds: ['it-file'], recorded: false } },
      });
      await ready();

      await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File/ }));
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(open.mock.invocationCallOrder[0]).toBeLessThan(
        (globalThis.fetch as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder.at(-1)!,
      );
      expect(tab.opener).toBeNull();
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.example/signed.pdf'));
      expect(sent(calls, '/items/it-file/open', 'POST')).toHaveLength(1);
    });

    it('P18.5-T1 AC-6 opens a link straight from its anchor, then records it, the ✓ and the toast following', async () => {
      const open = vi.spyOn(window, 'open');
      const { calls } = show({
        [OPEN_LINK]: { body: { url: 'https://example.com/closing', openedItemIds: ['it-file', 'it-link'], recorded: true } },
      });
      await ready();

      const anchor = within(tile('Closing in practice')).getByRole('link', { name: /^Open Link/ });
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
      anchor.addEventListener('click', (e) => e.preventDefault());
      await userEvent.click(anchor);

      expect(await within(tile('Closing in practice')).findByText('Opened')).toBeInTheDocument();
      expect(await screen.findByText('Marked as opened.')).toBeInTheDocument();
      expect(sent(calls, '/items/it-link/open', 'POST')).toHaveLength(1);
      expect(open).not.toHaveBeenCalled();
    });

    it('P18.5-T1 AC-6 says why a file cannot open (409 ASSET_NOT_CONFIRMED), and closes the empty tab', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      show({
        [OPEN_FILE]: { status: 409, body: { error: { code: 'ASSET_NOT_CONFIRMED', message: 'That file never finished uploading.', requestId: 'r-2' } } },
      });
      await ready();

      await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File/ }));
      expect(await within(tile('closing-techniques.pdf')).findByRole('alert')).toHaveTextContent('That file never finished uploading.');
      expect(within(tile('closing-techniques.pdf')).getByText('Couldn’t open closing-techniques.pdf. Try again.')).toBeInTheDocument();
      expect(tab.close).toHaveBeenCalled();
    });

    it('P18.5-T1 AC-6 says nothing when a link opened and only its record failed: no “Couldn’t open”, no ✓, no toast', async () => {
      show({ [OPEN_LINK]: { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-4' } } } });
      await ready();

      const anchor = within(tile('Closing in practice')).getByRole('link', { name: /^Open Link/ });
      anchor.addEventListener('click', (e) => e.preventDefault());
      await userEvent.click(anchor);

      await waitFor(() => expect(within(tile('Closing in practice')).getByRole('link', { name: /^Open Link/ })).not.toHaveAttribute('aria-disabled'));
      expect(within(tile('Closing in practice')).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/Couldn’t open/)).not.toBeInTheDocument();
      expect(within(tile('Closing in practice')).queryByText('Opened')).not.toBeInTheDocument();
      expect(screen.queryByText('Marked as opened.')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-6 in a support session re-opening an item the member opened says nothing: the session recorded nothing', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      show({
        [PAGE]: { body: modulePage({ can: { update: false } }) },
        [OPEN_FILE]: { body: { url: 'https://cdn.example/signed.pdf', openedItemIds: ['it-file'], recorded: false } },
      }, SUPPORT);
      await ready();

      await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File/ }));
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.example/signed.pdf'));
      // The member's own ✓ stays, as the record has it; the session adds no toast.
      expect(within(tile('closing-techniques.pdf')).getByText('Opened')).toBeInTheDocument();
      expect(screen.queryByText('Marked as opened.')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-6 the member re-opening an item toasts again, as the prototype does', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      show({ [OPEN_FILE]: { body: { url: 'https://cdn.example/signed.pdf', openedItemIds: ['it-file'], recorded: false } } });
      await ready();

      await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File/ }));
      expect(await screen.findByText('Marked as opened.')).toBeInTheDocument();
    });

    it('P18.5-T1 AC-6 in a support session opens the file and shows no ✓ and no toast: nothing is recorded', async () => {
      const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      show({
        [PAGE]: { body: modulePage({ openedItemIds: [], can: { update: false } }) },
        [OPEN_FILE]: { body: { url: 'https://cdn.example/signed.pdf', openedItemIds: [], recorded: false } },
      }, SUPPORT);
      await ready();

      await userEvent.click(within(tile('closing-techniques.pdf')).getByRole('button', { name: /^Open File/ }));
      await waitFor(() => expect(tab.location.href).toBe('https://cdn.example/signed.pdf'));
      expect(within(tile('closing-techniques.pdf')).queryByText('Opened')).not.toBeInTheDocument();
      expect(screen.queryByText('Marked as opened.')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-6 names each button by its words, the item, and that it leaves the page', async () => {
      show();
      await ready();
      expect(within(tile('closing-techniques.pdf')).getByRole('button', { name: 'Open File: closing-techniques.pdf (opens in a new tab)' }))
        .toHaveTextContent(/^Open File$/);
      expect(within(tile('Closing in practice')).getByRole('link', { name: 'Open Link: Closing in practice (opens in a new tab)' }))
        .toHaveTextContent(/^Open Link$/);
    });
  });

  describe('the status (AC-7)', () => {
    it('UI-068 draws three big buttons in the prototype’s order under Status, the chosen one pressed and in the accent', async () => {
      show({ [PAGE]: { body: modulePage({ status: 'in_progress' }) } });
      await ready();
      const card = screen.getByRole('region', { name: 'Status' });
      const group = within(card).getByRole('group', { name: 'Status of Closing Techniques That Work' });
      const buttons = within(group).getAllByRole('button');
      expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
        ['Not started', 'false'], ['In progress', 'true'], ['Done', 'false'],
      ]);
      // The report's orange, with navy words on it (I-542); each with its line icon.
      expect(buttons[1].className).toContain('bg-amber');
      expect(buttons[1].className).toContain('text-navy');
      expect(buttons[0].className).not.toContain('bg-amber');
      buttons.forEach((b) => expect(b.querySelector('svg')).not.toBeNull());
    });

    it('UI-068 one row of three, 64px, below 1024px; a stack of 60px buttons from 1024px', async () => {
      show();
      await ready();
      const group = screen.getByRole('group', { name: 'Status of Closing Techniques That Work' });
      for (const px of [360, 375, 768]) {
        expect(wears(group, px).split(' ')).not.toContain('flex-col');
        within(group).getAllByRole('button').forEach((b) => {
          expect(wears(b, px).split(' ')).toEqual(expect.arrayContaining(['h-16', 'flex-1', 'flex-col']));
        });
      }
      expect(wears(group, 1280).split(' ')).toContain('flex-col');
      within(group).getAllByRole('button').forEach((b) => expect(wears(b, 1280).split(' ')).toEqual(expect.arrayContaining(['h-[60px]', 'flex-row'])));
    });

    it('UI-068 shows the chosen status at once, before the server answers, and puts it back if it refuses', async () => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const { mock } = show({ [PUT]: { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-3' } } } });
      const answer = mock.getMockImplementation()!;
      mock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') await held;
        return answer(url, init);
      });
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
      release();
      expect(await screen.findByRole('alert')).toHaveTextContent(/^Not saved\. Something went wrong\.$/);
      expect(screen.getByRole('button', { name: 'Not started' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('P18.5-T1 AC-7 sets the status it names, never toggles, toasts the prototype’s sentence, and re-reads the list', async () => {
      const { calls } = show({
        [PUT]: ({ body }) => ({ body: modulePage({ status: (body as { status: 'done' }).status }) }),
      });
      await ready();

      await userEvent.click(within(screen.getByRole('group', { name: 'Status of Closing Techniques That Work' })).getByRole('button', { name: 'Done' }));
      expect(await screen.findByText('Marked "Closing Techniques That Work" as done.')).toBeInTheDocument();
      const put = sent(calls, '/progress', 'PUT');
      expect(put).toHaveLength(1);
      expect(JSON.parse(put[0].init.body as string)).toEqual({ status: 'done' });
      expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Not started' })).toHaveAttribute('aria-pressed', 'false');
      await waitFor(() => expect(sent(calls, '/training/progress', 'GET')).toHaveLength(2));
    });

    it('P18.5-T1 AC-7 moves freely, Done back to Not started included (`Overall.html:7905-7911`)', async () => {
      const { calls } = show({
        [PAGE]: { body: modulePage({ status: 'done' }) },
        [PUT]: ({ body }) => ({ body: modulePage({ status: (body as { status: 'not_started' }).status }) }),
      });
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Not started' }));
      expect(await screen.findByText('Marked "Closing Techniques That Work" as not started.')).toBeInTheDocument();
      expect(JSON.parse(sent(calls, '/progress', 'PUT')[0].init.body as string)).toEqual({ status: 'not_started' });
    });

    it('P18.5-T1 AC-7 says why a write was refused, and keeps the status as it was', async () => {
      show({ [PUT]: { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-3' } } } });
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'In progress' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/^Not saved\. Something went wrong\.$/);
      expect(screen.getByRole('button', { name: 'Not started' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('P18.5-T1 AC-7 draws no toggle where the server says the reader may not set it: a support session (D-support, F-123)', async () => {
      const { calls } = show({ [PAGE]: { body: modulePage({ can: { update: false } }) } }, SUPPORT);
      await ready();
      expect(screen.queryByRole('group', { name: /^Status/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      // The status as its pill in the toggle's place: the support operator sees it, and changes nothing.
      expect(screen.getByText('Not started')).toBeInTheDocument();
      expect(sent(calls, '/progress', 'PUT')).toHaveLength(0);
    });

    it('P18.5-T3 AC-2 reads the session again when Done may have completed the reader’s activation item', async () => {
      const hire = { ...LEARNER, activation: { open: true, complete: false } };
      const { session } = show({ [PUT]: { body: modulePage({ status: 'done' }) } }, hire);
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      await screen.findByText('Marked "Closing Techniques That Work" as done.');
      expect(session.reload).toHaveBeenCalledTimes(1);
    });

    it('P18.5-T3 AC-2 leaves the session alone for a reader with no open activation', async () => {
      const { session } = show({ [PUT]: { body: modulePage({ status: 'done' }) } });
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      await screen.findByText('Marked "Closing Techniques That Work" as done.');
      expect(session.reload).not.toHaveBeenCalled();
    });
  });

  describe('not offered, and the address (AC-3)', () => {
    it('P18.5-T1 AC-3 says a module the office does not offer cannot be found, with the way to the reader’s training', async () => {
      show({ [PAGE]: NOT_FOUND });
      expect(await screen.findByRole('heading', { name: 'This module can’t be found.' })).toBeInTheDocument();
      expect(screen.getByText('It may have been withdrawn, or the address may be mistyped.')).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Training modules' })).toHaveAttribute('href', '/training');
    });

    it('P18.5-T1 AC-3 says so when a module stops being offered under a write (404)', async () => {
      show({ [PUT]: NOT_FOUND });
      await ready();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(await screen.findByRole('heading', { name: 'This module can’t be found.' })).toBeInTheDocument();
    });

    it('P18.5-T1 AC-4 moves an address naming another category to the module’s own', async () => {
      show({}, LEARNER, { categoryCode: 'PRODUCT', moduleCode: 'CLOSING_TECHNIQUES' });
      await ready();
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/training/SALES/CLOSING_TECHNIQUES'));
    });

    it('P18.5-T1 AC-5 shows why the read failed, and asks again', async () => {
      const failed = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } };
      show({ [PAGE]: [failed, { body: modulePage() }] });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
    });

    it('UI-071 waits under a skeleton shaped like the page: the back row, the navy lesson card, the status card', () => {
      show();
      const skeleton = screen.getByText('Loading this module…').parentElement!;
      const shapes = Array.from(skeleton.querySelectorAll('div')).map((d) => d.getAttribute('class') ?? '');
      expect(shapes.some((c) => c.includes('bg-navy') && c.includes('rounded-[20px]'))).toBe(true);
      expect(shapes.some((c) => c.includes('bg-card') && c.includes('rounded-[20px]'))).toBe(true);
      expect(shapes.some((c) => c.includes('grid-cols-[minmax(0,1fr)_300px]'))).toBe(true);
    });
  });
});
