'use client';

import { Suspense } from 'react';
import { PlatformAccounts } from '@/components/admin/platform-accounts';
import { PlatformMembers } from '@/components/admin/platform-members';
import { Page } from '@/components/page';
import { RouteTabs } from '@/components/ui/route-tabs';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import type { AccountKpmFilter, MemberRoleFilter, MemberStatus } from '@/lib/platform-reads';
import { useQuery } from '@/lib/use-query';

const ROLES = new Set(['ab', 'aab', 'agent']);
const STATUSES = new Set(['active', 'pending', 'removed']);
const KPM_FILTERS = new Set(['none', 'some']);

/** The two tabs, in the query (the route registry's `?tab=`): *Anggota KPM* when absent. */
const MEMBERS_TAB = '/admin/members';
const ACCOUNTS_TAB = '/admin/members?tab=accounts';

/**
 * ***All members*** (`/admin/members`; P19.4-T3 AC-1, AC-2; SA UI-010, SA R1; ADR-0207): every membership on the
 * platform, a sidebar item under *KPMS* after *All KPMs*. *TOTAL MEMBERS* on the overview opens it unfiltered and *ABS*
 * with `?role=AB`. The Super Admin's alone (`platform_members:read`); the API refuses everybody else and audits each read.
 *
 * **Two tabs since P19.12-T2** (ADR-0245 §1; the client's message of 11 November 2026, item 2): ***Anggota KPM***, the
 * list above, unchanged and the default; and ***Akun terdaftar*** (`?tab=accounts`), every registered account — a person
 * who registered and joined no KPM included, whom a list of memberships cannot show.
 */
export default function AllMembersPage() {
  const t = useMessages(adminPlatformReadsMessages).members;
  return (
    <Page title={t.title} permission="platform_members:read">
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <FromAddress />
      </Suspense>
    </Page>
  );
}

/** The address's tab and filters, the ones the server knows; anything else is dropped rather than refused. */
function FromAddress() {
  const t = useMessages(adminPlatformReadsMessages).members;
  const query = useQuery();
  const one = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const accounts = one('tab') === 'accounts';
  const q = one('q');
  const role = one('role')?.toLowerCase();
  const status = one('status')?.toLowerCase();
  const kpm = one('kpm')?.toLowerCase();
  return (
    <>
      <RouteTabs
        label={t.tabs}
        activeHref={accounts ? ACCOUNTS_TAB : MEMBERS_TAB}
        tabs={[{ href: MEMBERS_TAB, label: t.tab.members }, { href: ACCOUNTS_TAB, label: t.tab.accounts }]}
      />
      {/* Keyed by the address's search, so a link that carries one (`n KPM`, *Cari di Akun terdaftar*) starts from it. */}
      {accounts ? (
        <PlatformAccounts
          key={`accounts:${q ?? ''}:${kpm ?? ''}`}
          initial={{ q, kpm: kpm && KPM_FILTERS.has(kpm) ? (kpm as AccountKpmFilter) : undefined }}
        />
      ) : (
        <PlatformMembers
          key={`members:${q ?? ''}`}
          initial={{
            role: role && ROLES.has(role) ? (role as MemberRoleFilter) : undefined,
            status: status && STATUSES.has(status) ? (status as MemberStatus) : undefined,
            companyId: one('companyId'),
            q,
          }}
        />
      )}
    </>
  );
}
