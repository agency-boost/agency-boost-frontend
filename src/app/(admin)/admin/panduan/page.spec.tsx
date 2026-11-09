import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage, atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { adminPanduanMessages } from '@/i18n/messages/admin-panduan';
import { saveFile } from '@/lib/save-file';
import type { Me } from '@/lib/session';
import SuperAdminGuidePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/panduan',
  useSearchParams: () => new URLSearchParams(),
}));
const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@/lib/save-file', () => ({ saveFile: vi.fn() }));

/**
 * **P19.6-T5 AC-4 — `/admin/panduan`, the Super Admin's guide** (ADR-0219 §4; Panduan-AC3): read with the session from
 * `GET /admin/panduan` and drawn, as delivered, in `<iframe sandbox="allow-scripts allow-modals" srcdoc>`; its *PDF*
 * control saves `GET /admin/panduan/pdf`. Without the grant the page asks the API for nothing; the API refuses the rest
 * (`platform-guide.int.spec.ts`). In Indonesian, read for English left (P18.10-T7).
 */
const GUIDE = '<!doctype html><html lang="id"><head><title>stand-in</title></head><body><h1>Isi panduan</h1><script>1</script></body></html>';
const PDF = new Blob(['%PDF-1.7 stand-in'], { type: 'application/pdf' });

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  // `kpm:list_all` is the platform layout's gate; `platform_guide:read` the page's.
  permissions: ['kpm:list_all', 'platform_guide:read'],
});

function mount(me: Me = SUPER_ADMIN, routes: Parameters<typeof stubFetch>[0] = {}, language: 'en' | 'id' = 'en') {
  const stub = stubFetch({
    '/admin/panduan/pdf': { body: PDF },
    '/admin/panduan': { body: new Blob([GUIDE], { type: 'text/html' }) },
    ...routes,
  });
  const view = renderWithSession(
    <InLanguage language={language}><AdminLayout><SuperAdminGuidePage /></AdminLayout></InLanguage>,
    { me },
  );
  return { stub, ...view };
}

const guideCalls = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((c) => c.url.includes('/admin/panduan'));

beforeEach(() => {
  atWidth(1280);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(saveFile).mockClear();
  nav.replace.mockClear();
});

describe('P19.6-T5 AC-4 /admin/panduan', () => {
  it('Panduan-AC3 P19.6-T5 AC-4 draws the guide as the API answered it, in the sandboxed srcdoc frame, titled', async () => {
    const { stub } = mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Super Admin guide' })).toBeInTheDocument();
    const frame = await screen.findByTitle('Super Admin guide');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('srcdoc', GUIDE);
    // Exactly the ADR's tokens: the scripts run and *Simpan PDF / Cetak* prints; nothing else.
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-modals');
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/);
    expect(frame).toHaveAttribute('allow', '');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame).not.toHaveAttribute('src');
    // Read once, with the session: through the API client, never a link.
    const reads = guideCalls(stub);
    expect(reads.map((c) => new URL(c.url).pathname)).toEqual(['/api/v1/admin/panduan']);
    // No link to the API's address anywhere: the token is in memory, and a link would carry none.
    expect(document.querySelector('a[href*="/api/"]')).toBeNull();
  });

  it('Panduan-AC3 P19.6-T5 AC-4 the PDF control saves the guide’s PDF under its name, and says so while it does', async () => {
    const { stub } = mount();
    await screen.findByTitle('Super Admin guide');
    const pdf = screen.getByRole('button', { name: 'Save the guide as a PDF' });
    expect(pdf).toHaveTextContent('PDF');
    await userEvent.click(pdf);
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(PDF, 'panduan-super-admin.pdf'));
    expect(guideCalls(stub).map((c) => new URL(c.url).pathname)).toContain('/api/v1/admin/panduan/pdf');
    expect(pdf).not.toBeDisabled();
  });

  it('P19.6-T5 AC-4 a PDF the API refuses is said, and the guide stays on screen', async () => {
    mount(SUPER_ADMIN, {
      '/admin/panduan/pdf': { status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission for this action.' } } },
    });
    await screen.findByTitle('Super Admin guide');
    await userEvent.click(screen.getByRole('button', { name: 'Save the guide as a PDF' }));
    expect(await screen.findByText(/You do not have permission/)).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    expect(screen.getByTitle('Super Admin guide')).toBeInTheDocument();
  });

  it('P19.6-T5 AC-4 while the guide is read: a wait shaped like the frame, said to a screen reader', async () => {
    let answer!: (v: unknown) => void;
    // The guide's read waits; the shell's own reads are not this spec's.
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('/admin/panduan')
      ? new Promise((resolve) => { answer = resolve; })
      : Promise.reject(new TypeError('not stubbed')))));
    renderWithSession(<AdminLayout><SuperAdminGuidePage /></AdminLayout>, { me: SUPER_ADMIN });
    expect(screen.getByRole('status')).toHaveTextContent('Opening the guide…');
    expect(screen.queryByTitle('Super Admin guide')).toBeNull();
    answer({ ok: true, status: 200, blob: async () => new Blob([GUIDE]) });
    expect(await screen.findByTitle('Super Admin guide')).toHaveAttribute('srcdoc', GUIDE);
  });

  it('P19.6-T5 AC-4 a guide that cannot be read says why, with Try again, and no frame', async () => {
    mount(SUPER_ADMIN, { '/admin/panduan': [{ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' } } }, { body: new Blob([GUIDE]) }] });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.queryByTitle('Super Admin guide')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTitle('Super Admin guide')).toHaveAttribute('srcdoc', GUIDE);
  });

  it('Panduan-AC3 P19.6-T5 AC-4 a Super Admin without the grant gets the permission-denied state and asks for nothing', async () => {
    const { stub } = mount({ ...SUPER_ADMIN, permissions: ['kpm:list_all'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'platform_guide:read');
    expect(screen.queryByTitle('Super Admin guide')).toBeNull();
    expect(guideCalls(stub)).toEqual([]);
  });

  it.each([
    ['the KPM Owner', makeMe({ membership: { ...makeMe().membership!, isKpmOwner: true, hierarchyRole: 'ab', orgLevelCode: 'AB' }, permissions: ['member:read_profile'] })],
    ['an Agent', makeMe()],
    ['a view-as session as an Agent', makeMe({ isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' })],
  ])('Panduan-AC3 P19.6-T5 AC-4 %s is sent to their own landing, and nothing of the guide is read', async (_who, me) => {
    const { stub } = mount(me);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/home'));
    expect(screen.queryByTitle('Super Admin guide')).toBeNull();
    expect(guideCalls(stub)).toEqual([]);
  });

  it('P19.6-T5 AC-4 passes axe with the guide drawn', async () => {
    const { container } = mount();
    await screen.findByTitle('Super Admin guide');
    // The page around the frame: the guide inside it is the owner's file, which axe cannot enter in jsdom.
    expect((await axe(container, { iframes: false, rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});

describe('P19.6-T5 /admin/panduan in Indonesian', () => {
  const ENGLISH = englishOnly(adminPanduanMessages);

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Super Admin guide', 'Save the guide as a PDF']));
  });

  it('Panduan-AC5 P19.6-T5 AC-7 the page in Bahasa: its title, the frame’s name and the control, no English left', async () => {
    mount(SUPER_ADMIN, {}, 'id');
    expect(await screen.findByTitle('Panduan Super Admin')).toHaveAttribute('srcdoc', GUIDE);
    expect(screen.getByRole('heading', { level: 1, name: 'Panduan Super Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan panduan sebagai PDF' })).toHaveTextContent('PDF');
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });
});
