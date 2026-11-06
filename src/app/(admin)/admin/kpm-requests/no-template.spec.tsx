import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
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
  permissions: ['kpm:list_all', 'kpm_request:read', 'kpm_request:decide', 'company_template:read'],
});

const REQUEST = {
  requestId: 'req-1', branchName: 'Sudirman', companyId: 'co-new', companyName: 'Sequis',
  requestedByName: 'Dewi Lestari', requestedByEmail: 'dewi@example.test', note: null, status: 'pending',
  requestedAt: '2026-11-04T00:00:00.000Z', decidedAt: null, reason: null, createdKpmId: null,
  requestedByPhone: null, requesterCompanyId: 'co-new', requesterCompanyName: 'Sequis', requesterEmailVerified: true,
  createdKpm: null,
};
const LIBRARY = { _id: 'lib', name: 'Template', slug: 'template', kind: 'template', status: 'active' };
const SEQUIS = { _id: 'co-new', name: 'Sequis', slug: 'sequis', kind: 'insurer', status: 'active' };
const BUILT_IN = {
  id: 'lib-default', companyId: 'lib', name: 'Default template', isDefault: true, status: 'active', archivedAt: null,
  origin: { kind: 'defaults' }, publishedVersions: {}, sections: {}, officeCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

/** Sequis made since ADR-0213 §3: no template of its own yet; the platform's built-in one beside it. */
function stub() {
  return stubFetch({
    '/admin/kpm-requests/req-1/approve': { body: [{ ...REQUEST, status: 'approved', createdKpmId: 'kpm-9' }] },
    '/admin/kpm-requests': { body: [REQUEST] },
    '/admin/companies/co-new/templates': { body: [] },
    '/admin/companies/lib/templates': { body: [BUILT_IN] },
    '/admin/companies': { body: [SEQUIS, LIBRARY] },
    '/companies': { body: [{ _id: 'co-new', name: 'Sequis' }] },
    '/code-availability': { body: { available: true, takenBy: null } },
  });
}

/**
 * **Approving a request for a company with no template** (P19.4-T5 AC-5; ADR-0213 §3; the 11-03 handover's B1-8): the
 * card offers *Mulai dari* — the built-in templates and *Kosong*, the built-in default chosen — and sends the choice. A
 * company with a template of its own draws none (`page.spec.tsx`).
 */
describe('P19.4-T5 AC-5 Mulai dari on a request for a company with no template', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T5 AC-5 offers the built-in templates and Kosong, the built-in default chosen, and sends it', async () => {
    const { calls } = stub();
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    const picker = await screen.findByLabelText('Start from');
    await waitFor(() => expect(picker).toHaveDisplayValue('Default template'));
    expect(picker).toHaveAccessibleDescription(
      'This company has no template yet, so the office starts from a built-in template, or empty.',
    );
    await userEvent.type(screen.getByLabelText('KPM code'), '0629');
    await screen.findByText('Free in this company.');
    await userEvent.click(screen.getByRole('button', { name: 'Approve & make Owner' }));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/approve'))).toBe(true));
    const sent = calls.find((c) => c.url.includes('/approve'));
    expect(JSON.parse(String(sent?.init.body))).toEqual({
      code: '0629', startFrom: { kind: 'template', templateLibrary: true, templateId: 'lib-default' },
    });
  });

  it('P19.4-T5 AC-5 Kosong sends an empty start', async () => {
    const { calls } = stub();
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });
    const picker = await screen.findByLabelText('Start from');
    await waitFor(() => expect(picker).toHaveDisplayValue('Default template'));
    await userEvent.selectOptions(picker, 'empty');
    await userEvent.type(screen.getByLabelText('KPM code'), '0629');
    await screen.findByText('Free in this company.');
    await userEvent.click(screen.getByRole('button', { name: 'Approve & make Owner' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/approve'))).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url.includes('/approve'))?.init.body)))
      .toEqual({ code: '0629', startFrom: { kind: 'empty' } });
  });

  it.each([375, 1280])('P19.4-T5 AC-5 the picker in Indonesian at %ipx', async (px) => {
    atWidth(px);
    stub();
    renderInIndonesian(<KpmRequestsPage />, { me: SUPER_ADMIN });
    const picker = await screen.findByLabelText('Mulai dari');
    expect(picker).toHaveAccessibleDescription(
      'Perusahaan ini belum punya template, jadi KPM dimulai dari template bawaan, atau kosong.',
    );
    // Moved 2026-11-06 (P19.2-T2 AC-4; UI-134): below 1024px the picker is a pill opening its choices, so *Kosong* is one
    // of its rows there, and an option of the select on a laptop.
    if (px >= 1024) {
      expect(screen.getByRole('option', { name: 'Kosong' })).toBeInTheDocument();
    } else {
      expect(picker.tagName).toBe('BUTTON');
      await waitFor(() => expect(picker).not.toBeDisabled());
      await userEvent.click(picker);
      expect(within(await screen.findByRole('dialog', { name: 'Pilih mulai dari' })).getByRole('radio', { name: 'Kosong' }))
        .toBeInTheDocument();
    }
  });
});
