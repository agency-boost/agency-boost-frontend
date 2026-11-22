import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PlatformSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/platform/settings',
  useSearchParams: () => new URLSearchParams(),
}));

const ME = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.id', fullName: 'PLATFORM OPERATOR', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'platform_settings:read', 'platform_settings:update'],
});

const SETTINGS = {
  whatsappNumber: '+628112000300', aiReadingKey: 'set', defaultLook: { systemName: 'AgencyBoost', editable: false },
  updatedAt: '2026-11-19T03:00:00.000Z',
};

describe('Platform › Pengaturan platform (P19.23-T6 AC-3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.23-T6 AC-3 shows the AI key’s state alone, the number as people write it, the default look and where premium tables go', async () => {
    stubFetch({ '/admin/platform/settings': { body: SETTINGS } });
    renderWithSession(<PlatformSettingsPage />, { me: ME });

    expect(await screen.findByText('•••• stored')).toBeInTheDocument();
    // No field can take the key: the only input is the WhatsApp number.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('WhatsApp sender number')).toHaveValue('0811 2000 300');
    expect(screen.getByText('AgencyBoost · navy & orange')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload per company in Companies & templates' })).toHaveAttribute('href', '/admin/companies');
  });

  it('P19.23-T6 AC-3 says Not set when the environment has no key', async () => {
    stubFetch({ '/admin/platform/settings': { body: { ...SETTINGS, aiReadingKey: 'not_set' } } });
    renderWithSession(<PlatformSettingsPage />, { me: ME });
    expect(await screen.findByText('Not set')).toBeInTheDocument();
  });

  it('P19.23-T6 AC-3 Save sends the number as typed and draws what the server stored', async () => {
    const stub = stubFetch({
      'GET /admin/platform/settings': { body: { ...SETTINGS, whatsappNumber: null } },
      'PUT /admin/platform/settings': { body: { ...SETTINGS, whatsappNumber: '+6281234567890' } },
    });
    renderWithSession(<PlatformSettingsPage />, { me: ME });

    const field = await screen.findByLabelText('WhatsApp sender number');
    await userEvent.type(field, '0812-3456-7890');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(field).toHaveValue('0812 3456 7890'));
    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toEqual({ whatsappNumber: '0812-3456-7890' });
  });

  it('P19.23-T6 AC-3 says under the field why the server refused the number', async () => {
    stubFetch({
      'GET /admin/platform/settings': { body: SETTINGS },
      'PUT /admin/platform/settings': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Enter an Indonesian WhatsApp number.', requestId: 'r-1', details: { field: 'whatsappNumber' } } },
      },
    });
    renderWithSession(<PlatformSettingsPage />, { me: ME });
    const field = await screen.findByLabelText('WhatsApp sender number');
    await userEvent.clear(field);
    await userEvent.type(field, 'nomor');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter an Indonesian WhatsApp number.')).toBeInTheDocument();
  });

  it('shows the read’s failure with Try again', async () => {
    stubFetch({ '/admin/platform/settings': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r-9' } } } });
    renderWithSession(<PlatformSettingsPage />, { me: ME });
    expect(await screen.findByText('This could not be loaded.')).toBeInTheDocument();
  });
});
