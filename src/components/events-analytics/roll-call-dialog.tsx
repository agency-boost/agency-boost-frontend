'use client';

import { RollCallSection } from '@/components/events/roll-call';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { eventsOfficeMessages } from '@/i18n/messages/events-office';

/**
 * ***Catat kehadiran*** **— the roll call in a dialog** (P19.25-T1, T3; ADR-0281 §1): who was in the event's audience as
 * at its start, and *Hadir* / *Tidak hadir* for each (`RollCallSection`, OD-31's own). A member nobody marks in an event
 * whose roll call has been taken is *tidak hadir*. Opened from *Kehadiran*'s past event and from the ⋯ on a past row of
 * Pengaturan › Events — a dialog opened from a control that already exists (form 3), since *Lihat masukan ›* now opens
 * Advanced analytics where the dialog used to open. A save reads the tab again (`onSaved`).
 */
export function RollCallDialog({ eventId, title, onClose, onSaved }: {
  eventId: string;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages(eventsOfficeMessages);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      focusDialog
      className="max-w-[44rem]"
      footer={(
        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>{t.close}</Button>
        </div>
      )}
    >
      <RollCallSection eventId={eventId} onSaved={onSaved} tabbed />
    </Modal>
  );
}
