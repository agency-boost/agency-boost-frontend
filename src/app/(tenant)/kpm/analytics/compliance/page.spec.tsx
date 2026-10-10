import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import { ADMIN_ME, OWNER_ME, SHELL_STUBS } from '@test/kpm-analytics-fixtures';
import KpmAnalyticsLayout from '../layout';
import KpmAnalyticsCompliancePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/analytics/compliance',
}));

const open = (me = OWNER_ME) => {
  const stub = stubFetch(SHELL_STUBS);
  renderInLayout(TenantLayout, <KpmAnalyticsLayout><KpmAnalyticsCompliancePage /></KpmAnalyticsLayout>, { me });
  return stub;
};

const main = () => screen.getByRole('main');

/**
 * *Compliance, Events, and Campaigns* (P18-T2 AC-1, contradiction 23): a sign until training, events and
 * campaigns are built — what will be here in the reader's words, no figure, no call, and two screens
 * that work today — under the page's own title and tabs.
 */
describe('KPM analytics › Compliance, Events, and Campaigns (P18-T2 AC-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the page’s title and tabs, this one current', () => {
    open();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^KPM Analytics$/);
    const tabs = within(screen.getByRole('navigation', { name: 'KPM Analytics' }));
    expect(tabs.getByRole('link', { name: 'Compliance, Events, and Campaigns' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('says it is upcoming and what will be here, naming no phase and showing no figure', () => {
    open();
    expect(within(main()).getByText('Upcoming')).toBeInTheDocument();
    expect(within(main()).getByText(/training module.*event.*campaign/)).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/phase/i);
    expect(main().textContent).not.toMatch(/\d/);
    expect(within(main()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('links to the Overview and to All members, which work today', () => {
    open();
    const links = within(main()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual(expect.arrayContaining([
      ['Overview', '/kpm/analytics'],
      ['All members', '/people/members'],
    ]));
  });

  it('asks the API for nothing of its own', () => {
    const { calls } = open();
    expect(calls.filter((c) => /analytics|training|events|campaigns/.test(c.url))).toEqual([]);
  });

  it('imports only what a sign may, so the gates count it a placeholder (scripts/lib/screens.py)', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])).toEqual(['@/components/coming-in-phase']);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('is the Admin’s too, and nobody else’s', () => {
    open(ADMIN_ME);
    expect(within(main()).getByText('Upcoming')).toBeInTheDocument();
  });

  it('refuses a session without the permission', () => {
    open(makeMe({ permissions: ['member:read_profile'] }));
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_analytics:read');
  });
});
