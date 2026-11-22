import { screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian } from '@test/harness';
import type { FieldChrome } from '@/components/field-chrome';
import { MoreSheet } from './field-more-sheet';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

const chrome = (name: string): FieldChrome => ({
  nav: { groups: [] } as unknown as FieldChrome['nav'],
  account: { name, role: 'Super Admin', initials: 'PO', profileHref: '/profile', onSignOut: () => undefined },
});

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all'],
});

/**
 * **P19.26-T6 AC-1 (UI-218 (21 Nov)): the Super Admin's *Lainnya* on a phone** — the name is never cut, and *ID | EN*
 * has its own row. jsdom applies no media query, so the phone is its classes; every other reader keeps the one row.
 */
describe('the Lainnya sheet’s account row (P19.26-T6 AC-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets the Super Admin’s name wrap on a phone, and gives ID | EN its own row there', () => {
    atWidth(375);
    renderInIndonesian(<MoreSheet chrome={chrome('Platform Operator')} onClose={() => undefined} returnTo={createRef()} />, { me: SUPER_ADMIN });
    const name = document.querySelector('[data-account-name]') as HTMLElement;
    expect(name).toHaveTextContent('Platform Operator');
    expect(name).toHaveClass('max-md:whitespace-normal', 'max-md:overflow-visible');
    // One switch, its box a full row of its own below 768px; `contents` from 768px, so the tablet's row is as before.
    expect(document.querySelector('[data-language-row]')).toHaveClass('contents', 'max-md:basis-full', 'max-md:flex');
    expect(document.querySelectorAll('[data-language-switch]').length).toBeLessThanOrEqual(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('leaves every other reader’s row as it was', () => {
    atWidth(375);
    renderInIndonesian(<MoreSheet chrome={chrome('Wilson Tanoto')} onClose={() => undefined} returnTo={createRef()} />, { me: makeMe() });
    expect(screen.getByText('Wilson Tanoto')).not.toHaveClass('max-md:whitespace-normal');
    // Not even an attribute or a wrapper more: their sheet's markup is the one P19.2-T1 AC-2 pins.
    expect(document.querySelector('[data-account-name]')).toBeNull();
    expect(document.querySelector('[data-language-row]')).toBeNull();
  });
});
