import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChasingCampaigns, ChaseChips } from '@/components/campaigns/chasing-card';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  APE, CHALLENGE, detail, LIST, NEW_HIRE, NONE_CHASED, PERSISTENCY, RINA_CHASING, RINA_ME, SHELL_STUBS,
} from '@test/campaigns-fixtures';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import {
  chasedToast, kindLabel, progressWords, requirementsLine, requirementWords, seasonalSections, statusWords, structuralSections,
  unchasedToast,
} from '@/lib/campaigns';
import CampaignsLayout from './layout';
import CampaignsPage from './page';
import CampaignDialogPage from './[campaignCode]/page';

/**
 * **The agents' *Campaign List* in Indonesian** (P18.98-T4 AC-1 to AC-4, events, campaigns and the calendar): the tabs
 * and the filter, the five sections, a card — its tags, *Promotion path*, the prize, *Syarat:* and each requirement in
 * words — the dialog with its progress, the chase and its toast, and what a person is chasing. The approved glossary's
 * words, each kept term English (§A: the title, *KPM*, *campaign*, *APE*, *new hire*, a metric's name), what the office
 * typed and what the server composed as they came, and none of the module's English left. English is `page.spec.tsx`'s.
 */
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/campaigns' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const ENGLISH = englishOnly(campaignsMessages, campaignChasingMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

function list(routes: Routes = {}) {
  nav.pathname = '/campaigns';
  stubFetch({ ...SHELL_STUBS, 'GET /campaigns': { body: LIST }, ...routes });
  renderInIndonesian(<CampaignsLayout><CampaignsPage /></CampaignsLayout>, { me: RINA_ME });
}

function dialogAt(code: string, routes: Routes = {}) {
  nav.pathname = `/campaigns/${code}`;
  stubFetch({ ...SHELL_STUBS, 'GET /campaigns': { body: LIST }, [`GET /campaigns/${code}`]: { body: detail() }, ...routes });
  renderInIndonesian(<CampaignsLayout><CampaignDialogPage params={routeParams({ campaignCode: code })} /></CampaignsLayout>, { me: RINA_ME });
}

const cardOf = (title: string) => screen.getByRole('article', { name: title });

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 the Campaign List in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same list in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(40);
    nav.pathname = '/campaigns';
    stubFetch({ ...SHELL_STUBS, 'GET /campaigns': { body: LIST } });
    renderWithSession(<CampaignsLayout><CampaignsPage /></CampaignsLayout>, { me: RINA_ME });
    await screen.findByRole('region', { name: 'Running' });
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['Seasonal', 'View details', 'Needs:']));
  });

  it('P18.98-T4 AC-1 to AC-4 the seasonal view: tabs, filter, sections, a card’s tags, prize and Syarat:', async () => {
    list();
    await screen.findByRole('region', { name: 'Berjalan' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Campaign List$/);
    expect(screen.getByText('Campaign perusahaan dan KPM — tandai yang Anda kejar, ketuk kartu mana pun untuk melihat syarat lengkapnya.'))
      .toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Jenis campaign' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Musiman', 'Struktural']);
    const filter = screen.getByRole('group', { name: 'Tampilkan campaign' });
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua', 'Berjalan', 'Akan datang', 'Berakhir']);
    for (const name of ['Berjalan', 'Akan datang', 'Berakhir']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    const sprint = cardOf('Q4 APE Sprint');
    expect(within(sprint).getByText('KPM')).toBeInTheDocument();
    // The server's window and the office's prize as they came; the requirement in Indonesian, its figure Indonesian.
    expect(within(sprint).getByText('1 Okt – 31 Des 2026')).toBeInTheDocument();
    expect(sprint).toHaveTextContent('Top 10 unit-wide: 3D2N Bali trip · All qualifiers: Rp 5.000.000 cash bonus');
    expect(sprint).toHaveTextContent(/Syarat: Rp 500 jt APE.* \+ 1 new hire/);
    expect(within(sprint).getByRole('button', { name: /Mengejar/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sprint).getByRole('button', { name: 'Lihat detail' })).toBeInTheDocument();
    expect(within(cardOf('October New Hire Blitz')).getByRole('button', { name: /Kejar/ })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the structural view: Kriteria promosi, Klub produksi, Jalur promosi, a held chase’s reason', async () => {
    list();
    await screen.findByRole('region', { name: 'Berjalan' });
    await userEvent.click(screen.getByRole('tab', { name: 'Struktural' }));
    for (const name of ['Kriteria promosi', 'Klub produksi']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    const promo = cardOf('Promotion: Agent → AAB');
    expect(within(promo).getByText('Jalur promosi')).toBeInTheDocument();
    expect(within(promo).getByText('Berjalan')).toBeInTheDocument();
    expect(promo).toHaveTextContent(/Rp 1,2 M APE.* \+ 3 agen aktif baru/);
    expect(within(cardOf('Promotion: AAB → AB')).getByRole('button', { name: 'Campaign ini tidak terbuka untuk peran Anda.' }))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a chase: its toast in Indonesian, the title as typed', async () => {
    list({ 'PUT /campaigns/NEW_HIRE_BLITZ/chase': { body: { ...LIST.campaigns[1], chasing: true } } });
    await screen.findByRole('region', { name: 'Berjalan' });
    await userEvent.click(within(cardOf('October New Hire Blitz')).getByRole('button', { name: /Kejar/ }));
    expect(await screen.findByText('Sekarang mengejar "October New Hire Blitz"')).toBeInTheDocument();
  });

  it('P18.98-T4 AC-1 the empty sections, in Indonesian', async () => {
    list({ 'GET /campaigns': { body: { campaigns: [], can: { chase: true } } } });
    expect(await screen.findByText('Belum ada campaign yang berjalan saat ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada campaign yang akan datang.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada campaign yang sudah berakhir.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 a campaign’s dialog in Indonesian', () => {
  it('P18.98-T4 AC-1 to AC-4 the dialog: Hadiah, Syarat with the months read, progress and why a row has no figure', async () => {
    dialogAt('APE_SPRINT');
    const box = await screen.findByRole('dialog', { name: 'Q4 APE Sprint' });
    expect(within(box).getByText('Hadiah')).toBeInTheDocument();
    expect(within(box).getByRole('heading', { level: 3 })).toHaveTextContent('SyaratOkt – Des 2026');
    const rows = within(box).getAllByRole('listitem').map((r) => r.textContent);
    // The metric's name as served (§A.4), the figures Indonesian, *dari* between them, *terpenuhi* read after the ✓.
    expect(rows).toEqual(['APE achievedRp 620 jt dari Rp 500 jt ✓, terpenuhi', 'New Hire1Belum diunggah']);
    expect(within(box).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    expect(within(box).getByText(/Office-wide APE sprint for Q4\./)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the not-found state, in Indonesian', async () => {
    dialogAt('NOPE', { 'GET /campaigns/NOPE': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'x', requestId: 'r' } } } });
    expect(await screen.findByText('Campaign ini tidak ada di daftar Anda.')).toBeInTheDocument();
    expect(screen.getByText('Mungkin sudah ditarik, atau alamatnya salah ketik.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 what a person is chasing, in Indonesian', () => {
  it('P18.98-T4 AC-1 the reader’s own rows, the server’s months as they came, and Lihat →', async () => {
    stubFetch({ '/campaigns/chasing': { body: RINA_CHASING } });
    renderInIndonesian(<ChasingCampaigns />, { me: RINA_ME });
    expect(await screen.findByText('Q4 APE Sprint')).toBeInTheDocument();
    expect(screen.getByText('Runs Okt – Des 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Lihat →')).toHaveLength(2);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 none chased: the reader’s line, and a coachee’s', async () => {
    stubFetch({ '/campaigns/chasing': { body: NONE_CHASED } });
    renderInIndonesian(<><ChasingCampaigns /><ChasingCampaigns forMembershipId="mem-budi" /></>, { me: RINA_ME });
    expect(await screen.findByText('Anda belum mengejar campaign apa pun — buka Campaign list untuk ikut.')).toBeInTheDocument();
    expect(await screen.findByText('Saat ini tidak mengejar campaign apa pun.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-4 the chips are the titles, as typed', () => {
    renderInIndonesian(<ChaseChips campaigns={[{ code: 'A', title: 'Q4 APE Sprint' }]} />);
    expect(screen.getByText('Q4 APE Sprint')).toBeInTheDocument();
  });
});

describe('P18.98-T4 lib/campaigns.ts in each language', () => {
  it('writes its words in the language passed and its figures in the figures’, English and Indonesian when none is', () => {
    expect(requirementsLine([APE(16), NEW_HIRE(3)], undefined, 'id')).toBe('Rp 16 jt APE + 3 new hires');
    expect(requirementsLine([APE(16), NEW_HIRE(3)], undefined, 'en', 'en')).toBe('IDR 16M APE + 3 new hires');
    expect(requirementWords({ ...APE(500), comparator: 'lte' }, undefined, 'id')).toBe('maksimal Rp 500 jt APE');
    expect(requirementWords({ ...NEW_HIRE(1), comparator: 'gt' }, undefined, 'id')).toBe('lebih dari 1 new hire');
    expect(requirementWords(PERSISTENCY, undefined, 'id')).toBe('90% Rolling persistency');
    expect(requirementWords({ ...APE(600), metricKey: 'NET_APE', metricName: 'Net APE' }, undefined, 'id', 'en')).toBe('Net APE IDR 600M');
    const row = { metricKey: 'APE_ACHIEVED', current: APE(620).value, target: APE(500).value, unit: 'idr_minor', state: 'met' as const };
    expect(progressWords(row, undefined, 'id')?.text).toBe('Rp 620 jt dari Rp 500 jt');
    expect(progressWords({ ...row, state: 'nothing_logged' }, undefined, 'id')?.text).toBe('Belum ada yang tercatat');
    expect(seasonalSections(LIST.campaigns, 'all', 'id').map((s) => s.heading)).toEqual(['Berjalan', 'Akan datang', 'Berakhir']);
    expect(structuralSections(LIST.campaigns, 'id').map((s) => s.heading)).toEqual(['Kriteria promosi', 'Klub produksi']);
    expect([statusWords(CHALLENGE, 'id'), kindLabel({ kind: 'structural', subtype: 'promotion', phase: 'running' }, 'id')])
      .toEqual(['Akan datang', 'Jalur promosi']);
    expect([chasedToast('X', 'id'), unchasedToast('X', 'id')]).toEqual(['Sekarang mengejar "X"', '"X" dihapus dari daftar kejaran Anda']);
  });
});
