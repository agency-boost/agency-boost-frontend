import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { configOf, viewOf } from '@test/data-upload-fixtures';
import DataUploadPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/data-upload',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['kpm:read_profile', 'data_upload:read'],
});

/** A month read as the server answers it since P19.5-T2 (`viewOf`), naming the template it is given — or none. */
const month = (config?: Partial<ReturnType<typeof configOf>>) => {
  const view = viewOf([], 0, '2026-09', {
    month: '2026-09', revision: 0, locked: false, reason: 'open', editableUntil: '2026-10-07', changedAt: null, changedBy: null,
  }, config ? { config: configOf(config) } : {});
  if (!config) delete (view as Partial<typeof view>).config;
  return view;
};

/**
 * **P19.5-T1 AC-17 (AA UI-019) — the Data upload's banner**: the template the columns follow and its version, read live,
 * so the Owner and the Admins see what a Super Admin's publish put in force.
 */
describe('P19.5-T1 the Data upload names the template its columns follow', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-20T03:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('P19.5-T1 AC-17 reads “Kolom mengikuti Prudential template v2.”', async () => {
    stubFetch({ '/kpm/data-upload/': { body: month({ templateId: 't1', templateName: 'Prudential template', version: 2 }) } });
    renderInIndonesian(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByText('Kolom mengikuti Prudential template v2.')).toBeInTheDocument();
    // P19.5-T2: and how many columns, and what a greyed YTD is (the template mockup's KPM side).
    expect(screen.getByText('Kolom mengikuti Prudential template v2.').closest('p'))
      .toHaveTextContent('7 kolom per agen. Kolom YTD yang abu-abu dihitung otomatis dari bulan-bulan sebelumnya, jadi tidak perlu diunggah.');
  });

  it('P19.5-T1 AC-17 names the AgencyBoost template where the company publishes none, in English too', async () => {
    stubFetch({ '/kpm/data-upload/': { body: month({ templateId: null, templateName: null, version: 1 }) } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    expect(await screen.findByText('Columns follow the AgencyBoost template v1.')).toBeInTheDocument();
  });

  it('P19.5-T1 AC-17 draws nothing where the month read names no template', async () => {
    stubFetch({ '/kpm/data-upload/': { body: month() } });
    renderWithSession(<DataUploadPage />, { me: OWNER });
    await screen.findByText(/September 2026|Sep 2026/);
    expect(screen.queryByText(/Columns follow/)).toBeNull();
  });
});
