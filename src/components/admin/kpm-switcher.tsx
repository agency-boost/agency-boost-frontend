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
 */
export function KpmSwitcher({ current, className }: { current: Choice; className?: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const listId = useId();

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
  const shown = (choices ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.companyName.toLowerCase().includes(needle));

  return (
    <div ref={box} className={cn('relative', className)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
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
      {open && (
        <div id={listId} className="absolute right-0 top-full z-30 mt-1.5 w-full min-w-[17rem] rounded-xl bg-card p-2 shadow-lg md:w-80">
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
            className="mt-1 flex min-h-10 items-center gap-2 border-t border-divider px-2.5 pt-2 text-md font-bold text-primary-ink"
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
