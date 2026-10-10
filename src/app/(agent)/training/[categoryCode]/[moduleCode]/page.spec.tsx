import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
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
    it('P18.5-T1 AC-5 titles the page with the module over “Structured training module.”', async () => {
      show();
      await ready();
      expect(screen.getByText('Structured training module.')).toBeInTheDocument();
    });

    it('P18.5-T1 AC-5 links back to the category’s list as “Back to {category title}”', async () => {
      show();
      await ready();
      expect(screen.getByRole('link', { name: 'Back to Sales Training' })).toHaveAttribute('href', '/training/SALES');
    });

    it('P18.5-T1 AC-5 keeps the subtabs above it, its category current', async () => {
      show();
      await ready();
      const tabs = screen.getByRole('navigation', { name: 'Training' });
      // The tab is where the reader is, not the page they are on (the list is): `location`, never `page`.
      expect(within(tabs).getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'location');
      expect(within(tabs).getByRole('link', { name: 'Product' })).not.toHaveAttribute('aria-current');
    });

    it('P18.5-T1 AC-5 heads the card with the title and “Skill: {label}”', async () => {
      show();
      await ready();
      expect(screen.getByRole('heading', { level: 2, name: 'Closing Techniques That Work' })).toBeInTheDocument();
      expect(screen.getByText('Skill: Closing')).toBeInTheDocument();
    });

    it('P18.5-T1 AC-5 draws a tile per item with its own label, caption and button (contradictions 5, 6)', async () => {
      show();
      await ready();
      const file = tile('closing-techniques.pdf');
      expect(within(file).getByText('Uploaded by admin')).toBeInTheDocument();
      expect(within(file).getByRole('button', { name: /^Open File/ })).toBeInTheDocument();
      const link = tile('Closing in practice');
      expect(within(link).getByText('External resource')).toBeInTheDocument();
      expect(within(link).getByRole('link', { name: /^Open Link/ })).toHaveAttribute('href', 'https://example.com/closing');
      expect(screen.queryByText('Closing Techniques That Work.pdf')).not.toBeInTheDocument();
    });

    it('P18.5-T1 AC-5 draws Play Video for a video, captioned as uploaded', async () => {
      show({
        [PAGE]: { body: modulePage({ items: [{ id: 'it-v', kind: 'video', label: 'closing.mp4', mimeType: 'video/mp4', bytes: 9, url: null }] }) },
      });
      await ready();
      const video = tile('closing.mp4');
      expect(within(video).getByText('Uploaded by admin')).toBeInTheDocument();
      expect(within(video).getByRole('button', { name: /^Play Video/ })).toBeInTheDocument();
    });

    it('P18.5-T1 AC-5 shows the Opened ✓ from the record, on the items opened before (D-opened)', async () => {
      show();
      await ready();
      expect(within(tile('closing-techniques.pdf')).getByRole('img', { name: 'Opened' })).toBeInTheDocument();
      expect(within(tile('Closing in practice')).queryByRole('img', { name: 'Opened' })).not.toBeInTheDocument();
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

      expect(await within(tile('Closing in practice')).findByRole('img', { name: 'Opened' })).toBeInTheDocument();
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
      expect(within(tile('Closing in practice')).queryByRole('img', { name: 'Opened' })).not.toBeInTheDocument();
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
      expect(within(tile('closing-techniques.pdf')).getByRole('img', { name: 'Opened' })).toBeInTheDocument();
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
      expect(within(tile('closing-techniques.pdf')).queryByRole('img', { name: 'Opened' })).not.toBeInTheDocument();
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
    it('P18.5-T1 AC-7 draws three buttons in the prototype’s order, the chosen one pressed and navy (ADR-0137 §2)', async () => {
      show({ [PAGE]: { body: modulePage({ status: 'in_progress' }) } });
      await ready();
      const group = screen.getByRole('group', { name: 'Status of Closing Techniques That Work' });
      const buttons = within(group).getAllByRole('button');
      expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
        ['Not started', 'false'], ['In progress', 'true'], ['Done', 'false'],
      ]);
      expect(buttons[1].className).toContain('bg-navy');
      expect(buttons[1].className).toContain('text-white');
      expect(buttons[0].className).not.toContain('bg-navy');
      expect(buttons[1].className).not.toMatch(/bg-amber|bg-alert|bg-success/);
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

    it('P18.5-T1 AC-5 waits under a skeleton', () => {
      show();
      expect(screen.getByText('Loading this module…')).toBeInTheDocument();
    });
  });
});
