'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { readTenant } from '@/lib/admin';
import { leaveKpm } from '@/lib/super-admin-kpm';

/** The names read, by KPM id, for the tab's life: the bar is drawn on every owner page, and the name never changes there. */
const named = new Map<string, string>();

/**
 * **The floating Super Admin bar** (P19.23-T2 AC-5; the Super Admin spec §5 *"Only a small floating Super Admin bar is
 * extra (KPM name · back to KPM page · Semua KPM)"*; `superadmin-tablet` f14, `superadmin-mobile` f14): on every owner
 * page while a Super Admin is inside a KPM — a navy pill (at the top on a phone, as `superadmin-mobile` f14 draws it; at the
 * foot from 768px, as `superadmin-tablet` f14 does), *Super Admin di <KPM> · semua akses owner*, *Halaman KPM* (its
 * page in the console) and *Semua KPM* (leaves the KPM; the list). It reads the KPM's name once (`GET /admin/tenants/:id`).
 */
export function KpmFloatingBar({ kpmId }: { kpmId: string }) {
  const t = useMessages(adminConsoleMessages).floating;
  const [name, setName] = useState<string | null>(named.get(kpmId) ?? null);

  useEffect(() => {
    if (named.has(kpmId)) {
      setName(named.get(kpmId)!);
      return;
    }
    let live = true;
    void readTenant(kpmId)
      .then((kpm) => {
        named.set(kpmId, kpm.branchName);
        if (live) setName(kpm.branchName);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [kpmId]);

  return (
    <aside
      aria-label={t.label}
      data-kpm-floating-bar={kpmId}
      className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-40 md:bottom-6 md:top-auto flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-pill bg-secondary py-1 pl-3 pr-1 text-sm font-semibold text-secondary-contrast shadow-lg print:hidden"
    >
      <NavIcon name="ti-shield-check" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="max-sm:hidden">{t.at} </span>
        <b className="text-primary">{name ?? '…'}</b>
        <span className="max-md:hidden"> {t.access}</span>
      </span>
      <Link
        href={`/admin/tenants/${kpmId}`}
        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-pill bg-secondary-contrast/[0.12] px-3 text-sm font-bold"
      >
        <NavIcon name="ti-layout-grid" className="h-4 w-4" />
        {t.kpmPage}
      </Link>
      <Link
        href="/admin/tenants"
        onClick={() => leaveKpm()}
        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-pill bg-secondary-contrast/[0.12] px-3 text-sm font-bold"
      >
        <NavIcon name="ti-building" className="h-4 w-4" />
        {t.allKpms}
      </Link>
    </aside>
  );
}
