'use client';

import { useEffect, useId, useState } from 'react';
import { allSources, TemplateSourceSelect, useTemplateSources } from '@/components/kpm-template/template-sources';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { ChoicePill } from '@/components/ui/rows-and-sheets';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminApprovalsMessages } from '@/i18n/messages/admin-approvals';
import { checkKpmCode, type CodeAvailability, type KpmRequestRow, type StartFrom } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import type { Insurer } from '@/lib/companies';
import { formatDay } from '@/lib/format';

/** A KPM code as approval takes it: four digits (`ApproveKpmRequestDto`). */
const KPM_CODE = /^\d{4}$/;

/**
 * ***Tolak*'s reason** (P19.23-T3 AC-2): a bottom sheet below 1024px, a dialog from it (§12). The reason is optional for a
 * KPM registration and required for a leader past the limit (the server refuses an empty one), and it is sent back to
 * whoever asked. The confirm is full width below 768px.
 */
export function DeclineDialog({
  subject,
  required,
  onCancel,
  onConfirm,
}: {
  /** What is declined, under the title: *KPM baru · Surabaya Barat Branch*. */
  subject: string;
  required: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const t = useMessages(adminApprovalsMessages).declineDialog;
  const fieldId = useId();
  const formId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const blank = reason.trim() === '';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (required && blank) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open
      title={t.title}
      description={subject}
      onClose={onCancel}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="min-h-11 max-sm:w-full" onClick={onCancel}>{t.cancel}</Button>
          <Button type="submit" form={formId} variant="danger" className="min-h-11 max-sm:w-full" disabled={busy || (required && blank)}>
            {t.confirm}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <Field label={required ? t.reason : t.reasonOptional} htmlFor={fieldId} hint={t.hint}>
          <TextInput id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}

/**
 * ***Atur & setujui* — a KPM registration with its choices** (P19.23-T3 AC-2; ADR-0191 §2–§5, ADR-0213 §3, kept behind ⋯
 * and opened by *Setujui* when the applicant cannot own the KPM as asked). The applicant — name, email, phone, the day
 * they asked, their note — the company the office is for (a picker, starting on the request's), the code (optional: the
 * server makes the next free one where it is empty; a typed one is checked as it is typed), *Mulai dari* where the
 * company has no template, what stands in the way of the applicant owning it, and *Setujui & jadikan Owner*. *Hapus
 * permintaan* removes a wrong or duplicate request, asked first.
 */
export function ApproveKpmDialog({
  row,
  insurers,
  onCancel,
  onApprove,
  onRemove,
}: {
  row: KpmRequestRow;
  insurers: readonly Insurer[];
  onCancel: () => void;
  onApprove: (choice: { code?: string; companyId?: string; startFrom?: StartFrom }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const t = useMessages(adminApprovalsMessages).approveDialog;
  const figures = useFigureLanguage();
  const ids = { company: useId(), code: useId(), start: useId(), form: useId() };
  const [companyId, setCompanyId] = useState(row.companyId);
  const [code, setCode] = useState('');
  const [check, setCheck] = useState<CodeAvailability | null>(null);
  const [startFrom, setStartFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const sources = useTemplateSources(Boolean(companyId), { companyId, others: false, archived: false });
  const noTemplate = sources.groups !== null && !sources.groups.some((g) => g.companyId === companyId);
  const options = allSources(sources.groups);
  useEffect(() => { setStartFrom(''); }, [companyId]);
  const pick = startFrom || (options[0]?.value ?? 'empty');
  const option = options.find((o) => o.value === pick) ?? null;

  const typed = code.trim();
  const shaped = typed === '' || KPM_CODE.test(typed);
  useEffect(() => {
    setCheck(null);
    if (!KPM_CODE.test(typed) || !companyId) return;
    let live = true;
    const timer = setTimeout(() => {
      checkKpmCode(companyId, typed)
        .then((answer) => { if (live) setCheck(answer); })
        .catch(() => { if (live) setCheck(null); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [typed, companyId]);

  const otherCompany = row.requesterCompanyId !== null && row.requesterCompanyId !== companyId;
  const cannotOwn = row.requesterCompanyId === null || otherCompany || !row.requesterEmailVerified;
  const taken = check !== null && !check.available;
  const choices = insurers.some((c) => c._id === row.companyId)
    ? insurers
    : [{ _id: row.companyId, name: row.companyName } as Insurer, ...insurers];

  async function approve(event: React.FormEvent) {
    event.preventDefault();
    if (!shaped || taken || cannotOwn) return;
    setBusy(true);
    setError(null);
    try {
      await onApprove({
        ...(typed ? { code: typed } : {}),
        ...(companyId !== row.companyId ? { companyId } : {}),
        ...(noTemplate
          ? { startFrom: option ? { kind: 'template', templateLibrary: true, templateId: option.templateId } : { kind: 'empty' } }
          : {}),
      });
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <ResponsiveSheet
      open
      title={t.title({ branch: row.branchName })}
      description={row.companyName}
      onClose={onCancel}
      footer={asking ? (
        <div className="flex flex-col gap-2">
          <p className="text-md text-ink">{t.removeAsk({ branch: row.branchName })}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-11 max-sm:w-full" onClick={() => setAsking(false)}>{t.cancel}</Button>
            <Button variant="danger" className="min-h-11 max-sm:w-full" disabled={busy} onClick={() => void remove()}>{t.removeConfirm}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="inlineDanger" className="min-h-11 sm:mr-auto" disabled={busy} onClick={() => setAsking(true)}>
            {t.removeConfirm}
          </Button>
          <Button type="submit" form={ids.form} className="min-h-11 max-sm:w-full" disabled={busy || !shaped || taken || cannotOwn}>
            {t.confirm}
          </Button>
        </div>
      )}
    >
      <form id={ids.form} onSubmit={(e) => void approve(e)} className="flex flex-col gap-3">
        <div className="rounded-lg bg-base p-3 text-md">
          <span className="block text-xs font-semibold text-muted">{t.applicant}</span>
          <span className="block font-bold uppercase text-ink">{row.requestedByName}</span>
          <span className="block break-all text-sm text-muted">
            {[row.requestedByEmail, row.requestedByPhone, formatDay(row.requestedAt, figures)].filter(Boolean).join(' · ')}
          </span>
          {row.note && <span className="mt-1 block text-md text-ink">{row.note}</span>}
        </div>

        <Field label={t.company} htmlFor={ids.company}>
          <ChoicePill
            id={ids.company}
            name={t.company}
            options={choices.map((c) => ({ key: c._id, label: c.name }))}
            value={companyId}
            onChange={setCompanyId}
            narrows={false}
            shows="value"
            className="self-start"
          />
        </Field>

        <Field
          label={t.code}
          htmlFor={ids.code}
          hint={!shaped ? undefined : check?.available ? t.codeFree : t.codeHint}
          error={!shaped ? t.codeShape : taken && check?.takenBy
            ? t.codeTaken({ office: `${check.takenBy.branchName} · ${check.takenBy.code}`, company: check.takenBy.companyName })
            : undefined}
        >
          <TextInput
            id={ids.code}
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            invalid={!shaped || taken}
          />
        </Field>

        {noTemplate && (
          <Field label={t.startFrom} htmlFor={ids.start} hint={t.startFromHint}>
            <TemplateSourceSelect id={ids.start} groups={sources.groups ?? []} value={pick} onChange={setStartFrom}>
              <option value="empty">{t.startEmpty}</option>
            </TemplateSourceSelect>
          </Field>
        )}

        {otherCompany && row.requesterCompanyName && (
          <p className="text-md text-alert">{t.signedUpWith({ name: row.requestedByName, company: row.requesterCompanyName })}</p>
        )}
        {row.requesterCompanyId === null && <p className="text-md text-alert">{t.noCompany({ name: row.requestedByName })}</p>}
        {!row.requesterEmailVerified && <p className="text-md text-alert">{t.unverified({ name: row.requestedByName })}</p>}
        <p className="text-sm text-muted">{t.approvingMeans({ name: row.requestedByName })}</p>
        {error && <ErrorBanner {...error} />}
      </form>
    </ResponsiveSheet>
  );
}

/** Whether *Setujui* can make the KPM as asked in one press: the applicant may own it in the request's company. */
export function approvableAsAsked(row: KpmRequestRow): boolean {
  return row.requesterEmailVerified && row.requesterCompanyId !== null && row.requesterCompanyId === row.companyId;
}
