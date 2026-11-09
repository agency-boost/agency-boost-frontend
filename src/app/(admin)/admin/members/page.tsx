'use client';

import { Suspense } from 'react';
import { PlatformMembers } from '@/components/admin/platform-members';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import type { MemberRoleFilter, MemberStatus } from '@/lib/platform-reads';
import { useQuery } from '@/lib/use-query';

const ROLES = new Set(['ab', 'aab', 'agent']);
const STATUSES = new Set(['active', 'pending', 'removed']);

/**
 * ***All members*** (`/admin/members`; P19.4-T3 AC-1, AC-2; SA UI-010, SA R1; ADR-0207): every membership on the
 * platform, a sidebar item under *KPMS* after *All KPMs*. *TOTAL MEMBERS* on the overview opens it unfiltered and *ABS*
 * with `?role=AB`. The Super Admin's alone (`platform_members:read`); the API refuses everybody else and audits each read.
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

/** The address's filters, the ones the server knows; anything else is dropped rather than refused. */
function FromAddress() {
  const query = useQuery();
  const one = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const role = one('role')?.toLowerCase();
  const status = one('status')?.toLowerCase();
  return (
    <PlatformMembers
      initial={{
        role: role && ROLES.has(role) ? (role as MemberRoleFilter) : undefined,
        status: status && STATUSES.has(status) ? (status as MemberStatus) : undefined,
        companyId: one('companyId'),
        q: one('q'),
      }}
    />
  );
}
