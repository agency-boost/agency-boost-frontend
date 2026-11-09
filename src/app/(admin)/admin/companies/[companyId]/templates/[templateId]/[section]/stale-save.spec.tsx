import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, PRUDENTIAL, RATIOS, SUPER_ADMIN, TAXONOMY, kindView,
} from '@test/kpm-template-fixtures';
import SectionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/activity',
}));

/** The save state's words — the shared label, by its own mark. */
const saveState = () => document.querySelector('[data-state]');
/** Autosave waits for a pause; a test waits a little longer than it. */
const SAVED = { timeout: 3000 };

const TAXONOMY_URL = '/admin/companies/c1/template/activity_taxonomy';

const STALE: StubReply = {
  status: 409,
  body: {
    error: {
      code: 'VERSION_CONFLICT',
      message: 'Someone else saved this section after you opened it, and nothing was saved. Reload to see what is stored now.',
      details: { expectedRevision: 5, actualRevision: 6 },
      requestId: 'r-409',
    },
  },
};

/** The activity section, its taxonomy a draft at revision 5 — what the server stored when the page was opened. */
function render(taxonomy: StubReply | StubReply[], put: StubReply | StubReply[], indonesian = false) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    [`GET ${TAXONOMY_URL}`]: taxonomy,
    '/admin/companies/c1/template/ratio_set': { body: kindView('ratio_set', RATIOS, { revision: 1 }) },
    [`PUT ${TAXONOMY_URL}`]: put,
  });
  const page = <SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section: 'activity' })} />;
  if (indonesian) renderInIndonesian(page, { me: SUPER_ADMIN });
  else renderWithSession(page, { me: SUPER_ADMIN });
  return stub;
}

const draft = (label: string, revision: number) => kindView('activity_taxonomy', {
  ...TAXONOMY, types: [{ ...TAXONOMY.types[0], label }],
}, { status: 'draft', version: 4, publishedVersion: 3, revision });

/** Rename the one activity type, and press its row's *Save*: the draft goes after the autosave pause. */
async function rename(from: string, to: string, save = 'Save', edit = 'Edit', field = 'Name') {
  const row = (await screen.findByText(from)).closest('li, [data-row]') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: edit }));
  const input = within(row).getByLabelText(field);
  await userEvent.clear(input);
  await userEvent.type(input, to);
  await userEvent.click(screen.getByRole('button', { name: save }));
}

const puts = (calls: { url: string; init: RequestInit }[]) => calls.filter((c) => c.init.method === 'PUT');
const gets = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => c.url.includes(TAXONOMY_URL) && (c.init.method ?? 'GET') === 'GET');

/**
 * **A template section's draft names the revision it was made from** (P19-T6 AC-2; the 11-03 handover's B1-10): each
 * save sends the `revision` of the server's last answer, and a save somebody else has moved past is refused rather than
 * written — the bar says so in its own words and offers *Reload* in the place of *Try again*.
 */
describe('P19-T6 a template section’s stale saves', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T6 AC-2 sends the revision it read, and the one each save answers after it', async () => {
    const stub = render({ body: draft('Submission polis', 5) }, [
      { body: draft('Closing', 6) },
      { body: draft('Closing lagi', 7) },
    ]);
    await rename('Submission polis', 'Closing');
    await vi.waitFor(() => expect(saveState()).toHaveTextContent('Saved ✓'), SAVED);
    await rename('Closing', 'Closing lagi');
    await vi.waitFor(() => expect(puts(stub.calls)).toHaveLength(2), SAVED);

    const sent = puts(stub.calls).map((c) => JSON.parse(String(c.init.body)).expectedRevision);
    expect(sent).toEqual([5, 6]);
  });

  it('P19-T6 AC-2 says somebody else saved first, offers Reload instead of Try again, and stops saving', async () => {
    const stub = render({ body: draft('Submission polis', 5) }, STALE);
    await rename('Submission polis', 'Milik saya');

    const banner = await screen.findByText(/Someone else saved this section after you opened it/, undefined, SAVED);
    const alert = banner.closest('[role="alert"]') as HTMLElement;
    expect(alert).toHaveTextContent('so your change was not saved. Reload to see what is stored now.');
    expect(alert).toHaveTextContent('VERSION_CONFLICT · r-409');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    // The reader's words stay on screen until they choose to reload.
    expect(screen.getByText('Milik saya')).toBeInTheDocument();

    // Another edit is not sent: the server would refuse it the same.
    await rename('Milik saya', 'Milik saya juga');
    await new Promise((resolve) => { setTimeout(resolve, 1200); });
    expect(puts(stub.calls)).toHaveLength(1);
  });

  it('P19-T6 AC-2 reads the section again on Reload, and shows what is stored now', async () => {
    const stub = render([
      { body: draft('Submission polis', 5) },
      { body: draft('Milik mereka', 6) },
    ], [STALE, { body: draft('Sesudah muat ulang', 7) }]);
    await rename('Submission polis', 'Milik saya');
    await userEvent.click(await screen.findByRole('button', { name: 'Reload' }, SAVED));

    expect(await screen.findByText('Milik mereka')).toBeInTheDocument();
    expect(screen.queryByText(/Someone else saved this section/)).not.toBeInTheDocument();
    expect(gets(stub.calls)).toHaveLength(2);

    // Saving goes on from the revision just read.
    await rename('Milik mereka', 'Sesudah muat ulang');
    await vi.waitFor(() => expect(puts(stub.calls)).toHaveLength(2), SAVED);
    expect(JSON.parse(String(puts(stub.calls)[1].init.body)).expectedRevision).toBe(6);
  });

  it('P19-T6 AC-2 says it in Indonesian', async () => {
    render({ body: draft('Submission polis', 5) }, STALE, true);
    await rename('Submission polis', 'Milik saya', 'Simpan', 'Ubah', 'Nama');
    expect(await screen.findByText(/Orang lain menyimpan bagian ini setelah Anda membukanya/, undefined, SAVED))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument();
  });
});
