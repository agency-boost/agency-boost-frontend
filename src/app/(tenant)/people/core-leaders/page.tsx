'use client';

import { Suspense } from 'react';
import { Page } from '@/components/page';
import { CoreLeadersScreen } from '@/components/core-leaders/core-leaders-screen';
import { useMessages } from '@/i18n/language-provider';
import { coreLeadersMessages } from '@/i18n/messages/core-leaders';
import { useQuery } from '@/lib/use-query';

/**
 * ***Core leaders & groups*** — People's fifth item, the Owner's and the Admins' (P19.13-T3; UI-199; ADR-0253 §8; OD-324:
 * `/people/core-leaders`). Every leader with one group or none, the ★ group leader and the Core leader tag, and this
 * year's targets; its title is its menu name (UI-197). `member:read_tags` is the page's gate, read-like so the Super
 * Admin's view-as reads it — the API refuses every write there, and the page hides them (`canWrite`).
 *
 * `?group=` opens it on a group (`none`, `core`, or a group's id): Perbaikan sub-group's *Ubah target*.
 */
export default function CoreLeadersPage() {
  const t = useMessages(coreLeadersMessages);
  return (
    <Page title={t.title} permission="member:read_tags">
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <WithQuery />
      </Suspense>
    </Page>
  );
}

function WithQuery() {
  const query = useQuery();
  const group = typeof query.group === 'string' ? query.group : null;
  return <CoreLeadersScreen initialGroup={group} />;
}
