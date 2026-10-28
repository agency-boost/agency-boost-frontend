'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Segmented } from '@/components/ui/segmented';
import { ADMIN_COPY } from '@/lib/events-admin';
import { useCan } from '@/lib/session';
import { FeedbackSummarySection } from './feedback-summary';
import { RollCallSection } from './roll-call';

/** The dialog's two parts, as tabs (P18.8-T13, ADR-0161 §6). */
const PARTS = [
  { id: 'roll-call', label: ADMIN_COPY.rollCall },
  { id: 'feedback', label: ADMIN_COPY.feedbackSummaryTab },
] as const;

/**
 * **What *View feedback* opens on a past event's row** (`KPM_Owner.html:1655`, an `alert()` there; P18.5-T5
 * AC-7, P18.5-T6 AC-5; D-rollcall): the roll call and the *Feedback Summary* — one dialog, named by the event.
 *
 * **As tabs, *Roll call | Feedback summary*** (P18.8-T13, ADR-0161 §6, the client's request of 2026-10-26), where
 * they were stacked. `Segmented`, the tablist that switches a panel in place: the dialog's address does not
 * change. The roll call is the first tab because the summary depends on it: the NPS counts confirmed attendees
 * only, so saving the roll call reads the summary again, and an answer waiting on a confirmation moves into the
 * NPS as the confirmation lands.
 *
 * **Both parts stay mounted** and the tab shows one: marks not yet saved survive a look at the summary, and the
 * summary read again after a save is there when its tab is opened. The hidden part is `hidden`, out of the
 * accessibility tree with the rest of the panel it is not.
 *
 * Each part is drawn for a reader the server would answer: **the roll call under `event_attendance:confirm`**,
 * which guards its read as well as its write (contract, *final*) — so a read-only support session as the Owner,
 * which holds no confirmation, is shown no roll call at all; the summary under `event_feedback:read` at the
 * office's reach. The server refuses either regardless. **A reader who may see one part sees it alone, with no
 * tab strip**: a strip of one tab is a control that switches nothing.
 */
export function FeedbackDialog({ eventId, title, onClose }: { eventId: string; title: string; onClose: () => void }) {
  const [version, setVersion] = useState(0);
  const mayReadRollCall = useCan('event_attendance:confirm');
  const mayReadFeedback = useCan('event_feedback:read');
  const [part, setPart] = useState<string>(mayReadRollCall ? 'roll-call' : 'feedback');
  const tabbed = mayReadRollCall && mayReadFeedback;

  const rollCall = mayReadRollCall && (
    <RollCallSection eventId={eventId} onSaved={() => setVersion((n) => n + 1)} tabbed={tabbed} />
  );
  const feedback = mayReadFeedback && <FeedbackSummarySection eventId={eventId} version={version} />;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      focusDialog
      className="max-w-[44rem]"
      footer={(
        // A way out a finger can find: Escape and the scrim close it too, and neither is visible. Held at the foot.
        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>{ADMIN_COPY.close}</Button>
        </div>
      )}
    >
      {tabbed ? (
        <Segmented
          label={ADMIN_COPY.feedbackParts}
          tabs={PARTS}
          active={part}
          onSelect={setPart}
          className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5"
        >
          {(active) => (
            <>
              <div hidden={active !== 'roll-call'}>{rollCall}</div>
              <div hidden={active !== 'feedback'}>{feedback}</div>
            </>
          )}
        </Segmented>
      ) : (
        rollCall || feedback
      )}
    </Modal>
  );
}
