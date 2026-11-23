'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonText } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { kpmOwnersMessages } from '@/i18n/messages/kpm-owners';
import {
  deleteTenant, moveTenantCompany, readTenantContents, setTenantStatus, type TenantContents, type TenantStatus,
} from '@/lib/admin';
import type { ConsoleKpm } from '@/lib/admin-console';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { enterKpm } from '@/lib/super-admin-kpm';

type Open = null | 'move' | 'suspend' | 'archive' | 'reactivate' | 'delete';

/**
 * **A KPM card's ⋯** (P19.23-T2 AC-2; the Super Admin spec §5; `superadmin-tablet` f08–f09): *Kelola owner · Pindah
 * perusahaan · Tangguhkan · Arsipkan · Hapus KPM* — the last red, last. *Kelola owner* opens the KPM page's *KPM Owner · n*
 * (P19.27-T3 AC-4; ADR-0285), where *Ganti owner* opened a page of its own. A suspended KPM offers *Aktifkan lagi* where
 * *Tangguhkan* stood, an archived one where *Arsipkan* stood. Each is the console's existing route, and the server
 * refuses anything it would not do and says why — a KPM with members besides its Owner cannot move company, one that
 * holds members or records cannot be deleted (ADR-0191 §5, kept: OD-419) — and audits every change.
 *
 * The forms are sheets (§12: *dialogs as bottom sheets* on a phone; a centred box from 1024px).
 */
export function KpmActions({
  kpm, companies, onChanged,
}: {
  kpm: Pick<ConsoleKpm, 'kpmId' | 'name' | 'companyId' | 'companyName' | 'status'>;
  companies: readonly { companyId: string; name: string }[];
  onChanged: () => void;
}) {
  const t = useMessages(adminConsoleMessages);
  const o = useMessages(kpmOwnersMessages);
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = () => { setOpen(null); onChanged(); };

  const items: ActionMenuItem[] = [
    // *Kelola owner* (P19.27-T3 AC-4; ADR-0285; UI-212 (21 Nov)): the KPM page's *KPM Owner · n*, where *Ganti owner*'s page was.
    { label: o.manage, onSelect: () => { enterKpm(kpm.kpmId); router.push(`/admin/tenants/${kpm.kpmId}#owners`); } },
    { label: t.kpms.menu.moveCompany, onSelect: () => setOpen('move') },
    kpm.status === 'active'
      ? { label: t.kpms.menu.suspend, onSelect: () => setOpen('suspend') }
      : { label: t.kpms.menu.reactivate, onSelect: () => setOpen('reactivate') },
    ...(kpm.status !== 'archived' ? [{ label: t.kpms.menu.archive, onSelect: () => setOpen('archive') }] : []),
    { label: t.kpms.menu.delete, tone: 'alert', danger: true, onSelect: () => setOpen('delete') },
  ];

  return (
    <>
      <ActionMenu label={t.kpms.actionsFor({ kpm: kpm.name })} items={items} glyph="⋯" triggerClassName="h-10 w-10" />
      {open === 'move' && <MoveSheet kpm={kpm} companies={companies} onClose={close} onDone={done} />}
      {(open === 'suspend' || open === 'archive') && (
        <StatusSheet kpm={kpm} to={open === 'suspend' ? 'suspended' : 'archived'} onClose={close} onDone={done} />
      )}
      {open === 'reactivate' && <Reactivate kpm={kpm} onClose={close} onDone={done} />}
      {open === 'delete' && <DeleteSheet kpm={kpm} onClose={close} onDone={done} onArchive={() => setOpen('archive')} />}
    </>
  );
}

type SheetProps = {
  kpm: Pick<ConsoleKpm, 'kpmId' | 'name' | 'companyId' | 'companyName' | 'status'>;
  onClose: () => void;
  onDone: () => void;
};

/** *Pindah perusahaan*: another company, and why only an empty KPM moves. */
function MoveSheet({ kpm, companies, onClose, onDone }: SheetProps & { companies: readonly { companyId: string; name: string }[] }) {
  const t = useMessages(adminConsoleMessages).dialogs;
  const { show } = useToast();
  const others = companies.filter((c) => c.companyId !== kpm.companyId);
  const [target, setTarget] = useState(others[0]?.companyId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const formId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const moved = await moveTenantCompany(kpm.kpmId, target);
      show(t.moved({ kpm: kpm.name, company: moved.companyName }));
      onDone();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open
      title={t.moveTitle}
      description={`${kpm.name} · ${kpm.companyName}`}
      onClose={onClose}
      footer={(
        <Button type="submit" form={formId} disabled={busy || !target} className="w-full">{t.move}</Button>
      )}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <div>
          <span className="mb-1 block text-sm font-semibold text-navy">{t.moveTo}</span>
          <PickerMenu
            label={t.moveTo}
            value={target}
            options={others.map((c) => ({ value: c.companyId, label: c.name }))}
            onChange={setTarget}
            className="w-full"
          />
        </div>
        <p className="text-sm text-muted">{t.moveNote}</p>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}

/** *Tangguhkan* or *Arsipkan*, with a reason the audit log keeps. */
function StatusSheet({ kpm, to, onClose, onDone }: SheetProps & { to: Extract<TenantStatus, 'suspended' | 'archived'> }) {
  const t = useMessages(adminConsoleMessages).dialogs;
  const { show } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const formId = useId();
  const reasonId = useId();
  const suspend = to === 'suspended';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setTenantStatus(kpm.kpmId, to, reason.trim() || undefined);
      show(t.saved);
      onDone();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open
      title={suspend ? t.suspendTitle({ kpm: kpm.name }) : t.archiveTitle({ kpm: kpm.name })}
      description={suspend ? t.suspendLine : t.archiveLine}
      onClose={onClose}
      footer={(
        <Button type="submit" form={formId} variant="danger" disabled={busy} className="w-full">
          {suspend ? t.suspend : t.archive}
        </Button>
      )}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <Field label={t.reason} hint={t.reasonHint} htmlFor={reasonId}>
          <TextInput id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}

/** *Aktifkan lagi*: a question, then the KPM is active again. */
function Reactivate({ kpm, onClose, onDone }: SheetProps) {
  const t = useMessages(adminConsoleMessages).dialogs;
  const { show } = useToast();
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <>
      <Dialog
        open={!error}
        message={t.reactivateTitle({ kpm: kpm.name })}
        detail={t.reactivateLine}
        confirmLabel={t.reactivate}
        cancelLabel={t.cancel}
        onCancel={onClose}
        onConfirm={() => {
          void setTenantStatus(kpm.kpmId, 'active')
            .then(() => { show(t.saved); onDone(); })
            .catch((err) => setError(toDisplayError(err)));
        }}
      />
      {error && (
        <ResponsiveSheet open title={t.reactivateTitle({ kpm: kpm.name })} onClose={onClose}>
          <ErrorBanner {...error} />
        </ResponsiveSheet>
      )}
    </>
  );
}

/**
 * *Hapus KPM*: what the KPM holds is read first (`GET /admin/tenants/:id/contents`). Empty, it is deleted on a press;
 * holding members or records, it cannot be, and the sheet says so and offers *Arsipkan* (ADR-0191 §5).
 */
function DeleteSheet({ kpm, onClose, onDone, onArchive }: SheetProps & { onArchive: () => void }) {
  const t = useMessages(adminConsoleMessages).dialogs;
  const fig = useFigureLanguage();
  const { show } = useToast();
  const [contents, setContents] = useState<TenantContents | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readTenantContents(kpm.kpmId).then(setContents).catch((err) => setError(toDisplayError(err)));
  }, [kpm.kpmId]);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteTenant(kpm.kpmId);
      show(t.deleted({ kpm: kpm.name }));
      onDone();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open
      title={t.deleteTitle({ kpm: kpm.name })}
      description={`${kpm.name} · ${kpm.companyName}`}
      onClose={onClose}
      footer={contents && (contents.deletable ? (
        <Button variant="danger" onClick={() => void remove()} disabled={busy} className="w-full">{t.delete}</Button>
      ) : (
        <Button variant="secondary" onClick={onArchive} className="w-full">{t.archive}</Button>
      ))}
    >
      {!contents && !error && <SkeletonText lines={2} />}
      {!contents && !error && <span className="sr-only">{t.checking}</span>}
      {contents && (
        <p className="text-md text-navy" data-kpm-contents={contents.deletable ? 'empty' : 'held'}>
          {contents.deletable
            ? t.deleteLine
            : t.deleteBlocked({ members: formatNumber(contents.members, {}, fig), records: formatNumber(contents.records, {}, fig) })}
        </p>
      )}
      {error && <ErrorBanner {...error} />}
    </ResponsiveSheet>
  );
}
