'use client';

import { useEffect, useId, useState } from 'react';
import { ChoiceSegments, dayShape, MonthShapeField } from '@/components/personal-fields';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field } from '@/components/ui/field';
import { PhoneField } from '@/components/ui/phone-field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';
import { memberMessages } from '@/i18n/messages/member';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { completePersonal, type Member, type MemberPersonalCompleted, type PersonalField } from '@/lib/org';
import { genderLabels, workStatusLabels, type Gender, type WorkStatus } from '@/lib/personal';
import { normalisedPhone } from '@/lib/phone-number';

/** The five, in the order *Data pribadi* lists them. */
const ORDER: readonly PersonalField[] = ['phone', 'dateOfBirth', 'gender', 'companyJoinMonth', 'workStatus'];

/** Which of the five the member has not recorded: the only ones *Lengkapi data* offers. */
export function blankPersonalFields(personal: Member['personal']): PersonalField[] {
  if (!personal) return [];
  return ORDER.filter((f) => !personal[f]);
}

/**
 * ***Lengkapi data*** (P19.12-T5 AC-3; ADR-0248 §3; the client's TI-2): the Owner or an Admin fills a member's **blank**
 * personal fields, and only those — `PATCH /members/:membershipId/personal`.
 *
 * - **Only the blank ones are drawn**, in *Data pribadi*'s order: *No. WhatsApp* (`PhoneField`, the fixed *+62*), *Tanggal
 *   lahir*, *Jenis kelamin*, *Bergabung di {company}*, *Status kerja* — the profile's own controls (`personal-fields.tsx`),
 *   so the office fills a blank in the control the person changes it in.
 * - **Only what is typed is sent**: a field left empty stays blank; nothing typed holds *Simpan*.
 * - **The server's word**: a refused value is said under its field (`details.field`); a field somebody recorded a moment
 *   ago (`409 MEMBER_DETAIL_ON_FILE`) is said in the sheet and the page reads the member again (`onStale`), so the sheet
 *   then offers what is still blank.
 *
 * The shared sheet (`ResponsiveSheet`): a bottom sheet below 1024px, a centred modal from it, *Simpan* pinned at its foot.
 */
export function MemberPersonalDialog({
  open,
  member,
  onDone,
  onStale,
  onClose,
}: {
  open: boolean;
  member: Pick<Member, 'membershipId' | 'fullName' | 'preferredName' | 'personal'>;
  onDone: (answer: MemberPersonalCompleted) => void;
  /** The member changed under the sheet: re-read them. */
  onStale: () => void;
  onClose: () => void;
}) {
  const t = useMessages(memberMessages);
  const account = useMessages(accountMessages).v1;
  const language = useLanguage();
  const formId = useId();
  const blank = blankPersonalFields(member.personal);
  const [draft, setDraft] = useState<Partial<Record<PersonalField, string>>>({});
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // Each opening starts empty.
  useEffect(() => {
    if (!open) return;
    setDraft({});
    setPhoneInvalid(false);
    setError(null);
  }, [open]);

  const set = (field: PersonalField, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (field === 'phone') setPhoneInvalid(false);
    if (error?.details?.field === field) setError(null);
  };
  const typed = blank.filter((f) => (draft[f] ?? '').trim() !== '');
  const refused = error?.details?.field as string | undefined;
  const fieldError = (f: PersonalField) => (refused === f ? error?.message : undefined);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || typed.length === 0) return;
    const body: Partial<Record<PersonalField, string>> = {};
    for (const f of typed) body[f] = draft[f]!.trim();
    if (body.phone !== undefined) {
      const phone = normalisedPhone(body.phone);
      if (phone === null) {
        setPhoneInvalid(true);
        return;
      }
      body.phone = phone;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await completePersonal(member.membershipId, body));
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      if (shown.code === 'MEMBER_DETAIL_ON_FILE') onStale();
    } finally {
      setBusy(false);
    }
  }

  const name = member.preferredName || member.fullName;
  return (
    <ResponsiveSheet
      open={open}
      title={t.completeTitle({ name })}
      description={t.completeLine}
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" form={formId} disabled={busy || typed.length === 0}>
            {busy ? t.saving : t.completeSave}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4 pb-2" data-complete-personal="">
        {error && !refused && <ErrorBanner {...error} />}
        {blank.includes('phone') && (
          <div>
            <label htmlFor="complete-phone" className="mb-1 block text-sm font-semibold text-muted">{t.whatsapp}</label>
            <PhoneField id="complete-phone" value={draft.phone ?? ''} onChange={(v) => set('phone', v)} invalid={phoneInvalid} />
            {fieldError('phone') && <p role="alert" className="mt-1 text-sm text-alert">{fieldError('phone')}</p>}
          </div>
        )}
        {blank.includes('dateOfBirth') && (
          <Field label={t.dateOfBirth} htmlFor="complete-dateOfBirth" error={fieldError('dateOfBirth')}>
            <DateField
              id="complete-dateOfBirth"
              autoComplete="off"
              value={draft.dateOfBirth ?? ''}
              onChange={(value) => set('dateOfBirth', value)}
              invalid={refused === 'dateOfBirth'}
              format={dayShape}
              emptyText={account.dayShape}
              className="w-full"
              faceClassName="max-lg:min-h-12"
            />
          </Field>
        )}
        {blank.includes('gender') && (
          <ChoiceSegments
            label={t.gender}
            options={(Object.entries(genderLabels(language)) as [Gender, string][]).map(([value, label]) => ({ value, label }))}
            value={(draft.gender ?? '') as Gender | ''}
            onChange={(g) => set('gender', g)}
            error={fieldError('gender')}
            touch
          />
        )}
        {blank.includes('companyJoinMonth') && (
          <MonthShapeField
            id="complete-companyJoinMonth"
            label={t.companyJoinMonth({ company: member.personal?.companyName ?? null })}
            value={draft.companyJoinMonth ?? ''}
            onChange={(v) => set('companyJoinMonth', v)}
            error={fieldError('companyJoinMonth')}
            touch
          />
        )}
        {blank.includes('workStatus') && (
          <ChoiceSegments
            label={t.workStatus}
            options={(Object.entries(workStatusLabels(language)) as [WorkStatus, string][]).map(([value, label]) => ({ value, label }))}
            value={(draft.workStatus ?? '') as WorkStatus | ''}
            onChange={(w) => set('workStatus', w)}
            error={fieldError('workStatus')}
            touch
          />
        )}
      </form>
    </ResponsiveSheet>
  );
}
