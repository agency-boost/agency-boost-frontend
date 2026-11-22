'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { TAP_AREA } from '@/components/ui/phone';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { readTenant } from '@/lib/admin';
import { leaveKpm } from '@/lib/super-admin-kpm';
import { usePhone } from '@/lib/use-phone';

/** The names read, by KPM id, for the tab's life: the bar is drawn on every owner page, and the name never changes there. */
const named = new Map<string, string>();

/**
 * **The floating Super Admin bar** (P19.23-T2 AC-5; the Super Admin spec §5 *"Only a small floating Super Admin bar is
 * extra (KPM name · back to KPM page · Semua KPM)"*; `superadmin-tablet` f14, `superadmin-mobile` f14): on every owner
 * page while a Super Admin is inside a KPM — a navy pill (at the top on a phone, as `superadmin-mobile` f14 draws it; at the
 * foot from 768px, as `superadmin-tablet` f14 does), *Super Admin di <KPM> · semua akses owner*, *Halaman KPM* (its
 * page in the console) and *Semua KPM* (leaves the KPM; the list). It reads the KPM's name once (`GET /admin/tenants/:id`).
 *
 * *Changed 2026-11-22 (P19.29-T2 AC-1; UI-201 (21 Nov), ADR-0287 §2 — superseding 261120 §5's *small floating bar* on a
 * phone and ADR-0277 §3.4's *at the top on a phone*):* **below 768px it is a normal 40px strip above the title row**
 * (`at="top"`, which the shell puts before the page's header), scrolling with the page and covering nothing: the KPM's name
 * on the left, *Halaman KPM* and *Semua KPM* on the right. From 768px the pill floats at the foot as before
 * (`at="floating"`). The shell draws both; each draws itself at its own width only, so one is ever there.
 */
export function KpmFloatingBar({ kpmId, at = 'floating' }: { kpmId: string; at?: 'top' | 'floating' }) {
  const t = useMessages(adminConsoleMessages).floating;
  const phone = usePhone();
  const here = (at === 'top') === phone;
  const [name, setName] = useState<string | null>(named.get(kpmId) ?? null);

  useEffect(() => {
    if (!here) return;
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
  }, [kpmId, here]);

  if (!here) return null;
  if (at === 'top') return <KpmStrip kpmId={kpmId} name={name} />;
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

/**
 * **The strip on a phone** (P19.29-T2 AC-1, AC-2; UI-201 (21 Nov); the stop motion's `newOwnerPage`, section D frame 6):
 * 40px, navy, in the page's flow above its title row — so the title and its buttons (*KPM admins*, *All members*,
 * *Undang anggota*) are never under it — and as wide as the screen, its words on the page's 16px gutter.
 *
 * **The KPM's name is never cut below 120px**: the name takes what the two links leave, and they are 13/600 words. At 360px
 * that is 360 − 32 (gutters) − 22 (the shield) − 8 − about 172 (*Halaman KPM*, *Semua KPM* and the gap between) = about
 * 126px; at 375px about 141px. Inside the gutters, as a rounded pill with its own padding, it would be under 100px at
 * 360, so the strip runs edge to edge. Each link is 40px tall and takes a 44px tap (`TAP_AREA`).
 */
function KpmStrip({ kpmId, name }: { kpmId: string; name: string | null }) {
  const t = useMessages(adminConsoleMessages).floating;
  const link = `relative ${TAP_AREA} inline-flex h-10 shrink-0 items-center text-base font-semibold`;
  return (
    <aside
      aria-label={t.label}
      data-kpm-floating-bar={kpmId}
      data-kpm-strip=""
      className="-mx-4 -mt-4 mb-3 flex h-10 items-center gap-2 bg-secondary px-4 text-base text-secondary-contrast print:hidden"
    >
      <NavIcon name="ti-shield-check" className="h-4 w-4 shrink-0" />
      <b className="min-w-0 flex-1 truncate font-bold text-primary" data-kpm-strip-name="">{name ?? '…'}</b>
      <span className="flex shrink-0 items-center gap-3">
        <Link href={`/admin/tenants/${kpmId}`} className={link}>{t.kpmPage}</Link>
        <Link href="/admin/tenants" onClick={() => leaveKpm()} className={link}>{t.allKpms}</Link>
      </span>
    </aside>
  );
}
