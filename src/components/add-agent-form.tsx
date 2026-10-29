'use client';

import { useEffect, useId, useState } from 'react';
import { InviteShare } from '@/components/invite-share';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { heldBecause } from '@/lib/disabled-reason';
import { formatCalendarDay } from '@/lib/format';
import { addAgent, AGENT_CODE_DIGITS, INVITE_NAME_MAX, type AddAgentResult, type SharedInvite } from '@/lib/invites';
import { whatsAppNumber } from '@/lib/leads';
import { usePhone } from '@/lib/use-phone';

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
 */
export function AddAgentDialog({
  open, onClose, today, leader, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  /** The office's today: the join date's default and its latest. */
  today: string;
  /** The unit, when it is not the reader's own (the Owner or an Admin on somebody's Unit Dashboard). */
  leader?: { membershipId: string; name: string } | null;
  onAdded: (result: AddAgentResult) => void;
}) {
  const t = useMessages(addAgentMessages);
  const figures = useFigureLanguage();
  const language = useLanguage();
  const id = useId();
  const phone = usePhone();
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

  // What the form can say before the server does. The server's check remains the real one.
  const code = form.agentCode.trim();
  const badCode = code !== '' && !AGENT_CODE_DIGITS.test(code);
  const badNumber = form.phone.trim() !== '' && touched.phone && whatsAppNumber(form.phone) === null;
  const lateDate = form.joinDate !== '' && form.joinDate > today;
  const refused = error?.details?.field ? FIELD_OF[String(error.details.field)] : undefined;
  const fieldError = (key: keyof typeof form) => (refused === key ? error?.message : undefined);

  const missing = [
    [!code, t.agentCode],
    [!form.fullName.trim(), t.name],
    [!form.phone.trim(), t.whatsApp],
    [!form.joinDate, t.joinDate],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const wrong = badCode || lateDate || (form.phone.trim() !== '' && whatsAppNumber(form.phone) === null);
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
        agentCode: code,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
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
      placement={phone ? 'sheet' : 'center'}
      className="max-w-[30rem]"
      footer={shared ? (
        <Button onClick={close}>{t.done}</Button>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" form={`${id}-form`} disabled={busy || held} aria-describedby={heldWhy ? `${id}-held` : undefined}>
              {busy ? t.adding : t.submit}
            </Button>
            <Button variant="secondary" onClick={close} disabled={busy}>{t.cancel}</Button>
          </div>
          {heldWhy && <p id={`${id}-held`} className="text-xs text-muted">{heldWhy}</p>}
        </div>
      )}
    >
      {shared ? (
        <InviteShare {...shared} />
      ) : (
        <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
              value={form.agentCode}
              invalid={badCode || refused === 'agentCode'}
              onChange={(e) => set('agentCode')(e.target.value)}
            />
          </Field>
          <Field label={t.name} htmlFor={`${id}-name`} error={fieldError('fullName')}>
            <TextInput
              id={`${id}-name`}
              autoComplete="off"
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
            error={badNumber ? t.badNumber : fieldError('phone')}
          >
            <TextInput
              id={`${id}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.phone}
              invalid={Boolean(badNumber) || refused === 'phone'}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              onChange={(e) => set('phone')(e.target.value)}
            />
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
