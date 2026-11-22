'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { listTenants } from '@/lib/admin';
import { cn } from '@/lib/cn';
import { leaveKpm } from '@/lib/super-admin-kpm';

interface Choice {
  kpmId: string;
  name: string;
  companyName: string;
}

/**
 * **The KPM switcher chip** (P19.23-T2 AC-4; the Super Admin spec §5 *"KPM switcher chip (jump to another KPM or back to
 * all)"*; `superadmin-tablet` f23): *<KPM> · <perusahaan> ⌄*, opening *Cari KPM*, the KPMs by name with their company,
 * and *Semua KPM* in orange. Choosing a KPM opens its page, which enters it; *Semua KPM* leaves the KPM and goes to the
 * list. The list is read the first time the chip opens (`GET /admin/tenants`), never before.
 *
 * *Changed 2026-11-22 (P19.29-T1 AC-1; UI-200 (21 Nov), ADR-0287 §1):* **`variant="heading"` — on a phone the page's title
 * is the switcher**: the KPM's name at the title's 20/800 with a line-icon chevron, inside the page's one `<h1>`, and the
 * same list under it — the other KPMs, *Semua KPM* last. Its name is the KPM's, so the heading reads as the title; *Ganti
 * KPM* is its description. The chip, from 768px, is as it was.
 */
export function KpmSwitcher({
  current,
  className,
  variant = 'chip',
}: {
  current: Choice;
  className?: string;
  /** `chip`: the pill (from 768px). `heading`: the phone's title row, the KPM's name as the page's `<h1>`. */
  variant?: 'chip' | 'heading';
}) {
  const t = useMessages(adminConsoleMessages).inside;
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const listId = useId();
  const hintId = useId();
  const heading = variant === 'heading';

  useEffect(() => {
    if (!open || choices) return;
    void listTenants()
      .then((rows) => setChoices(rows
        .filter((r) => r.status !== 'archived')
        .map((r) => ({ kpmId: r._id, name: r.branchName, companyName: r.companyName }))
        .sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setChoices([]));
  }, [open, choices]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const shown = (choices ?? [])
    // The heading's list is *the other KPMs* (UI-200): the one it names is the title above it.
    .filter((c) => !heading || c.kpmId !== current.kpmId)
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.companyName.toLowerCase().includes(needle));

  return (
    <div ref={box} className={cn('relative', className)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      {heading ? (
        <>
          <h1 className="min-w-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              aria-describedby={hintId}
              onClick={() => setOpen((was) => !was)}
              className="flex min-h-11 max-w-full items-center gap-1.5 text-left font-display text-title font-extrabold text-navy"
              data-kpm-switcher="heading"
            >
              <span className="min-w-0 truncate">{current.name}</span>
              <NavIcon name="ti-chevron-down" className="h-[18px] w-[18px] shrink-0 text-muted" />
            </button>
          </h1>
          <span id={hintId} hidden>{t.switch}</span>
        </>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${t.switch}: ${t.switcher({ kpm: current.name, company: current.companyName })}`}
          onClick={() => setOpen((was) => !was)}
          className="flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-pill border-[1.5px] border-secondary bg-card px-4 text-sm font-bold text-navy"
          data-kpm-switcher=""
        >
          <NavIcon name="ti-building" className="h-4 w-4 shrink-0" />
          <span className="truncate">{t.switcher({ kpm: current.name, company: current.companyName })}</span>
          <NavIcon name="ti-chevron-down" className="h-4 w-4 shrink-0" />
        </button>
      )}
      {open && (
        <div
          id={listId}
          className={cn(
            'absolute top-full z-30 mt-1.5 rounded-xl bg-card p-2 shadow-lg',
            // Under the title, from its left edge, never past the screen's 16px gutter (UI-200: nothing past 375px).
            heading ? 'left-0 w-[min(20rem,calc(100vw-2rem))]' : 'right-0 w-full min-w-[17rem] md:w-80',
          )}
        >
          <label htmlFor={searchId} className="sr-only">{t.searchKpm}</label>
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchKpm}
            className="mb-1.5 h-10 w-full rounded-lg border border-hairline px-3 text-md text-navy placeholder:text-muted"
          />
          <ul className="max-h-72 overflow-y-auto">
            {shown.map((c) => (
              <li key={c.kpmId}>
                <Link
                  href={`/admin/tenants/${c.kpmId}`}
                  onClick={() => setOpen(false)}
                  aria-current={c.kpmId === current.kpmId ? 'page' : undefined}
                  className={cn('block rounded-lg px-2.5 py-2', c.kpmId === current.kpmId ? 'bg-pill-grey' : 'hover:bg-pill-grey/60')}
                >
                  <b className="block truncate text-md text-navy">{c.name}</b>
                  <span className="block truncate text-xs text-muted">{c.companyName}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/tenants"
            onClick={() => leaveKpm()}
            className={cn(
              'mt-1 flex items-center gap-2 border-t border-divider px-2.5 pt-2 text-md font-bold text-primary-ink',
              heading ? 'min-h-11' : 'min-h-10',
            )}
          >
            <NavIcon name="ti-layout-grid" className="h-4 w-4" />
            {t.allKpms}
          </Link>
        </div>
      )}
    </div>
  );
}

/** The thin bar under a KPM page's header (spec §5): *Anda di dalam KPM ini sebagai Super Admin · semua akses owner …*. */
export function InsideKpmBar() {
  const t = useMessages(adminConsoleMessages).inside.bar;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-secondary-50 px-3 py-1.5 text-sm text-navy" data-inside-kpm-bar="">
      <NavIcon name="ti-shield-check" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t.before} <b>{t.role}</b> {t.after}</span>
    </p>
  );
}
