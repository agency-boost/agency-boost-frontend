'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ADD_AGENT_COPY, AddAgentDialog } from '@/components/add-agent-form';
import { RequestInbox } from '@/components/request-inbox';
import { WaitingToJoin } from '@/components/waiting-to-join';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { CONFIRMED, withDetail } from '@/lib/confirmations';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  askedFor, readInvites, readMyTransfers, type AddAgentResult, type InviteView, type RequestedTransferView,
} from '@/lib/invites';
import { readInbox } from '@/lib/join';
import { useCan, useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';

/** The header's second button, and the inbox it opens (ADR-0170 §5). */
export const JOINING_COPY = {
  review: (n: number) => `Review requests (${n})`,
  inboxTitle: 'Review requests',
  inboxLine: 'Approve to add them to your unit, with the day they joined.',
  close: 'Close',
  linked: (name: string) => `${name} is in your unit now.`,
  transfer: (name: string) => `${name} moves when the office approves it.`,
} as const;

/** What `/new-hires`'s header and *Waiting to join* share: one read of each, the dialogs' state, the toast. */
export interface NewHiresJoiningState {
  actions: ReactNode;
  mayAdd: boolean;
  invites: InviteView[];
  transfers: RequestedTransferView[];
  today: string;
  adding: boolean;
  reviewing: boolean;
  error: ApiError | null;
  setAdding: (open: boolean) => void;
  setReviewing: (open: boolean) => void;
  setInvites: (update: (list: InviteView[]) => InviteView[]) => void;
  setRequestCount: (n: number) => void;
  onAdded: (result: AddAgentResult) => void;
  toast: ReturnType<typeof useToast>['toast'];
  show: (message: string) => void;
  reader: string | null | undefined;
  /** Bumped when somebody may have joined the roster — linked, or let in from the inbox — so it reads again. */
  rosterKey: number;
  closeInbox: () => void;
}

/**
 * **`/new-hires`'s joining half** (P18.96-T3 AC-1, AC-2, AC-3, AC-5): *+ Add agent* for a reader who may add
 * (`member:invite`), *Review requests (n)* while join requests wait on one who decides them (`leader_request:read_inbox`),
 * and *Waiting to join* — the reader's invites and transfer requests. Each read only for a reader its grant names, so a
 * reader without one is asked nothing; each guarded by the API besides.
 */
export function useNewHiresJoining(): NewHiresJoiningState {
  const { me } = useSession();
  const readOnly = !!me?.impersonationReadOnly;
  const mayAdd = useCan('member:invite') && !readOnly;
  const mayReview = useCan('leader_request:read_inbox');
  const [invites, setInviteRows] = useState<InviteView[]>([]);
  const [transfers, setTransfers] = useState<RequestedTransferView[]>([]);
  const [today, setToday] = useState(() => dayInZone(OFFICE_TIME_ZONE, new Date()));
  const [requestCount, setRequestCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [rosterKey, setRosterKey] = useState(0);
  const { toast, show } = useToast();

  const reload = useCallback(async () => {
    if (!mayAdd) return;
    try {
      const [list, mine] = await Promise.all([readInvites(), readMyTransfers()]);
      setInviteRows(list.invites);
      setToday(list.today);
      setTransfers(mine);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [mayAdd]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!mayReview) return;
    // A join request's notice opens the inbox here (`/new-hires?review=requests`, ADR-0170 §5): read once, on arrival.
    if (new URLSearchParams(window.location.search).get('review') === 'requests') setReviewing(true);
    let live = true;
    // A failed count shows no button, never a second error: the inbox itself is one tap away on User management.
    readInbox().then((rows) => { if (live) setRequestCount(rows.length); }).catch(() => undefined);
    return () => { live = false; };
  }, [mayReview]);

  const onAdded = useCallback((result: AddAgentResult) => {
    if (result.outcome === 'linked') {
      show(withDetail(CONFIRMED.agentAdded, JOINING_COPY.linked(result.member.fullName)));
      setRosterKey((n) => n + 1);
    }
    if (result.outcome === 'transfer_requested') {
      show(withDetail(CONFIRMED.transferRequested, JOINING_COPY.transfer(askedFor(result.transfer))));
    }
    void reload();
  }, [reload, show]);

  const actions = (mayAdd || (mayReview && requestCount > 0)) ? (
    <div className="flex flex-wrap gap-2">
      {mayReview && requestCount > 0 && (
        <Button variant="secondary" onClick={() => setReviewing(true)}>{JOINING_COPY.review(requestCount)}</Button>
      )}
      {mayAdd && <Button onClick={() => setAdding(true)}>{ADD_AGENT_COPY.open}</Button>}
    </div>
  ) : null;

  return {
    actions, mayAdd, invites, transfers, today, adding, reviewing, error, setAdding, setReviewing,
    setInvites: (update) => setInviteRows((list) => update(list)),
    setRequestCount, onAdded, toast, show, reader: me?.membership?.membershipId,
    rosterKey,
    closeInbox: () => { setReviewing(false); setRosterKey((n) => n + 1); },
  };
}

/** *Waiting to join*, the form, the inbox and the toast, under the header `useNewHiresJoining` drew. */
export function NewHiresJoining(state: NewHiresJoiningState) {
  const phone = usePhone();
  return (
    <>
      {state.error && <div className="mb-4"><ErrorBanner {...state.error} /></div>}
      {state.mayAdd && (
        <WaitingToJoin
          invites={state.invites}
          transfers={state.transfers}
          reader={state.reader}
          onInvites={state.setInvites}
          onToast={state.show}
        />
      )}
      {state.mayAdd && (
        <AddAgentDialog
          open={state.adding}
          today={state.today}
          onClose={() => state.setAdding(false)}
          onAdded={state.onAdded}
        />
      )}
      <Modal
        open={state.reviewing}
        title={JOINING_COPY.inboxTitle}
        description={JOINING_COPY.inboxLine}
        onClose={state.closeInbox}
        placement={phone ? 'sheet' : 'center'}
        className="max-w-[34rem]"
        footer={<Button variant="secondary" onClick={state.closeInbox}>{JOINING_COPY.close}</Button>}
      >
        <RequestInbox today={state.today} onCount={state.setRequestCount} />
      </Modal>
      <Toast toast={state.toast} />
    </>
  );
}
