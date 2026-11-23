'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { addUserMessages } from '@/i18n/messages/add-user';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import type { ConsoleKpmPeople, ConsolePerson } from '@/lib/admin-console';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { LazyAddUserSheet } from './add-user-button';
import type { AddUserDone } from './add-user-sheet';
import { MemberName } from './member-name';

const asRole = (p: ConsolePerson) => ({ code: p.class.toUpperCase(), label: p.class.toUpperCase(), class: p.class });

/**
 * ***Anggota · n* inside a KPM** (P19.23-T2 AC-4 — moved here from the KPM page by P19.28-T2 AC-1; F-1 (21 Nov); stop
 * motion D frame 3; side-by-side screen 5): the first five, their group and when they last used the app, *Lihat semua*.
 *
 * ***＋ Tambah user*** opens the shared sheet (`AddUserSheet`) **with this KPM fixed** — not editable, no *＋ KPM baru*.
 * ***Unggah file*** is today's *Import people* (`/people/import`). Below 768px the two sit side by side under the list, as
 * the mockup draws them; from 768px they are pills in the card's head beside *Lihat semua*, *Import people* keeping its
 * name there.
 */
export function KpmMembersCard({ people, onChanged }: { people: ConsoleKpmPeople; onChanged?: () => void }) {
  const t = useMessages(adminConsoleMessages).inside;
  const s = useMessages(addUserMessages);
  const fig = useFigureLanguage();
  const router = useRouter();
  const { show } = useToast();
  const [adding, setAdding] = useState(false);
  const kpm = people.kpm;

  const done = (result: AddUserDone) => {
    setAdding(false);
    if (!result.whatsAppOpened && result.kind === 'invited') show(s.blocked);
    else {
      show(s.added({ name: result.fullName, kpm: result.kpm.branch }), {
        action: { label: s.view, onAction: () => router.push(`/admin/members?status=pending&kpmId=${encodeURIComponent(kpm.kpmId)}`) },
      });
    }
    onChanged?.();
  };

  const used = (p: ConsoleKpmPeople['members']['first'][number]) => {
    const text = p.lastUsedDays === null ? t.never : p.lastUsedDays === 0 ? t.today : t.daysAgo({ n: formatNumber(p.lastUsedDays, {}, fig) });
    return (
      <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold', p.lastUsedStatus === 'recent' ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-red text-pill-red-ink')}>
        {text}
      </span>
    );
  };
  /*
   * From 768px the button wears *Import people*'s outline, so the head reads as one row of two actions; from 1024px, where
   * the card is half the page, it is that pill's round 40px form — the ＋ alone, named *Tambah user* to a screen reader
   * and in its tooltip — so the head stays one line as it was (the integration round's walk, 2026-11-22: the filled pill
   * pushed *Anggota · n* onto a line of its own at 1024 and 1280). Below 768px the mockup's filled button under the list.
   */
  const addButton = (phone: boolean) => (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-haspopup="dialog"
      title={phone ? undefined : s.title}
      data-kpm-add-user=""
      className={phone
        ? 'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-primary px-4 text-row font-bold text-primary-contrast'
        : 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-pill border border-hairline px-3.5 text-sm font-semibold text-navy lg:w-10 lg:px-0'}
    >
      <NavIcon name="ti-plus" className="h-4 w-4" />
      <span className={phone ? undefined : 'lg:sr-only'}>{s.title}</span>
    </button>
  );
  return (
    <section aria-labelledby="members-heading" className="rounded-xl bg-card p-4" data-members-card="">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="members-heading" className="text-md font-bold text-navy">{t.membersCard({ n: formatNumber(people.members.total, {}, fig) })}</h2>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-3 max-md:hidden">
            {addButton(false)}
            <Link href="/people/import" className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-hairline px-3.5 text-sm font-semibold text-navy">
              <NavIcon name="ti-file-import" className="h-4 w-4" />
              {t.importPeople}
            </Link>
          </span>
          <Link href="/people/members" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-primary-ink max-md:min-h-11">
            {t.seeAll}
            <NavIcon name="ti-arrow-right" className="h-4 w-4" />
          </Link>
        </span>
      </div>
      {people.members.first.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t.noMembers}</p>
      ) : (
        <ul>
          {people.members.first.map((p) => (
            <li key={p.membershipId} className="flex items-center gap-2 border-b border-divider py-2 text-sm last:border-b-0">
              <MemberName name={p.fullName} role={asRole(p)} className="min-w-0 flex-1" />
              <span className="hidden min-w-0 truncate text-xs text-muted sm:block">{p.groupName ?? t.noGroup}</span>
              {used(p)}
            </li>
          ))}
        </ul>
      )}
      {/* Below 768px (side-by-side screen 5): *＋ Tambah user* · *Unggah file*, side by side under the list. */}
      <div className="mt-2 flex gap-2 md:hidden" data-members-card-actions="">
        {addButton(true)}
        <Link
          href="/people/import"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill border border-hairline bg-card px-4 text-row font-bold text-ink"
        >
          <NavIcon name="ti-upload" className="h-4 w-4" />
          {s.uploadFile}
        </Link>
      </div>
      {adding && (
        <LazyAddUserSheet
          mode="add"
          fixedKpm={{ id: kpm.kpmId, branch: kpm.name, code: kpm.code, companyName: kpm.companyName, companyId: kpm.companyId }}
          onClose={() => setAdding(false)}
          onDone={done}
        />
      )}
    </section>
  );
}
