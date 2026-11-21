import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { defineMessages } from '@/i18n/catalogue';
import { useMessages } from '@/i18n/language-provider';
import { currentSystemName, setSystemName } from '@/i18n/system-name';
import { applySessionBranding, clearBranding } from '@/lib/branding';
import type { Me, SessionBranding } from '@/lib/session';
import { AgentShell } from '../agent-shell';
import { Page } from '../page';
import { LinkBranding } from './link-branding';

const params = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/goals',
  useSearchParams: () => new URLSearchParams(params.search),
}));

const KPM = '66f0000000000000000005a5';
const NAMED = {
  kpmId: KPM, version: 'abc123def456', palette: null, logo: null, logoSquare: false, icons: false, mascotPoses: [],
  lesson: null, systemName: 'Dynamic Smart System',
} as SessionBranding & { systemName: string };

const area = defineMessages({
  en: { welcome: 'Welcome to AgencyBoost', count: (o: { n: number }) => `${o.n} people use AgencyBoost` },
  id: { welcome: 'Selamat datang di AgencyBoost', count: (o) => `${o.n} orang memakai AgencyBoost` },
});

function Words() {
  const t = useMessages(area);
  return <p>{t.welcome} · {t.count({ n: 30 })}</p>;
}

const member = (): Me => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: KPM, orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0, office: { code: '0555', branch: 'Kelapa Gading Branch' },
  },
} as Partial<Me>);

afterEach(() => {
  act(() => setSystemName(null));
  vi.unstubAllGlobals();
  params.search = '';
  document.documentElement.removeAttribute('style');
});

describe('P19.21-T4 AC-1 the KPM’s Nama sistem across its app (ADR-0274)', () => {
  it('P19.21-T4 AC-1 a message resolved through useMessages says the KPM’s name, and AgencyBoost again when it is cleared', () => {
    render(<Words />);
    expect(screen.getByText('Welcome to AgencyBoost · 30 people use AgencyBoost')).toBeInTheDocument();
    act(() => setSystemName('Dynamic Smart System'));
    expect(screen.getByText('Welcome to Dynamic Smart System · 30 people use Dynamic Smart System')).toBeInTheDocument();
    act(() => setSystemName(null));
    expect(screen.getByText('Welcome to AgencyBoost · 30 people use AgencyBoost')).toBeInTheDocument();
  });

  it('P19.21-T4 AC-1 the session’s branding sets the name; signing out clears it', () => {
    act(() => applySessionBranding(NAMED));
    expect(currentSystemName()).toBe('Dynamic Smart System');
    act(() => applySessionBranding({ ...NAMED, systemName: null }));
    expect(currentSystemName()).toBeNull();
    act(() => applySessionBranding(NAMED));
    act(() => clearBranding());
    expect(currentSystemName()).toBeNull();
    // A session with no KPM — the Super Admin's own — is AgencyBoost.
    act(() => applySessionBranding(null));
    expect(currentSystemName()).toBeNull();
  });

  it('P19.21-T4 AC-1 the sidebar’s wordmark is the name, written whole, in place of Agency·Boost', () => {
    atWidth(1280);
    act(() => setSystemName('Dynamic Smart System'));
    renderWithSession(<AgentShell><Page title="Goal Setting"><p>content</p></Page></AgentShell>, { me: member() });
    const mark = document.querySelector('aside [data-system-name]');
    expect(mark).toHaveTextContent('Dynamic Smart System');
    expect(mark).toHaveAttribute('title', 'Dynamic Smart System');
    expect(document.querySelector('aside [data-branch-name]')).toHaveTextContent('Kelapa Gading Branch');
  });

  it('P19.21-T4 AC-1 with no name the wordmark is AgencyBoost’s, as before', () => {
    atWidth(1280);
    renderWithSession(<AgentShell><Page title="Goal Setting"><p>content</p></Page></AgentShell>, { me: member() });
    expect(document.querySelector('[data-system-name]')).toBeNull();
    expect(document.querySelector('aside')).toHaveTextContent('AgencyBoost');
  });

  it('P19.21-T4 AC-1 a KPM’s sign-in link calls the app by its name while the page is open', async () => {
    params.search = `kpm=${KPM}`;
    stubFetch({
      [`/kpm-branding/${KPM}`]: {
        body: { name: 'Kelapa Gading Branch', version: 'abc123def456', palette: null, logo: { width: 480, height: 96 }, systemName: 'Dynamic Smart System' },
      },
    });
    const page = renderWithSession(<><LinkBranding /><Words /></>, { me: null });
    expect(await screen.findByText('Welcome to Dynamic Smart System · 30 people use Dynamic Smart System')).toBeInTheDocument();
    page.unmount();
    expect(currentSystemName()).toBeNull();
  });

  it('P19.21-T4 AC-1 a link’s page leaving does not clear a name the session set meanwhile', async () => {
    params.search = `kpm=${KPM}`;
    stubFetch({
      [`/kpm-branding/${KPM}`]: { body: { name: 'Kelapa Gading Branch', version: 'v', palette: null, logo: null, systemName: 'Dynamic Smart System' } },
    });
    const page = renderWithSession(<><LinkBranding /><Words /></>, { me: null });
    await screen.findByText(/Dynamic Smart System/);
    act(() => setSystemName('Serpong Smart'));
    page.unmount();
    expect(currentSystemName()).toBe('Serpong Smart');
  });
});
