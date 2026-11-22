'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { OwnerWhatsAppInviteButton } from '@/components/admin/owner-whatsapp-invite';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { PickerMenu } from '@/components/ui/picker-menu';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { createTenant } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { normalisedPhone } from '@/lib/phone-number';
import { enterKpm } from '@/lib/super-admin-kpm';

interface Created {
  kpmId: string;
  name: string;
  code: string;
  ownerName: string;
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
  const formId = useId();
  const ids = { name: useId(), company: useId(), owner: useId(), phone: useId() };
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0]!.companyId : '');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const problems = {
    name: name.trim().length < 2 ? t.nameShort : undefined,
    company: companyId ? undefined : t.companyNeeded,
    owner: ownerName.trim().length < 2 ? t.ownerNameShort : undefined,
    phone: normalisedPhone(phone) ? undefined : t.phoneBad,
  };
  const shown = (key: keyof typeof problems) => (tried ? problems[key] : undefined);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
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
          <p className="text-sm text-muted">{t.createdLine}</p>
          <OwnerWhatsAppInviteButton kpmId={created.kpmId} ownerName={created.ownerName} onSent={onCreated} className="w-full" />
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
      description={t.line}
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
        <Field label={t.ownerName} htmlFor={ids.owner} error={shown('owner')}>
          <TextInput id={ids.owner} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} invalid={Boolean(shown('owner'))} maxLength={120} autoComplete="off" />
        </Field>
        <Field label={t.ownerPhone} htmlFor={ids.phone} error={shown('phone')}>
          <TextInput id={ids.phone} value={phone} onChange={(e) => setPhone(e.target.value)} invalid={Boolean(shown('phone'))} inputMode="tel" autoComplete="off" placeholder="0812 3456 7890" />
        </Field>
        <p className="text-sm text-muted">{t.note}</p>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}
