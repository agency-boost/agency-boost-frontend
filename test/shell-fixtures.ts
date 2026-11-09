import type { FieldChrome } from '@/components/field-chrome';
import { fieldNav } from '@/lib/field-nav';
import { makeMe } from './harness';

/**
 * **A shell's chrome for a spec that draws `AppShell` itself** (P19.2-T1; ADR-0197): since every role's shell is the
 * one shell, `AppShell` always takes `field` — the bar's and the sheet's model and the title row's account. This is an
 * Agent's, on the path given; a spec about something else in the chrome passes what it needs over it.
 */
export function fieldChrome(overrides: Partial<FieldChrome> = {}, pathname = '/activity/log'): FieldChrome {
  return {
    nav: fieldNav(makeMe(), pathname),
    account: {
      name: 'Rina Wijaya',
      role: 'Agent · KPM 0417',
      initials: 'RW',
      profileHref: '/profile',
      onSignOut: () => undefined,
    },
    ...overrides,
  };
}
