'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { OwnerWhatsAppInviteButton } from '@/components/admin/owner-whatsapp-invite';
import { Avatar } from '@/components/ui/avatar';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { addUserMessages } from '@/i18n/messages/add-user';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { placeUser } from '@/lib/add-user';
import { createTenant } from '@/lib/admin';
import { readWaiting, type WaitingRow } from '@/lib/admin-members';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { normalisedPhone } from '@/lib/phone-number';
import { enterKpm } from '@/lib/super-admin-kpm';
import { useDebounced } from '@/lib/use-debounced';
import { useMediaQuery } from '@/lib/use-media-query';

interface Created {
  kpmId: string;
  name: string;
  code: string;
  ownerName: string;
  /** The owner was somebody registered, placed now (`existing`): told in the app, no invitation to send. */
  placed?: boolean;
}

/**
 * ***KPM baru*** (P19.23-T2 AC-3; the Super Admin spec §5; `superadmin-tablet` f06–f07): *Nama KPM*, *Perusahaan*,
 * *Nama owner*, *WhatsApp owner* — and *Buat KPM & undang owner*. The server copies the company's template into it
 * (`POST /admin/tenants` with no `startFrom`), makes the code (`autoCode`, ADR-0277 §3) and names the Owner, who waits
 * with no account until they accept the invitation (`pendingOwner`).
 *
 * **The invitation is the next tap** (OD-359, OD-420): a browser opens WhatsApp only inside a click, and the click that
 * made the KPM was spent on the request — so the sheet turns into *"<KPM> sudah dibuat · kode 0420"* with *Kirim
 * undangan* (the Owner's WhatsApp invitation, `OwnerWhatsAppInviteButton`), *Masuk ke KPM* and *Nanti saja*. A KPM left
 * uninvited says *Owner belum diundang* on its card and on the Dashboard until it is sent.
 *
 * *Changed 2026-11-22 (P19.28-T2 AC-9; F-1, UI-213 (21 Nov); ADR-0286):* **the owner's fields are a picker** — *Pilih
 * anggota yang sudah terdaftar* (somebody registered with no KPM, of the KPM's company, found by name or email in
 * Anggota's *Menunggu*: the KPM is made and they are placed as its AB and first owner in one step, `POST
 * /admin/accounts/:userId/placement` with `newKpm`, and told in the app) or *Undang orang baru* (name and WhatsApp, as
 * before). On a phone *"Pengaturan disalin dari template perusahaan"* and *"Kode KPM dibuat otomatis…"* are not drawn.
 */
export function NewKpmSheet({
  companies, onClose, onCreated,
}: {
  companies: readonly { companyId: string; name: string }[];
  onClose: () => void;
  /** The list reads again: the new KPM, and later its Owner *Diundang*. */
  onCreated: () => void;
}) {
  const t = useMessages(adminConsoleMessages).create;
  const s = useMessages(addUserMessages).ownerPicker;
  const phoneWidth = useMediaQuery('phone', { beforePaint: true });
  const formId = useId();
  const pickerId = useId();
  const [ownerKind, setOwnerKind] = useState<'existing' | 'invite'>('invite');
  const [typedQuery, setTypedQuery] = useState('');
  const query = useDebounced(typedQuery.trim(), 300);
  const [found, setFound] = useState<WaitingRow[] | null>(null);
  const [picked, setPicked] = useState<WaitingRow | null>(null);
  const ids = { name: useId(), company: useId(), owner: useId(), phone: useId() };
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0]!.companyId : '');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  // *Pilih anggota yang sudah terdaftar*: registered and in no KPM — *Belum ada KPM* — of the KPM's company.
  useEffect(() => {
    if (ownerKind !== 'existing' || query.length < 2) { setFound(null); return; }
    let live = true;
    readWaiting({ q: query, ...(companyId ? { companyId } : {}) })
      .then((page) => { if (live) setFound(page.rows.filter((r) => r.kind === 'unplaced' && (!companyId || r.company?.id === companyId))); })
      .catch(() => { if (live) setFound([]); });
    return () => { live = false; };
  }, [ownerKind, query, companyId]);

  const existing = ownerKind === 'existing';
  const problems = {
    name: name.trim().length < 2 ? t.nameShort : undefined,
    company: companyId ? undefined : t.companyNeeded,
    owner: existing ? (picked ? undefined : s.choose) : ownerName.trim().length < 2 ? t.ownerNameShort : undefined,
    phone: existing || normalisedPhone(phone) ? undefined : t.phoneBad,
  };
  const shown = (key: keyof typeof problems) => (tried ? problems[key] : undefined);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      if (existing && picked?.userId) {
        // One step: the KPM from its company's template, the person its AB and first owner (ADR-0286 §3).
        const placed = await placeUser(
          picked.userId, { newKpm: { branchName: name.trim(), companyId } }, { hasPhone: picked.hasPhone },
        );
        setCreated({ kpmId: placed.kpm.id, name: placed.kpm.branch, code: placed.kpm.code, ownerName: placed.person.fullName, placed: true });
        onCreated();
        return;
      }
      const kpm = await createTenant({
        companyId,
        branchName: name.trim(),
        owner: { fullName: ownerName.trim(), phone: normalisedPhone(phone)! },
        // The WhatsApp invitation is the next tap; nothing goes by email from here.
        sendInvitation: false,
      });
      setCreated({ kpmId: kpm._id, name: kpm.branchName, code: kpm.code, ownerName: ownerName.trim() });
      onCreated();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <ResponsiveSheet open title={t.title} onClose={onClose}>
        <div className="flex flex-col gap-3" data-kpm-created={created.kpmId}>
          <p role="status" className="text-md font-bold text-navy">{t.created({ kpm: created.name, code: created.code })}</p>
          {!created.placed && <p className="text-sm text-muted">{t.createdLine}</p>}
          {!created.placed && (
            <OwnerWhatsAppInviteButton kpmId={created.kpmId} ownerName={created.ownerName} onSent={onCreated} className="w-full" />
          )}
          <Link
            href={`/admin/tenants/${created.kpmId}`}
            onClick={() => enterKpm(created.kpmId)}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-hairline bg-card px-4 text-md font-semibold text-navy"
          >
            {t.goInside}
          </Link>
          <Button variant="inline" onClick={onClose} className="self-center">{t.inviteLater}</Button>
        </div>
      </ResponsiveSheet>
    );
  }

  return (
    <ResponsiveSheet
      open
      title={t.title}
      // UI-213 (21 Nov): not drawn on a phone.
      description={phoneWidth ? undefined : t.line}
      onClose={onClose}
      footer={(
        <Button type="submit" form={formId} disabled={busy} aria-busy={busy || undefined} className="w-full">
          {busy ? t.creating : t.submit}
        </Button>
      )}
    >
      <form id={formId} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" data-new-kpm="">
        <Field label={t.name} htmlFor={ids.name} error={shown('name')}>
          <TextInput id={ids.name} value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(shown('name'))} maxLength={120} autoComplete="off" />
        </Field>
        <div>
          <span id={ids.company} className="mb-1 block text-sm font-semibold text-navy">{t.company}</span>
          <PickerMenu
            label={t.company}
            value={companyId}
            buttonLabel={companyId ? undefined : t.chooseCompany}
            options={companies.map((c) => ({ value: c.companyId, label: c.name }))}
            onChange={setCompanyId}
            className="w-full"
          />
          {shown('company') && <p role="alert" className="mt-1 text-sm text-alert">{shown('company')}</p>}
        </div>
        {/* P19.28-T2 AC-9: who the owner is — somebody registered, or somebody new. */}
        <div role="radiogroup" aria-label={s.label} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" data-owner-kind={ownerKind}>
          {(['existing', 'invite'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={ownerKind === kind}
              onClick={() => setOwnerKind(kind)}
              className={cn(
                'min-h-11 rounded-pill border px-3 text-base font-semibold',
                ownerKind === kind ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
              )}
            >
              {kind === 'existing' ? s.existing : s.invite}
            </button>
          ))}
        </div>
        {existing ? (
          <div className="flex flex-col gap-1.5" data-owner-picker="">
            <label htmlFor={pickerId} className="sr-only">{s.search}</label>
            <span className="relative flex items-center">
              <NavIcon name="ti-search" className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
              <input
                id={pickerId}
                type="search"
                value={typedQuery}
                onChange={(e) => { setTypedQuery(e.target.value); setPicked(null); }}
                placeholder={s.search}
                className="h-11 w-full rounded-pill border border-hairline bg-card pl-9 pr-3 text-md text-ink placeholder:text-muted"
              />
            </span>
            {found && found.length === 0 && <p className="text-sm text-muted">{s.none}</p>}
            {found && found.length > 0 && (
              <ul role="radiogroup" aria-label={s.label}>
                {found.map((row) => (
                  <li key={row.userId ?? row.fullName}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={picked?.userId === row.userId}
                      onClick={() => setPicked(row)}
                      className={cn(
                        'flex min-h-14 w-full items-center gap-2.5 rounded-lg border px-3 text-left',
                        picked?.userId === row.userId ? 'border-primary bg-primary-50' : 'border-transparent',
                      )}
                    >
                      <Avatar name={row.fullName} photoUrl={row.avatarUrl} seed={row.userId ?? row.fullName} size={32} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-bold uppercase text-ink">{row.fullName}</span>
                        {row.email && <span className="truncate text-base text-muted">{row.email}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {shown('owner') && <p role="alert" className="text-sm text-alert">{shown('owner')}</p>}
          </div>
        ) : (
          <>
            <Field label={t.ownerName} htmlFor={ids.owner} error={shown('owner')}>
              <TextInput id={ids.owner} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} invalid={Boolean(shown('owner'))} maxLength={120} autoComplete="off" />
            </Field>
            <Field label={t.ownerPhone} htmlFor={ids.phone} error={shown('phone')}>
              <TextInput id={ids.phone} value={phone} onChange={(e) => setPhone(e.target.value)} invalid={Boolean(shown('phone'))} inputMode="tel" autoComplete="off" placeholder="0812 3456 7890" />
            </Field>
          </>
        )}
        {/* UI-213 (21 Nov): not drawn on a phone; from 768px as before. */}
        <p className={cn('text-sm text-muted', REMOVED_ON_PHONE)}>{t.note}</p>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}
