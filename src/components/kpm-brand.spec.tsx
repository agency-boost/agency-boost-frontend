import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import type { Me, SessionBranding } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { Boost } from './boost';
import { Page } from './page';
import { LinkBranding } from './branding/link-branding';

const params = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/goals',
  useSearchParams: () => new URLSearchParams(params.search),
}));

const KPM = '66f0000000000000000005a5';
const BRANDED: SessionBranding = {
  kpmId: KPM, version: 'abc123def456', palette: null, logo: { width: 480, height: 96 }, logoSquare: true, icons: true,
  mascotPoses: ['default', 'thinking'], lesson: null,
};

function member(branding: SessionBranding | null): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: KPM, orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, office: { code: '0555', branch: 'Kelapa Gading Branch' },
    },
    branding,
  } as Partial<Me>);
}

const shell = (me: Me) => renderWithSession(
  <AgentShell><Page title="Goal Setting"><p>content</p></Page></AgentShell>, { me },
);

afterEach(() => {
  vi.unstubAllGlobals();
  params.search = '';
  document.documentElement.removeAttribute('style');
});

describe('P19.6-T1 the branded shell (ADR-0218 §2, §11)', () => {
  it('B7-AC1 P19.6-T1 AC-3 draws the KPM’s logo in place of AgencyBoost’s mark and wordmark, 32px high, its name its office', () => {
    atWidth(1280);
    shell(member(BRANDED));
    const logo = screen.getByRole('img', { name: 'Kelapa Gading Branch' });
    expect(logo).toHaveAttribute('src', expect.stringContaining(`/kpm-branding/${KPM}/files/logo.png?v=abc123def456`));
    expect(logo).toHaveAttribute('height', '32');
    expect(logo).toHaveAttribute('width', '160');
    // The brand row holds the logo alone: no mark, no wordmark.
    expect(logo.parentElement!.textContent).not.toContain('AgencyBoost');
    expect(logo.parentElement!.querySelector('svg circle')).toBeNull();
  });

  it('P19.6-T1 AC-4 the collapsed 64px rail draws the square logo', () => {
    atWidth(1100);
    shell(member(BRANDED));
    const logo = document.querySelector('[data-kpm-logo]')!;
    expect(logo.getAttribute('src')).toContain('/files/logo-square.png');
  });

  it('P19.6-T1 AC-14 says “Powered by AgencyBoost” at the foot of the sidebar and of Lainnya under a KPM’s logo', async () => {
    atWidth(1280);
    const wide = shell(member(BRANDED));
    expect(document.querySelector('aside [data-powered-by]')).toHaveTextContent('Powered by AgencyBoost');
    wide.unmount();
    atWidth(375);
    shell(member(BRANDED));
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect((await screen.findByRole('dialog', { name: 'More' })).querySelector('[data-powered-by]')).toHaveTextContent('Powered by AgencyBoost');
  });

  it('P19.6-T1 AC-1, AC-11 with no branding the shell adds nothing: AgencyBoost’s mark and wordmark, no Powered by', () => {
    atWidth(1280);
    shell(member(null));
    expect(document.querySelector('[data-kpm-logo]')).toBeNull();
    expect(document.querySelector('[data-powered-by]')).toBeNull();
    expect(document.querySelector('aside')).toHaveTextContent('AgencyBoost');
  });

  it('P19.6-T1 AC-6 the KPM’s mascot replaces Boost, its pose where it has one, else its default', () => {
    renderWithSession(<><Boost pose="thinking" size={64} /><Boost pose="phone" size={64} /></>, { me: member(BRANDED) });
    const [thinking, phone] = Array.from(document.querySelectorAll('img[data-kpm-mascot]'));
    expect(thinking.getAttribute('src')).toContain('/files/mascot-thinking-240.webp?v=abc123def456');
    expect(phone.getAttribute('src')).toContain('/files/mascot-default-240.webp');
    expect(thinking.getAttribute('srcset')).toContain('mascot-thinking-360.webp?v=abc123def456 360w');
  });

  it('P19.6-T1 AC-6 without a mascot, Boost', () => {
    renderWithSession(<Boost pose="thinking" />, { me: member({ ...BRANDED, mascotPoses: [] }) });
    expect(document.querySelector('img[data-boost]')!.getAttribute('src')).toBe('/brand/boost-thinking.png');
  });
});

describe('P19.6-T1 AC-13 the sign-in, registration and invitation pages take the link’s KPM (ADR-0218 §9)', () => {
  const PALETTE = { primary: '#0a6e5c', secondary: '#1b2b4b' };

  it('P19.6-T1 AC-13 ?kpm=<id> shows the KPM’s logo and sets its colours while the page is open', async () => {
    params.search = `kpm=${KPM}`;
    stubFetch({ [`/kpm-branding/${KPM}`]: { body: { name: 'Kelapa Gading Branch', version: 'abc123def456', palette: PALETTE, logo: { width: 480, height: 96 } } } });
    const page = renderWithSession(<LinkBranding />, { me: null });
    expect(await screen.findByRole('img', { name: 'Kelapa Gading Branch' })).toHaveAttribute('src', expect.stringContaining('/files/logo.png?v=abc123def456'));
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#0a6e5c');
    page.unmount();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });

  it('P19.6-T1 AC-13 ?invite=… takes the invitation’s KPM', async () => {
    params.search = 'invite=tok.en';
    stubFetch({ '/invites/tok.en': { body: { leaderName: 'Agus', branding: { kpmId: KPM, name: 'KPM 0555', version: 'v1', palette: PALETTE, logo: { width: 200, height: 40 } } } } });
    renderWithSession(<LinkBranding />, { me: null });
    expect(await screen.findByRole('img', { name: 'KPM 0555' })).toBeInTheDocument();
  });

  it('P19.6-T1 AC-13 a link without the KPM, or with a code, shows AgencyBoost’s and asks nothing', () => {
    params.search = 'kpm=0417';
    const calls = stubFetch({});
    renderWithSession(<LinkBranding />, { me: null });
    expect(document.querySelector('[data-link-branding]')).toBeNull();
    expect(calls.calls).toHaveLength(0);
  });
});
