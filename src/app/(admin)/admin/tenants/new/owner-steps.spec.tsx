import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import NewTenantPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/new',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create'],
});

const COMPANIES = [{ _id: 'co-1', name: 'Prudential', slug: 'prudential' }];
const template = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, companyId: 'co-1', name, isDefault: false, status: 'active', archivedAt: null, origin: { kind: 'empty' },
  publishedVersions: {}, sections: {}, officeCount: 0, createdAt: '2026-10-07T03:00:00.000Z',
  updatedAt: '2026-10-07T03:00:00.000Z', ...over,
});
/** SA case 10's *Prudential template*: two sections with a change waiting — *Aktivitas & rasio* and *Pelatihan*. */
const DRAFTS = {
  activity_taxonomy: { publishedVersion: 3, hasDraft: true },
  ratio_set: { publishedVersion: 2, hasDraft: false },
  training_taxonomy: { publishedVersion: 1, hasDraft: true },
};
const TEMPLATES = [
  template('t-default', 'Prudential template', { isDefault: true, sections: DRAFTS }),
  template('t-clean', 'Jakarta branches', { sections: { activity_taxonomy: { publishedVersion: 1, hasDraft: false } } }),
];

function stub(created: Record<string, unknown> = { _id: 'kpm-0602', invitationSent: true }) {
  return stubFetch({
    '/admin/companies': { body: COMPANIES },
    '/admin/companies/co-1/templates': { body: TEMPLATES },
    '/admin/tenants': { status: 201, body: created },
  });
}

async function fillKpm() {
  await userEvent.type(await screen.findByLabelText('Office code'), '0602');
  await userEvent.type(screen.getByLabelText('Branch name'), 'Bandung Dago');
}

/**
 * ***KPM baru* in three steps** (P19.4-T3 AC-6, AC-14; ADR-0212 §1; SA UI-014, SA UI-019; the setup spec's A2, A5-1):
 * the KPM, *Pemilik KPM*, the invitation; *"Lewati, nanti saja"*; the toast; and the draft warning below *Mulai dari*.
 */
describe('P19.4-T3 KPM baru with its Owner', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it.each([375, 1280])('P19.4-T3 AC-6 (A5-1) at %ipx: 0602 Bandung Dago with Owner Wulan Kartika, invited — the body and the toast', async (px) => {
    atWidth(px);
    const { calls } = stub();
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
    await fillKpm();
    // The three steps, each a heading with its number said whole.
    expect(screen.getByRole('heading', { name: /Step 1 of 3: KPM details/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 2 of 3: KPM owner/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 3 of 3: Invitation/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'Wulan Kartika');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812 7700 6020');
    await userEvent.type(screen.getByLabelText('Email'), 'wulan.kartika@example.test');
    await userEvent.type(screen.getByLabelText('Owner’s agent code'), '70045001');
    // *"Kirim undangan … sekarang"*, on by default.
    expect(screen.getByRole('checkbox', { name: /Send the owner an invitation now/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-0602'));
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string)).toEqual({
      companyId: 'co-1', code: '0602', branchName: 'Bandung Dago', startFrom: { kind: 'template', templateId: 't-default' },
      owner: { fullName: 'Wulan Kartika', phone: '0812 7700 6020', email: 'wulan.kartika@example.test', agentCode: '70045001' },
      sendInvitation: true,
    });
    // The shell's toast, which outlives the navigation to the KPM's page.
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('KPM created. Invitation sent.')))
      .toBe(true));
  });

  it('P19.4-T3 AC-6 "Lewati, nanti saja" sends no owner, and drops the invitation step', async () => {
    const { calls } = stub({ _id: 'kpm-0602', invitationSent: false });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
    await fillKpm();
    await userEvent.click(screen.getByRole('button', { name: 'Skip, do it later' }));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/No owner yet: set one later from the KPM’s page/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const body = JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string);
    expect(body).not.toHaveProperty('owner');
    expect(body).not.toHaveProperty('sendInvitation');
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('KPM created.'))).toBe(true);
  });

  it('P19.4-T3 AC-6 a name and a full WhatsApp number are required; nothing is sent until they are', async () => {
    const { calls } = stub();
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
    await fillKpm();
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));
    expect(screen.getByText('Type the owner’s name.')).toBeInTheDocument();
    expect(screen.getByText('Type a full WhatsApp number, e.g. 0812 3456 7890.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('P19.4-T3 AC-6 without an email, says the owner cannot be invited yet, and the invitation box sends nothing to anybody', async () => {
    const { calls } = stub({ _id: 'kpm-0602', invitationSent: false });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
    await fillKpm();
    await userEvent.type(screen.getByLabelText('Name'), 'Wulan Kartika');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812 7700 6020');
    expect(screen.getByText(/With no email the owner cannot be invited yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string).owner)
      .toEqual({ fullName: 'Wulan Kartika', phone: '0812 7700 6020' });
    // Not *"Undangan dikirim"*: nothing went.
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('Invitation sent'))).toBe(false);
  });

  it('P19.4-T3 AC-6 (A5-1) says the steps in the setup spec’s Indonesian, and no WhatsApp sending', async () => {
    stub();
    renderInIndonesian(<NewTenantPage />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('heading', { name: /Langkah 2 dari 3: Pemilik KPM/ })).toBeInTheDocument();
    for (const label of ['Nama', 'No. WhatsApp', 'Email', 'Kode agen pemilik']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Lewati, nanti saja' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Kirim undangan ke pemilik sekarang/ })).toBeChecked();
    // ADR-0212 §4: the number is kept to call; the mockup's "Undangan dikirim lewat WhatsApp" is not said.
    expect(screen.queryByText(/lewat WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin KPM/)).not.toBeInTheDocument();
  });

  describe('SA UI-019 the template’s drafts (AC-14; SA case 10)', () => {
    it.each([375, 1280])('P19.4-T3 AC-14 at %ipx warns below Mulai dari when the chosen template has drafts, with Buka template', async (px) => {
      atWidth(px);
      stub();
      renderInIndonesian(<NewTenantPage />, { me: SUPER_ADMIN });
      expect(await screen.findByText(/2 bagian punya perubahan yang belum terbit\. KPM baru memakai versi terakhir yang terbit\./))
        .toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Buka template' })).toHaveAttribute('href', '/admin/companies/co-1/templates/t-default');
    });

    it('P19.4-T3 AC-14 says nothing for a template with no draft, nor for Empty', async () => {
      stub();
      renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });
      const select = await screen.findByRole('combobox', { name: 'Start from' });
      expect(await screen.findByText(/2 sections have changes that are not published/)).toBeInTheDocument();
      await userEvent.selectOptions(select, screen.getByRole('option', { name: 'Jakarta branches' }));
      expect(screen.queryByText(/have changes that are not published/)).not.toBeInTheDocument();
      await userEvent.selectOptions(select, screen.getByRole('option', { name: 'Empty' }));
      expect(screen.queryByRole('link', { name: 'Open template' })).not.toBeInTheDocument();
    });
  });
});
