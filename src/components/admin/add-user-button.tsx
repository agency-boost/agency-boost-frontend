'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { addUserMessages } from '@/i18n/messages/add-user';
import { useCan } from '@/lib/session';
import type { AddUserDone } from './add-user-sheet';

/**
 * ***Tambah user*'s sheet, loaded the first time it opens** (the integration round of P19.26–P19.29, 2026-11-22). The
 * sheet — its fields, *Pilih KPM*, *＋ KPM baru*, the phone field and the pickers — is drawn only once a button opens
 * it, so the pages that carry the button (*All members*, a KPM's page) do not ship it on first load: imported eagerly it
 * put both over the 200 kB First Load JS budget (`docs/02-specs/nfr/performance-and-scale.md`).
 */
export const LazyAddUserSheet = dynamic(() => import('./add-user-sheet').then((m) => m.AddUserSheet), { ssr: false });

/**
 * ***Undang anggota*, opening the sheet** (P19.28-T2 AC-1; UI-203 (21 Nov)): *All members*' button, the reader's own KPM
 * fixed — the Super Admin inside a KPM is no longer sent back to the KPM page. A reader who may not add (`member:add`: a
 * core leader looking at the page) keeps the old address, *+ Tambah agent*'s. After saving, the toast; *Lihat* opens
 * Anggota's *Menunggu* for whoever can read it.
 */
export function AddUserButton({
  label,
  className,
  icon,
  fallbackHref,
}: {
  label: string;
  className: string;
  icon: React.ReactNode;
  fallbackHref: string;
}) {
  const s = useMessages(addUserMessages);
  const may = useCan('member:add');
  const readsAnggota = useCan('platform_members:read');
  const [open, setOpen] = useState(false);
  const { show } = useToast();
  const router = useRouter();
  if (!may) {
    return <Link href={fallbackHref} className={className}>{icon}{label}</Link>;
  }
  const done = (result: AddUserDone) => {
    setOpen(false);
    if (!result.whatsAppOpened && result.kind === 'invited') { show(s.blocked); return; }
    const words = s.added({ name: result.fullName, kpm: result.kpm.branch });
    show(words, readsAnggota ? {
      action: {
        label: s.view,
        onAction: () => router.push(`/admin/members?status=pending&kpmId=${encodeURIComponent(result.kpm.id)}`),
      },
    } : undefined);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" data-add-user-open="" className={className}>
        {icon}{label}
      </button>
      {open && <LazyAddUserSheet mode="add" own onClose={() => setOpen(false)} onDone={done} />}
    </>
  );
}
