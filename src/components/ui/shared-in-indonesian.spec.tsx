import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComingInPhase, ComingInPhaseSection } from '@/components/coming-in-phase';
import { OfficeUnavailable } from '@/components/office-unavailable';
import { NotAvailableToYou } from '@/components/require-session';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { pageFrameMessages } from '@/i18n/messages/page-frame';
import { termMessages } from '@/i18n/messages/terms';
import { uiMessages } from '@/i18n/messages/ui';
import { CONFIRMED } from '@/lib/confirmations';
import { heldBecause } from '@/lib/disabled-reason';
import { termDefinition, termQuestion, TERM_KEYS, TERMS } from '@/lib/terms';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage } from '@test/harness';
import { CascadeRow } from './cascade-row';
import { CopyableValue } from './copyable-value';
import { DateField } from './date-field';
import { Dialog } from './dialog';
import { DragHandle } from './drag-handle';
import { CodeField, ErrorBanner } from './field';
import { InviteQr } from './invite-qr';
import { Pager } from './pager';
import { PasswordInput } from './password-input';
import { ProgressBar } from './progress-bar';
import { ReorderArrows } from './reorder-arrows';
import { RoleBadge } from './role-badge';
import { PageSkeleton, SkeletonPeople, SkeletonTable, SkeletonTree } from './skeleton';
import { StatusPill } from './status-pill';
import { Stepper } from './stepper';
import { TermTip } from './term-tip';
import { errorSentence } from './ui-words';

/**
 * **The shared pieces in Indonesian** (P18.98-T4 AC-1 to AC-4; the shared pieces): every primitive's own words, the page
 * frame's refusal, the page for an office that cannot be used, the sign for a route not built yet, the confirmations,
 * the glossary terms' tips and why a held button waits — the approved glossary's words, each kept term English, what a
 * caller hands a primitive (a row's name, a caption, a server's sentence) as it was handed, and none of the areas'
 * English left. English is every other spec's, unchanged.
 */
const ENGLISH = englishOnly(uiMessages, pageFrameMessages);
const noEnglishLeft = (root: Element = document.body) => expect(englishShown(root, ENGLISH)).toEqual([]);
const id = (ui: React.ReactElement) => render(<InLanguage language="id">{ui}</InLanguage>);

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 the primitives in Indonesian', () => {
  it('AC-1 the fields: Code, Choose a date, Show, Cancel', async () => {
    id(
      <div>
        <CodeField id="code" value="SELL_SUBMISSION" reason="Kode tidak berubah setelah diterbitkan." />
        <label htmlFor="d">Tanggal bergabung</label>
        <DateField id="d" value="" onChange={() => undefined} />
        <label htmlFor="p">Kata sandi</label>
        <PasswordInput id="p" />
        <Dialog open message="Hapus lead ini?" confirmLabel="Hapus" onConfirm={() => undefined} onCancel={() => undefined} />
      </div>,
    );
    expect(screen.getByLabelText('Kode')).toHaveValue('SELL_SUBMISSION');
    expect(screen.getByText('Pilih tanggal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }));
    expect(screen.getByRole('button', { name: 'Sembunyikan kata sandi' })).toHaveTextContent('Sembunyikan');
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the error banner: the browser’s sentences in Indonesian, a server’s as it came, the three outcomes three', () => {
    const { container } = id(
      <div>
        <ErrorBanner code="NETWORK" message={uiMessages.en.errors.network} requestId="unknown" />
        <ErrorBanner code="UNEXPECTED" message={uiMessages.en.errors.unexpected} requestId="unknown" />
        <ErrorBanner code="CONFIG" message="NEXT_PUBLIC_API_ORIGIN is not set." requestId="unknown" />
        <ErrorBanner code="PERM_DENIED" message="Anda tidak memiliki izin untuk melakukan tindakan ini." requestId="r-1" />
      </div>,
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [network, unexpected, config, server] = screen.getAllByRole('alert');
    expect(network).toHaveTextContent('Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.');
    expect(unexpected).toHaveTextContent(/^Terjadi kesalahan di layar ini\./);
    expect(config).toHaveTextContent(
      'Aplikasi ini belum dikonfigurasi dengan benar. Untuk pengembang: NEXT_PUBLIC_API_ORIGIN is not set.',
    );
    expect(server).toHaveTextContent('Anda tidak memiliki izin untuk melakukan tindakan ini.PERM_DENIED · r-1');
    noEnglishLeft(container);
    // English, as before: each sentence as it was composed.
    expect(errorSentence('NETWORK', uiMessages.en.errors.network, 'en')).toBe(
      'Could not reach the server. Check your connection and try again.',
    );
    expect(errorSentence('CONFIG', 'NEXT_PUBLIC_API_ORIGIN is not set.', 'en')).toBe('NEXT_PUBLIC_API_ORIGIN is not set.');
    expect(errorSentence('INTERNAL_ERROR', uiMessages.en.errors.noAnswer, 'id')).toBe('Terjadi kesalahan. Silakan coba lagi.');
  });

  it('AC-1, AC-4 the reorder controls, the stepper and the pager, a row’s name as typed', () => {
    id(
      <ul>
        <li>
          <DragHandle label="Melakukan presentasi" onPick={() => undefined} onDrop={() => undefined} onMove={() => undefined} />
          <ReorderArrows label="Melakukan presentasi" index={1} count={3} onMove={() => undefined} />
          <Stepper value={2} onChange={() => undefined} label="Melakukan presentasi" />
          <Pager label="Halaman" page={2} pages={4} onPage={() => undefined} />
        </li>
      </ul>,
    );
    expect(screen.getByRole('button', {
      name: 'Ubah urutan Melakukan presentasi. Tekan panah atas atau bawah untuk memindahkannya.',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Naikkan Melakukan presentasi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turunkan Melakukan presentasi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kurangi Melakukan presentasi' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Jumlah Melakukan presentasi' })).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Tambah Melakukan presentasi' })).toBeInTheDocument();
    expect(screen.getByText('Halaman 2 dari 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-2 the states: a pill, a bar, the cascade spoken with its stages kept, a role kept', () => {
    id(
      <div>
        <StatusPill status="success" />
        <StatusPill status="alert" />
        <StatusPill status="neutral" />
        <ProgressBar value={3} target={0} />
        <ProgressBar value={3} target={4} showLabel={false} />
        <CascadeRow
          columns={[
            { label: 'Set appointment', icon: 'calendar', month: '40/bulan' },
            { label: 'Sales meeting', icon: 'calendar', month: '20/bulan', hero: true },
          ]}
          links={['50%']}
        />
        <RoleBadge role="AAB" />
      </div>,
    );
    expect(screen.getByText('Sesuai target')).toBeInTheDocument();
    expect(screen.getByText('Di bawah benchmark')).toBeInTheDocument();
    expect(screen.getByText('Data belum cukup')).toBeInTheDocument();
    expect(screen.getByText('Target belum diatur')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '3 dari 4' })).toBeInTheDocument();
    expect(screen.getByText('50% dari Set appointment ke Sales meeting')).toBeInTheDocument();
    expect(screen.getByText('AAB')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the copy button, the QR, and the skeletons’ labels', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    id(
      <div>
        <CopyableValue label="Tautan undangan" value="https://example.test/j/abc" copied={confirmationMessages.id.linkCopied} />
        <InviteQr url="https://example.test/j/abc" />
        <PageSkeleton />
        <SkeletonPeople />
        <SkeletonTree />
        <SkeletonTable caption="Semua orang yang Anda coaching" columns={['Nama']} rows={1} />
        <SkeletonTable caption="KPM Admins" columns={['Nama']} rows={1} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salin' }));
    expect(screen.getByText('Tidak dapat menyalin — pilih teks di atas, lalu salin sendiri.')).toBeInTheDocument();
    const waits = screen.getAllByRole('status').map((s) => s.querySelector(':scope > .sr-only')?.textContent);
    expect(waits).toEqual(expect.arrayContaining([
      'Memuat…', 'Memuat daftar orang…', 'Memuat bagan…', 'Memuat semua orang yang Anda coaching…', 'Memuat KPM Admins…',
    ]));
    noEnglishLeft();
  });
});

describe('P18.98-T4 the page frame in Indonesian', () => {
  it('AC-1 the refusal names no permission code, in Indonesian', () => {
    id(<NotAvailableToYou permission="kpm_analytics:read" />);
    const refusal = screen.getByRole('alert');
    expect(within(refusal).getByRole('heading', { name: 'Tidak tersedia untuk Anda' })).toBeInTheDocument();
    expect(refusal).toHaveTextContent('Akun Anda tidak memiliki akses ke layar ini.');
    noEnglishLeft();
  });

  it('AC-1, AC-4 the office that cannot be used: KPM for office, its date in Indonesian, the server’s sentence as sent', () => {
    const { rerender } = id(
      <OfficeUnavailable
        error={{ code: 'TENANT_SUBSCRIPTION_ENDED', message: 'x', details: { kpmCode: '0417', branch: 'BSD City Branch', endDate: '2026-10-01' }, requestId: 'r' }}
        onSignOut={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Langganan KPM Anda telah berakhir' })).toBeInTheDocument();
    expect(screen.getByText('KPM 0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText(/^Langganannya berakhir pada 1 Okt 2026\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    noEnglishLeft();

    rerender(
      <InLanguage language="id">
        <OfficeUnavailable
          error={{ code: 'TENANT_SUSPENDED', message: 'KPM ini ditangguhkan. Hubungi KPM Owner Anda.', requestId: 'r' }}
          onSignOut={() => undefined}
          onEndSupportSession={() => undefined}
        />
      </InLanguage>,
    );
    expect(screen.getByRole('heading', { name: 'KPM ini ditangguhkan' })).toBeInTheDocument();
    expect(screen.getByText('KPM ini ditangguhkan. Hubungi KPM Owner Anda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Akhiri sesi dukungan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 the sign for a route not built yet: the pill and its lines, the caller’s words as handed', () => {
    id(
      <div>
        <ComingInPhase what="Di sini Anda akan melihat analitik lanjutan." elsewhere={[{ href: '/kpm/overview', label: 'Overview', detail: 'Ringkasan KPM Anda.' }]} />
        <ComingInPhaseSection title="Campaigns" what="Campaign yang sedang Anda kejar." />
      </div>,
    );
    expect(screen.getAllByText('Segera hadir')).toHaveLength(2);
    expect(screen.getByText('Belum ada yang ditampilkan di sini — bukan versi kosongnya, dan bukan contoh.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yang dapat Anda lakukan sekarang' })).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 the words read outside a screen, in both languages', () => {
  it('AC-1 the confirmations: English as CONFIRMED was, Indonesian §B.2’s, Goal and Agent kept', () => {
    expect(CONFIRMED).toBe(confirmationMessages.en);
    expect(CONFIRMED.activityLogged).toBe('Activity logged ✓');
    expect(confirmationMessages.id.activityLogged).toBe('Aktivitas tercatat ✓');
    expect(confirmationMessages.id.goalSaved).toBe('Goal tersimpan ✓');
    expect(confirmationMessages.id.agentAdded).toBe('Agent ditambahkan ✓');
    expect(confirmationMessages.id.transferRequested).toBe('Pemindahan diajukan ✓');
  });

  it('AC-3 why a button is held, each language its own “and”', () => {
    expect(heldBecause({ missing: ['Nama lengkap', 'Jenis kelamin', 'Email'] }, 'id'))
      .toBe('Masih diperlukan: Nama lengkap, Jenis kelamin dan Email.');
    expect(heldBecause({ missing: ['Full name', 'Email'] })).toBe('Still needed: Full name and Email.');
    expect(heldBecause({ missing: [], fix: 'Perbaiki kolom yang ditandai di atas.' }, 'id')).toBe('Perbaiki kolom yang ditandai di atas.');
  });

  it('AC-2 the terms’ tips: a kept name stays, its line moves; English as TERMS holds it', () => {
    for (const key of TERM_KEYS) {
      expect(termQuestion(key)).toBe(`What is ${TERMS[key].name}?`);
      expect(termDefinition(key)).toBe(TERMS[key].definition);
      expect(termDefinition(key, 'id')).not.toBe(TERMS[key].definition);
    }
    expect(termQuestion('APE', 'id')).toBe('Apa itu APE?');
    expect(termQuestion('TOUCHES', 'id')).toBe('Apa itu sentuhan?');
    expect(termQuestion('CHAIRMANS_CLUB', 'id')).toBe('Apa itu Chairman’s Club?');
    expect(termMessages.id.MOC.definition).toMatch(/^Maintenance of Contract: /);
  });

  it('AC-1 the ⓘ is named and explained in Indonesian', async () => {
    id(<TermTip term="MDRT" />);
    const tip = screen.getByRole('button', { name: 'Apa itu MDRT?' });
    await userEvent.click(tip);
    expect(screen.getByText(/^Million Dollar Round Table: klub internasional/)).toBeInTheDocument();
  });
});
