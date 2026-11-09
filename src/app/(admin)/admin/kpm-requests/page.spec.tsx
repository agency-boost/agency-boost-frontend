import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import KpmRequestsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/kpm-requests',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `AdminShell` gates the whole console on `kpm:list_all`.
  permissions: ['kpm:list_all', 'kpm_request:read', 'kpm_request:decide'],
});

const req = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', branchName: 'Surabaya Branch', companyId: 'co-1',
  companyName: 'Prudential', requestedByName: 'Rangga Wibisono',
  requestedByEmail: 'rangga@example.test', note: 'Twelve agents already here.',
  status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z',
  decidedAt: null, reason: null, createdKpmId: null,
  requestedByPhone: '+62 812 3456 7890', requesterCompanyId: 'co-1', requesterCompanyName: 'Prudential',
  requesterEmailVerified: true, createdKpm: null, ...over,
});

/** The insurers the card's company picker offers (`GET /companies`). */
const INSURERS = { body: [{ _id: 'co-1', name: 'Prudential' }, { _id: 'co-2', name: 'Manulife' }] };
const FREE = { body: { available: true, takenBy: null } };

/**
 * Each company's own template, as `GET /admin/companies/:companyId/templates` answers it: a company with one starts the
 * office from its default and the card offers no *Mulai dari* (ADR-0213 §3) — `no-template.spec.tsx` has the other case.
 */
const template = (companyId: string) => ({
  id: `t-${companyId}`, companyId, name: 'Template', isDefault: true, status: 'active', archivedAt: null,
  origin: { kind: 'empty' }, publishedVersions: {}, sections: {}, officeCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});
const OWN_TEMPLATES = {
  '/admin/companies/co-1/templates': { body: [template('co-1')] },
  '/admin/companies/co-2/templates': { body: [template('co-2')] },
};

describe('KPMs pending approval (P3.1-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: names the branch, the company, and who asked with their intent', async () => {
    // `Superadmin.html:329` writes the requester and the proposed Owner as one string,
    // because they are one person: asking for an office is asking to run one.
    stubFetch({ '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Surabaya Branch')).toBeInTheDocument();
    // Named twice on purpose: once in the row's meta line, once in the sentence saying
    // what approving will do to them.
    expect(screen.getAllByText(/Rangga Wibisono/).length).toBeGreaterThan(1);
    expect(screen.getByText(/proposed KPM Owner/)).toBeInTheDocument();
    expect(screen.getByText('Twelve agents already here.')).toBeInTheDocument();
  });

  it('AC-2: will not approve without a code, because the platform issues it', async () => {
    // The code must be unique within the company and a requester cannot know what is
    // free — which is why the prototype's `KPM name` column is a branch name.
    stubFetch({ '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('button', { name: 'Approve & make Owner' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('KPM code'), '0629');
    await screen.findByText('Free in this company.');
    expect(screen.getByRole('button', { name: 'Approve & make Owner' })).toBeEnabled();
  });

  it('AC-2: says what approving will do before it is pressed', async () => {
    stubFetch({ '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(
      await screen.findByText('Approving creates the office and makes Rangga Wibisono its Owner.'),
    ).toBeInTheDocument();
  });

  it('AC-2: sends the code the platform typed', async () => {
    const { calls } = stubFetch({
      '/admin/kpm-requests/req-1/approve': { body: [req({ status: 'approved', createdKpmId: 'kpm-9' })] },
      '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE,
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('KPM code'), '0629');
    await screen.findByText('Free in this company.');
    await userEvent.click(screen.getByRole('button', { name: 'Approve & make Owner' }));

    const sent = calls.find((c) => c.url.includes('/approve'));
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ code: '0629' });
  });

  it('declining needs no code, and carries the reason back', async () => {
    const { calls } = stubFetch({
      '/admin/kpm-requests/req-1/decline': { body: [req({ status: 'declined', reason: 'Already KPM 0417.' })] },
      '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES,
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Why not?'), 'Already KPM 0417.');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    const sent = calls.find((c) => c.url.includes('/decline'));
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ reason: 'Already KPM 0417.' });
  });

  it('lines both decision buttons up with the inputs, not the labels', async () => {
    // Approve was a bare child of the `FieldRow` while Decline was wrapped, so only Approve
    // rode up to the label row — the row is `items-start`, and a button carries no label to
    // start with. Both sit in an actions slot now, which supplies the label-shaped spacer.
    stubFetch({ '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    for (const name of ['Approve & make Owner', 'Decline']) {
      const actions = (await screen.findByRole('button', { name })).closest('.flex-col');
      expect(actions?.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('separates what is decided from what is waiting', async () => {
    stubFetch({
      '/admin/kpm-requests': {
        body: [req(), req({ requestId: 'req-2', branchName: 'Medan Branch', status: 'declined', reason: 'No.' })],
      },
      '/companies': INSURERS, ...OWN_TEMPLATES,
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Medan Branch')).toBeInTheDocument();
    // The pending one is a card above, not a row in the decided table.
    expect(within(table).queryByText('Surabaya Branch')).toBeNull();
  });

  it('says nothing is waiting rather than showing an empty table', async () => {
    stubFetch({ '/admin/kpm-requests': { body: [] }, '/companies': INSURERS, ...OWN_TEMPLATES });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Nobody is waiting for an office.')).toBeInTheDocument();
  });

  describe('P19-T3 the request card (ADR-0191 §2–§5; UI-168)', () => {
    it('P19-T3 AC-1 names the applicant: name, email, phone, the company, the branch, the note and the date', async () => {
      stubFetch({ '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByText('Surabaya Branch')).toBeInTheDocument();
      expect(screen.getByText(/rangga@example\.test · \+62 812 3456 7890 · 1 Sep 2026/)).toBeInTheDocument();
      expect(screen.getByText('Twelve agents already here.')).toBeInTheDocument();
      expect(screen.getByLabelText('Company')).toHaveValue('co-1');
    });

    it('P19-T3 AC-2 the company is a picker; an applicant of another company is said, and approving waits for theirs', async () => {
      // Production's shape (UI-165): Victor signed up with Manulife, his request arrived as Prudential.
      const { calls } = stubFetch({
        '/admin/kpm-requests/req-1/approve': { body: [req({ status: 'approved', companyId: 'co-2', companyName: 'Manulife' })] },
        '/admin/kpm-requests': { body: [req({
          requestedByName: 'Victor Gunawan', requesterCompanyId: 'co-2', requesterCompanyName: 'Manulife',
        })] },
        '/companies': INSURERS, ...OWN_TEMPLATES,
        '/code-availability': FREE,
      });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByText(
        'Victor Gunawan signed up with Manulife. An office takes only its own company\'s agents: choose Manulife.',
      )).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('KPM code'), '1001');
      const approve = screen.getByRole('button', { name: 'Approve & make Owner' });
      expect(approve).toBeDisabled();

      await screen.findByRole('option', { name: 'Manulife' });
      await userEvent.selectOptions(screen.getByLabelText('Company'), 'co-2');
      await screen.findByText('Free in this company.');
      expect(screen.queryByText(/signed up with Manulife/)).toBeNull();
      expect(approve).toBeEnabled();
      await userEvent.click(approve);

      const sent = calls.find((c) => c.url.includes('/approve'));
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ code: '1001', companyId: 'co-2' });
      // The code was checked against the company chosen.
      expect(calls.some((c) => c.url.includes('code-availability?companyId=co-2&code=1001'))).toBe(true);
    });

    it('P19-T3 AC-2 says as it is typed that a code is already used, naming the office and its company', async () => {
      stubFetch({
        '/admin/kpm-requests': { body: [req()] },
        '/companies': INSURERS, ...OWN_TEMPLATES,
        '/code-availability': { body: { available: false, takenBy: {
          kpmId: 'kpm-1001', code: '1001', branchName: 'stellar', companyName: 'Prudential',
        } } },
      });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      await userEvent.type(await screen.findByLabelText('KPM code'), '1001');
      expect(await screen.findByText('Already used by KPM 1001 · stellar (Prudential).')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approve & make Owner' })).toBeDisabled();
    });

    it('P19-T3 AC-3 says an unverified applicant cannot own it yet, and waits', async () => {
      stubFetch({ '/admin/kpm-requests': { body: [req({ requesterEmailVerified: false })] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByText(/has not verified their email address yet/)).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('KPM code'), '0629');
      await screen.findByText('Free in this company.');
      expect(screen.getByRole('button', { name: 'Approve & make Owner' })).toBeDisabled();
    });

    it('P19-T3 AC-3 one button approves and makes the Owner; the request moves to Already decided with the office it made', async () => {
      stubFetch({
        '/admin/kpm-requests/req-1/approve': { body: [req({
          status: 'approved', decidedAt: '2026-11-04T03:00:00.000Z', createdKpmId: 'kpm-9',
          createdKpm: { kpmId: 'kpm-9', code: '0629', branchName: 'Surabaya Branch', deleted: false },
        })] },
        '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE,
      });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      await userEvent.type(await screen.findByLabelText('KPM code'), '0629');
      await screen.findByText('Free in this company.');
      await userEvent.click(screen.getByRole('button', { name: 'Approve & make Owner' }));

      const table = await screen.findByRole('table');
      expect(within(table).getByRole('link', { name: 'KPM 0629' })).toHaveAttribute('href', '/admin/tenants/kpm-9');
      expect(within(table).getByText('Decided 4 Nov 2026')).toBeInTheDocument();
    });

    it('P19-T3 AC-7 Delete removes a wrong or duplicate request, asked first', async () => {
      const { calls } = stubFetch({
        'DELETE /admin/kpm-requests/req-1': { body: [] },
        '/admin/kpm-requests': { body: [req()] }, '/companies': INSURERS, ...OWN_TEMPLATES,
      });
      renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

      await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
      expect(screen.getByText(/Delete the request for Surabaya Branch\?/)).toBeInTheDocument();
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await vi.waitFor(() => expect(calls.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/admin/kpm-requests/req-1'))).toBe(true));
      expect(await screen.findByText('Nobody is waiting for an office.')).toBeInTheDocument();
    });
  });
});

/**
 * **P19.2-T2 — the requests page below 1024px** (UI-126, UI-134, UI-135): the decided requests as rows, *Hapus* in ⋯; a
 * card's company a pill opening the insurers; 44px targets. The laptop keeps its table and its select.
 */
describe('P19.2-T2 the KPM requests page below 1024px (UI-126, UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const DECIDED = [
    req({
      requestId: 'req-2', branchName: 'Medan Branch', status: 'approved', decidedAt: '2026-11-04T03:00:00.000Z',
      createdKpmId: 'kpm-9', createdKpm: { kpmId: 'kpm-9', code: '0629', branchName: 'Medan Branch', deleted: false },
    }),
    req({ requestId: 'req-3', branchName: 'Bogor Branch', status: 'declined', reason: 'Duplicate of Medan.', decidedAt: '2026-11-03T03:00:00.000Z' }),
  ];
  const show = (rows: unknown[] = [req(), ...DECIDED], extra: Parameters<typeof stubFetch>[0] = {}) => {
    const stub = stubFetch({
      '/admin/kpm-requests': { body: rows }, '/companies': INSURERS, ...OWN_TEMPLATES, '/code-availability': FREE, ...extra,
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });
    return stub;
  };

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx the decided requests are rows: the branch, company · proposed Owner, what it made, its state', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Decided registrations' });
    expect(screen.queryByRole('table')).toBeNull();
    const [made, declined] = within(list).getAllByRole('listitem');
    expect(wears(made, px)).toContain('min-h-14');
    expect(within(made).getByRole('link', { name: 'Medan Branch' })).toHaveAttribute('href', '/admin/tenants/kpm-9');
    expect(made).toHaveTextContent('Prudential · Rangga Wibisono (proposed KPM Owner)');
    expect(made).toHaveTextContent('KPM 0629');
    expect(made).toHaveTextContent('Decided 4 Nov 2026');
    expect(within(made).getByText('Approved')).toBeInTheDocument();
    // A declined request made nothing: read, not a link; its reason under it.
    expect(within(declined).queryByRole('link')).toBeNull();
    expect(declined).toHaveTextContent('Duplicate of Medan.');
    expect(within(declined).getByText('Declined')).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the decided table', async (px) => {
    atWidth(px);
    show();
    const table = await screen.findByRole('table', { name: 'Decided registrations' });
    expect(within(table).getByRole('link', { name: 'KPM 0629' })).toHaveAttribute('href', '/admin/tenants/kpm-9');
    expect(screen.queryByRole('list', { name: 'Decided registrations' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx a decided row’s ⋯ holds Delete, which asks first', async (px) => {
    atWidth(px);
    const { calls } = show(DECIDED, { 'DELETE /admin/kpm-requests/req-3': { body: [DECIDED[0]] } });
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Bogor Branch' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete the request for Bogor Branch?');
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/admin/kpm-requests/req-3'))).toBe(true));
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx a card’s company is a pill, and choosing another is sent with the approval', async (px) => {
    atWidth(px);
    const { calls } = show([req({ requestedByName: 'Victor Gunawan', requesterCompanyId: 'co-2', requesterCompanyName: 'Manulife' })], {
      '/admin/kpm-requests/req-1/approve': { body: [req({ status: 'approved', companyId: 'co-2', companyName: 'Manulife' })] },
    });
    const pill = await screen.findByRole('button', { name: 'Company: Prudential' });
    expect(document.querySelector('select')).toBeNull();
    await userEvent.type(screen.getByLabelText('KPM code'), '1001');
    await userEvent.click(pill);
    const sheet = await screen.findByRole('dialog', { name: 'Choose company' });
    await waitFor(() => expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Prudential', 'Manulife']));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Manulife' }));
    await screen.findByText('Free in this company.');
    await userEvent.click(screen.getByRole('button', { name: 'Approve & make Owner' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/approve'))).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url.includes('/approve'))?.init?.body))).toEqual({ code: '1001', companyId: 'co-2' });
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Decided registrations' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 AC-4 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Medan Branch');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
