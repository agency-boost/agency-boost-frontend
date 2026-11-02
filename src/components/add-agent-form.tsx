'use client';

import { useEffect, useId, useState } from 'react';
import { InviteShare } from '@/components/invite-share';
import { InviteShareBlock } from '@/components/invite-share-block';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { heldBecause } from '@/lib/disabled-reason';
import { formatCalendarDay } from '@/lib/format';
import { addAgent, AGENT_CODE_DIGITS, INVITE_NAME_MAX, type AddAgentResult, type SharedInvite } from '@/lib/invites';
import { myLeaderCode, type MyLeaderCode } from '@/lib/join';
import { nationalDigits, normalisedPhone, PHONE_COUNTRY_PREFIX, PHONE_NATIONAL_DIGITS } from '@/lib/phone-number';

/**
 * **The form's words, in English** (ADR-0170 §1): the client's four labels, and ours around them — the catalogue's
 * source (`i18n/messages/add-agent.ts`; P18.98-T4). Kept for the Unit Dashboard's header, whose words have not moved
 * yet (`ADD_AGENT_COPY.open`); **a screen reads the reader's language instead**: `useMessages(addAgentMessages)`.
 */
export const ADD_AGENT_COPY = messagesIn(addAgentMessages, SOURCE_LANGUAGE);

/** The fields the server names in a refusal, said under their own field. */
const FIELD_OF: Record<string, 'agentCode' | 'fullName' | 'phone' | 'joinDate'> = {
  agentCode: 'agentCode', fullName: 'fullName', phone: 'phone', joinDate: 'joinDate',
};

/**
 * **+ Add agent** (P18.96-T3 AC-1, ADR-0170 §1; the client's R1, UI-001): one form — *Agent code*, *Name*, *WhatsApp
 * number*, *Join date* (today by default) — on `/new-hires` and the Unit Dashboard's roster header, for a leader's own
 * unit and, given `leader`, the Owner's or an Admin's choice of unit. A dialog on the shared `Modal`, its actions in
 * the footer.
 *
 * **The server decides by the agent code** and says which (`onAdded`): somebody with no account is **invited**, and
 * the dialog turns into the invite's share step — *Share on WhatsApp*, *Copy link*, a QR — shown once; an account
 * with no leader here is **linked** now; one under another leader is a **transfer requested**. The last two close the
 * dialog and the screen confirms them. A refusal stays in the dialog, under the field it names where it names one.
 *
 * **Its words are the catalogue's** (`add-agent.ts`; P18.98-T4), today's date in a refusal written in the figures'
 * language. Why *Add agent* is held is `heldBecause`'s sentence (`lib/disabled-reason.ts`), the fields' own labels in it.
 *
 * **UI V1 (UI-024, owner 30 Oct)**: **a centred modal at every size**, scrolling inside itself above the tab bar. For the
 * reader's own unit it opens on **their leader code's share block** — *Kode leader AGUS01*, *Salin tautan · Salin kode ·
 * QR · WhatsApp* (`InviteShareBlock`, the one User Management's *Undang seseorang* uses; *Tautan disalin ✓* / *Kode
 * disalin ✓*, the confirmations') — then *atau kirim undangan langsung* and the four fields: *Nomor WhatsApp* behind a fixed `+62` (9 to 13
 * digits, as *Isi nomor WhatsApp* takes it), the join date today by default and never later. ***Tambah & kirim
 * undangan*** stays grey until the three required fields are filled; why is said to a screen reader only (no *Masih
 * diperlukan…* line). **The server sends no message** (data honesty, parity row): an invite turns the modal into its
 * share step, and once the leader sends it on WhatsApp the modal closes and the page says *Undangan terkirim ke {nama}*
 * (`onSent`) — never before.
 */
export function AddAgentDialog({
  open, onClose, today, leader, onAdded, onSent,
}: {
  open: boolean;
  onClose: () => void;
  /** The office's today: the join date's default and its latest. */
  today: string;
  /** The unit, when it is not the reader's own (the Owner or an Admin on somebody's Unit Dashboard). */
  leader?: { membershipId: string; name: string } | null;
  onAdded: (result: AddAgentResult) => void;
  /** An invite sent on WhatsApp from the share step (UI-024): the modal has closed; the caller confirms it. */
  onSent?: (name: string) => void;
}) {
  const t = useMessages(addAgentMessages);
  const confirmed = useMessages(confirmationMessages);
  const phoneWords = useMessages(uiV1Messages).contact;
  const figures = useFigureLanguage();
  const language = useLanguage();
  const id = useId();
  const [code, setCode] = useState<MyLeaderCode | null>(null);
  const [form, setForm] = useState({ agentCode: '', fullName: '', phone: '', joinDate: today });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [shared, setShared] = useState<SharedInvite | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const close = () => {
    setForm({ agentCode: '', fullName: '', phone: '', joinDate: today });
    setShared(null);
    setError(null);
    setTouched({});
    onClose();
  };

  /*
   * **Each opening starts on the office's today as last read.** The dialog is mounted closed with the page, when
   * `/new-hires` has only the device's clock to go on; the invites' read brings the office's today after. Without this
   * the first opening kept the device's day — and a device a day ahead held *Add agent* back as after today.
   */
  useEffect(() => {
    if (open) setForm((f) => ({ ...f, joinDate: today }));
  }, [open, today]);

  // The reader's own leader code, for the share block — only for their own unit, and only once the modal opens.
  useEffect(() => {
    if (!open || leader || code) return;
    let live = true;
    myLeaderCode().then((mine) => { if (live) setCode(mine); }).catch(() => undefined);
    return () => { live = false; };
  }, [open, leader, code]);

  // What the form can say before the server does. The server's check remains the real one.
  const agentCode = form.agentCode.trim();
  const badCode = agentCode !== '' && !AGENT_CODE_DIGITS.test(agentCode);
  const badNumber = form.phone.trim() !== '' && touched.phone && nationalDigits(form.phone) === null;
  const lateDate = form.joinDate !== '' && form.joinDate > today;
  const refused = error?.details?.field ? FIELD_OF[String(error.details.field)] : undefined;
  const fieldError = (key: keyof typeof form) => (refused === key ? error?.message : undefined);

  const missing = [
    [!agentCode, t.agentCode],
    [!form.fullName.trim(), t.name],
    [!form.phone.trim(), t.whatsApp],
    [!form.joinDate, t.joinDate],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const wrong = badCode || lateDate || (form.phone.trim() !== '' && nationalDigits(form.phone) === null);
  const held = !busy && (missing.length > 0 || wrong);
  const heldWhy = held ? heldBecause({ missing, fix: wrong ? t.fix : null }, language) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ phone: true });
    if (held) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addAgent({
        agentCode,
        fullName: form.fullName.trim(),
        phone: normalisedPhone(form.phone) ?? form.phone.trim(),
        joinDate: form.joinDate,
        ...(leader ? { leaderMembershipId: leader.membershipId } : {}),
      });
      onAdded(result);
      if (result.outcome === 'invited') setShared({ invite: result.invite, link: result.link });
      else close();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.error : toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const title = shared
    ? t.inviteTitle({ name: shared.invite.fullName })
    : leader ? t.titleFor({ leader: leader.name }) : t.title;

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      placement="center"
      className="max-w-[30rem]"
      footer={shared ? (
        <Button onClick={close}>{t.done}</Button>
      ) : (
        <div className="flex flex-col gap-1">
          <Button
            type="submit"
            form={`${id}-form`}
            disabled={busy || held}
            aria-describedby={heldWhy ? `${id}-held` : undefined}
            className="w-full max-md:min-h-11"
          >
            {busy ? t.adding : t.submitInvite}
          </Button>
          {/* UI-024: no *Masih diperlukan…* line on the screen; a screen reader still hears why it is held. */}
          {heldWhy && <p id={`${id}-held`} className="sr-only">{heldWhy}</p>}
        </div>
      )}
    >
      {shared ? (
        <InviteShare
          {...shared}
          onShared={() => {
            const name = shared.invite.fullName;
            close();
            onSent?.(name);
          }}
        />
      ) : (
        <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {!leader && code && (
            <>
              <InviteShareBlock
                code={code.code}
                link={code.url}
                variant="modal"
                copiedLink={confirmed.linkCopied}
                copiedCode={confirmed.codeCopied}
              />
              <p className="flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-divider after:h-px after:flex-1 after:bg-divider">
                {t.orInvite}
              </p>
            </>
          )}
          {error && !refused && <ErrorBanner {...error} />}
          <Field
            label={t.agentCode}
            htmlFor={`${id}-code`}
            hint={t.agentCodeHint}
            error={badCode ? t.badCode : fieldError('agentCode')}
          >
            <TextInput
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.codePlaceholder}
              value={form.agentCode}
              invalid={badCode || refused === 'agentCode'}
              onChange={(e) => set('agentCode')(e.target.value)}
            />
          </Field>
          <Field label={t.name} htmlFor={`${id}-name`} error={fieldError('fullName')}>
            <TextInput
              id={`${id}-name`}
              autoComplete="off"
              placeholder={t.namePlaceholder}
              maxLength={INVITE_NAME_MAX}
              value={form.fullName}
              invalid={refused === 'fullName'}
              onChange={(e) => set('fullName')(e.target.value)}
            />
          </Field>
          <Field
            label={t.whatsApp}
            htmlFor={`${id}-phone`}
            hint={t.whatsAppHint}
            error={badNumber ? phoneWords.invalid(PHONE_NATIONAL_DIGITS) : fieldError('phone')}
          >
            {/* The fixed +62 (UI-024): what is typed after it is the national number, as *Isi nomor WhatsApp* takes it. */}
            <span className="flex items-stretch">
              <span aria-hidden="true" className="flex items-center rounded-l-md border border-r-0 border-line bg-base px-3 text-md font-semibold text-navy">
                {PHONE_COUNTRY_PREFIX}
              </span>
              <TextInput
                id={`${id}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder={t.phonePlaceholder}
                value={form.phone}
                invalid={Boolean(badNumber) || refused === 'phone'}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                onChange={(e) => set('phone')(e.target.value)}
                className="min-w-0 flex-1 rounded-l-none"
              />
            </span>
          </Field>
          <Field
            label={t.joinDate}
            htmlFor={`${id}-join`}
            error={lateDate ? t.lateDate({ today: formatCalendarDay(today, figures) }) : fieldError('joinDate')}
          >
            <DateField
              id={`${id}-join`}
              value={form.joinDate}
              max={today}
              invalid={lateDate || refused === 'joinDate'}
              onChange={set('joinDate')}
              className="w-full"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}
