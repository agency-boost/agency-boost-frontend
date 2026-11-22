import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PlatformAnnouncementsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/platform/announcements',
  useSearchParams: () => new URLSearchParams(),
}));

const ME = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.id', fullName: 'PLATFORM OPERATOR', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'announcement:read', 'announcement:send'],
});

const SENT = {
  announcementId: 'an-1', message: 'Jadwal pelatihan bulan ini sudah ada.', audience: 'members', chosen: [], recipientCount: 42,
  sentBy: { userId: 'u-root', fullName: 'PLATFORM OPERATOR' }, sentAt: '2026-11-18T03:00:00.000Z',
};
const COMPANIES = { body: [{ _id: 'co-pru', name: 'Prudential', kind: 'insurer' }] };
const TENANTS = { body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', companyName: 'Prudential' }] };

function show(extra: Parameters<typeof stubFetch>[0] = {}) {
  const stub = stubFetch({
    'GET /admin/platform/announcements': { body: [SENT] },
    'POST /admin/platform/announcements/preview': ({ body }) => ({
      body: { audience: (body as { audience: string }).audience, recipients: (body as { audience: string }).audience === 'owners' ? 8 : 3 },
    }),
    '/admin/companies': COMPANIES,
    '/admin/tenants': TENANTS,
    ...extra,
  });
  renderWithSession(<PlatformAnnouncementsPage />, { me: ME });
  return stub;
}

describe('Platform › Pengumuman (P19.23-T6 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.23-T6 AC-4 opens on All owners, its count from the server on the send button, and the sent list', async () => {
    show();
    expect(screen.getByRole('radio', { name: 'All owners' })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByRole('button', { name: 'Send to 8 owners' })).toBeDisabled();
    const sent = await screen.findByRole('list', { name: 'Sent' });
    expect(sent).toHaveTextContent('Jadwal pelatihan bulan ini sudah ada.');
    expect(sent).toHaveTextContent('Every member · 42 people · PLATFORM OPERATOR');
  });

  it('P19.23-T6 AC-4 Pilih perusahaan / KPM: the picker, then the count for what was chosen', async () => {
    const stub = show();
    await userEvent.click(screen.getByRole('radio', { name: 'Choose companies / KPMs' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose companies and KPMs' });
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Prudential' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('button', { name: 'Send to 3 members' })).toBeInTheDocument();
    const previews = stub.calls.filter((c) => c.url.includes('/preview')).map((c) => JSON.parse(String(c.init.body)));
    expect(previews.at(-1)).toEqual({ audience: 'selected', companyIds: ['co-pru'], kpmIds: [] });
  });

  it('P19.23-T6 AC-4 Pratinjau shows the line each person will find in their notifications', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Message'), 'Fitur proposal baru sudah tersedia di menu Leads.');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = screen.getByRole('dialog', { name: 'Preview' });
    expect(dialog).toHaveTextContent('Announcement from AgencyBoost');
    expect(dialog).toHaveTextContent('Fitur proposal baru sudah tersedia di menu Leads.');
    expect(await within(dialog).findByText(/Reaches 8 people, each once/)).toBeInTheDocument();
  });

  it('P19.23-T6 AC-4 sends, then lists it first and clears the message', async () => {
    const stub = show({
      'POST /admin/platform/announcements': {
        status: 201,
        body: { ...SENT, announcementId: 'an-2', message: 'Halo semua owner', audience: 'owners', recipientCount: 8 },
      },
    });
    await userEvent.type(screen.getByLabelText('Message'), 'Halo semua owner');
    await userEvent.click(await screen.findByRole('button', { name: 'Send to 8 owners' }));

    const sent = await screen.findByRole('list', { name: 'Sent' });
    await vi.waitFor(() => expect(within(sent).getAllByRole('listitem')[0]).toHaveTextContent('Halo semua owner'));
    expect(screen.getByLabelText('Message')).toHaveValue('');
    const post = stub.calls.find((c) => c.init.method === 'POST' && !c.url.includes('/preview'))!;
    expect(JSON.parse(String(post.init.body))).toEqual({ audience: 'owners', message: 'Halo semua owner' });
  });

  it('P19.23-T6 AC-4 counts the message and holds the send past 500 characters', async () => {
    show();
    const field = screen.getByLabelText('Message');
    await userEvent.click(field);
    await userEvent.paste('a'.repeat(501));
    expect(screen.getAllByText('501/500').length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Send to 8 owners' })).toBeDisabled();
  });

  it('shows the server’s refusal of a send', async () => {
    show({
      'POST /admin/platform/announcements': {
        status: 409,
        body: { error: { code: 'ANNOUNCEMENT_NO_RECIPIENTS', message: 'Nobody would receive this announcement.', requestId: 'r-1' } },
      },
    });
    await userEvent.type(screen.getByLabelText('Message'), 'Halo');
    await userEvent.click(await screen.findByRole('button', { name: 'Send to 8 owners' }));
    expect(await screen.findByText(/Nobody would receive this announcement/)).toBeInTheDocument();
  });
});
