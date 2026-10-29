import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import BranchInfoPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/branch-info',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['kpm:read_profile', 'tenant_config:write'],
});

const OFFICE = {
  _id: 'kpm-1', companyId: 'c1', companyName: 'Prudential', code: '0417',
  branchName: 'Cabang BSD City', address: 'Jl. BSD Grand Boulevard No. 1, Tangerang',
  contactPhone: '+62 21 5555 0417', ownerName: null,
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', fiscalYearStartMonth: 4,
};

const ENGLISH = /\b(KPM code|Branch name|Company|tagged by|Address|Contact phone|Nobody yet|Financial year|January|March|May|June|July|August|October|December|Time zone|Save|Saved)\b/;

/**
 * **P18.98-T4, Settings › Branch info in ID mode**: the form's words the approved glossary's Indonesian, its title,
 * *KPM*, *KPM Owner* and *Superadmin* English (§A), the office's own details as typed, and the months by their
 * Indonesian names. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Branch info in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 labels the form in Indonesian, the kept terms English and the office’s details as typed', async () => {
    stubFetch({ '/kpm/settings/branch-info': { body: OFFICE } });
    renderInIndonesian(<BranchInfoPage />, { me: OWNER });
    expect(await screen.findByDisplayValue('Cabang BSD City')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Branch info', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Nama KPM ini, dan lokasinya.')).toBeInTheDocument();
    expect(screen.getByText('Kode KPM')).toBeInTheDocument();
    expect(screen.getByText('Ditetapkan saat KPM ini dibuat, dan unik di perusahaan Anda.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama cabang')).toHaveValue('Cabang BSD City');
    expect(screen.getByText('Perusahaan (di-tag oleh Superadmin)')).toBeInTheDocument();
    expect(screen.getByText('Prudential')).toBeInTheDocument();
    expect(screen.getByLabelText('Alamat')).toHaveValue('Jl. BSD Grand Boulevard No. 1, Tangerang');
    expect(screen.getByLabelText('Telepon kontak')).toHaveValue('+62 21 5555 0417');
    expect(screen.getByText('KPM Owner')).toBeInTheDocument();
    expect(screen.getByText('Belum ada')).toBeInTheDocument();
    expect(screen.getByText('Zona waktu, bahasa, dan mata uang')).toBeInTheDocument();
    expect(screen.getByText('Asia/Jakarta · id-ID · IDR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-2 names the months in Indonesian, the office’s choice kept', async () => {
    stubFetch({ '/kpm/settings/branch-info': { body: OFFICE } });
    renderInIndonesian(<BranchInfoPage />, { me: OWNER });
    const select = await screen.findByLabelText('Tahun buku dimulai');

    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ]);
    expect(select).toHaveValue('4');
    expect(within(select).getByRole('option', { name: 'April' })).toHaveProperty('selected', true);
  });

  it('AC-1 says the save in Indonesian', async () => {
    stubFetch({
      '/kpm/settings/branch-info': [{ body: OFFICE }, { body: { ...OFFICE, branchName: 'Cabang BSD' } }],
    });
    renderInIndonesian(<BranchInfoPage />, { me: OWNER });
    const name = await screen.findByLabelText('Nama cabang');
    await userEvent.clear(name);
    await userEvent.type(name, 'Cabang BSD');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tersimpan.');
  });
});
