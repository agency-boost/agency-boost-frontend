'use client';

import { useId, useState } from 'react';
import { Button, Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';

/**
 * ***Tidak ikut* — and why** (P19.25-T1 AC-3; ADR-0281 §2): the answer to the invitation the office reads in Advanced
 * analytics › *Event* (*Tidak ikut · n*, each with the reason). A dialog opened from the *Tidak ikut* the card and the
 * modal already have (form 3); **the reason is optional** — *Kirim* with the field empty declines without one. *Batal*
 * leaves the answer as it was. The length is the server's to refuse (`EVENT_DECLINE_REASON_MAX`, never re-declared here).
 */
export function DeclineDialog({ title, busy, onSend, onClose }: {
  title: string;
  busy: boolean;
  onSend: (reason: string) => void;
  onClose: () => void;
}) {
  const t = useMessages(eventsMessages);
  const id = useId();
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      title={t.declineTitle({ title })}
      onClose={onClose}
      className="max-w-[28rem]"
      footer={(
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t.declineBack}</Button>
          <Button disabled={busy} onClick={() => onSend(reason)}>{t.declineSend}</Button>
        </div>
      )}
    >
      <Field label={t.declineReason} hint={t.declineHint} htmlFor={id}>
        <Textarea
          id={id}
          value={reason}
          placeholder={t.declinePlaceholder}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
