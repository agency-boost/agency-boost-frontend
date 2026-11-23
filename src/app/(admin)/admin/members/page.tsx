'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { Anggota } from '@/components/admin/anggota';
import { PlatformAccounts } from '@/components/admin/platform-accounts';
import { Page } from '@/components/page';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { adminMembersMessages } from '@/i18n/messages/admin-members';
import type { MemberClass } from '@/lib/admin-members';
import type { AccountKpmFilter, MemberStatus } from '@/lib/platform-reads';
import { useQuery } from '@/lib/use-query';

const CLASSES = new Set(['ab', 'aab', 'agent']);
const STATUSES = new Set(['active', 'pending', 'removed']);
const KPM_FILTERS = new Set(['none', 'some']);

/**
 * ***Anggota*** (`/admin/members`; P19.23-T3 AC-1; the Super Admin spec of 20 November 2026, §6; ADR-0277) — every member
 * of every KPM, the rail's third item. The Super Admin's alone (`platform_members:read`); the API refuses everybody else
 * and audits each read. The list is `Anggota`; a row opens the member's detail.
 *
 * **`?tab=accounts` is *Akun terdaftar*** (ADR-0245 §1; the client's request of 11 November 2026, item 2): every
 * registered account, one in no KPM included — kept, one link under the list, with its way back (parity I-1187). The
 * address's filters (`?role=AB`, `?status=`, `?companyId=`, `?q=`) start the list from them; anything else is dropped.
 * Since P19.28-T3 (UI-209 (21 Nov)) `?status=` names a chip — *Aktif* (`active`, the default), *Menunggu* (`pending`),
 * *Keluar* (`removed`) — and `?status=test` turns *Tampilkan akun tes* on.
 */
export default function AnggotaPage() {
  const t = useMessages(adminMembersMessages);
  return (
    <Page title={t.title} permission="platform_members:read">
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <FromAddress />
      </Suspense>
    </Page>
  );
}

/** The address's view and filters, the ones the server knows. */
function FromAddress() {
  const t = useMessages(adminMembersMessages);
  const query = useQuery();
  const one = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const q = one('q');
  if (one('tab') === 'accounts') {
    const kpm = one('kpm')?.toLowerCase();
    return (
      <div className="flex flex-col gap-3">
        <Link href="/admin/members" className="inline-flex min-h-11 items-center gap-1 self-start text-md font-semibold text-navy">
          <LineIcon name="chevronLeft" className="h-4 w-4" />
          {t.backToMembers}
        </Link>
        <PlatformAccounts
          key={`accounts:${q ?? ''}:${kpm ?? ''}`}
          initial={{ q, kpm: kpm && KPM_FILTERS.has(kpm) ? (kpm as AccountKpmFilter) : undefined }}
        />
      </div>
    );
  }
  const role = one('role')?.toLowerCase();
  const status = one('status')?.toLowerCase();
  return (
    <Anggota
      key={`members:${q ?? ''}:${role ?? ''}`}
      initial={{
        role: role && CLASSES.has(role) ? (role as MemberClass) : undefined,
        // P19.28-T3 AC-4 (UI-209 (21 Nov)): a chip — *Aktif* when none is named — and `?status=test`, the old *Akun tes*,
        // is *Tampilkan akun tes* on.
        status: status && STATUSES.has(status) ? (status as MemberStatus) : 'active',
        testAccount: status === 'test' ? 'include' : undefined,
        companyId: one('companyId'),
        q,
      }}
    />
  );
}
