'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { joinInFlight } from '@/lib/in-flight';
import {
  createShareLink, revokeShareLinks, sharedAddress, type MeetingView, type ShareLink,
} from '@/lib/leader-meetings';
import { useMeetingWriter } from './meeting-writer';

/**
 * ***Share these minutes*** (`:2735-2745`, *Share this MOM* there — P18.97-T2 AC-3; OD-146, ADR-0131, I-256): the
 * product's dialog (F-72).
 *
 * **Each opening makes a fresh link** (contract, Noted 1): only its hash is kept, so a link once made cannot
 * be shown again. Earlier links live until they expire or are stopped. The address is
 * `{origin}/leader-meetings/shared/{token}`, read-only in the field; the hint in OD-146's answered words, its
 * date the day the link stops opening, in the office's calendar. ***Copy link*** says *"Link copied to
 * clipboard"* (`:2764`); ***Stop sharing*** stops every live link to the meeting and says *"Sharing stopped"*.
 */
export function ShareDialog({
  open,
  onClose,
  meeting,
}: {
  open: boolean;
  onClose: () => void;
  meeting: Pick<MeetingView, 'id' | 'branch'>;
}) {
  const t = useMessages(forumMessages);
  const confirmed = useMessages(confirmationMessages);
  const share = t.shareDialog;
  const language = useFigureLanguage();
  const writer = useMeetingWriter();
  const field = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stopError, setStopError] = useState<ApiError | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setLink(null);
    setFailed(false);
    setStopError(null);
    // One link per opening, though React runs an effect twice in development.
    joinInFlight(`leader-meeting-share:${meeting.id}`, () => createShareLink(meeting.id))
      .then((made) => { if (live) setLink(made); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, attempt, meeting.id]);

  const address = link && typeof window !== 'undefined' ? sharedAddress(window.location.origin, link.token) : '';

  async function copy() {
    try {
      // Absent in an insecure context and in some in-app browsers.
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
      // The copy controls' one wording since 2026-10-26 (P18.95-T1 AC-6, ADR-0167 §5): the shared confirmations'.
      writer.announce(confirmed.linkCopied);
    } catch {
      // The prototype's own way (`:2761-2763`); failing that, the link is left selected to copy by hand.
      field.current?.focus();
      field.current?.select();
      if (document.execCommand?.('copy')) writer.announce(confirmed.linkCopied);
    }
  }

  async function stop() {
    setStopping(true);
    setStopError(null);
    try {
      await revokeShareLinks(meeting.id);
      writer.announce(share.stopped);
      onClose();
    } catch (err) {
      setStopError(toDisplayError(err));
    } finally {
      setStopping(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={share.title}
      description={link
        ? t.shareHint({ branch: meeting.branch, until: formatOfficeDay(link.expiresAt, OFFICE_TIME_ZONE, language) })
        : undefined}
      className="max-w-[27.5rem]"
    >
      {failed && (
        <div className="mb-3.5">
          <p role="alert" className="text-sm font-semibold text-alert">{share.failed}</p>
          <Button variant="secondary" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!link && !failed && (
        <Skeleton className="mb-3.5">
          <SkeletonBar className="h-10 w-full rounded-md" />
        </Skeleton>
      )}
      {link && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          <input
            ref={field}
            type="text"
            readOnly
            value={address}
            aria-label={share.title}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 basis-56 rounded-md border border-hairline bg-base px-3 py-2.5 text-sm text-navy"
          />
          <Button onClick={() => void copy()} className="h-auto rounded-[7px] px-[13px] py-[7px] text-sm">
            {share.copy}
          </Button>
        </div>
      )}
      {stopError && <div className="mb-3.5"><ErrorBanner {...stopError} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="inlineDanger" onClick={() => void stop()} disabled={stopping}>{share.stop}</Button>
        <Button
          variant="inline"
          onClick={onClose}
          className="px-2 py-1.5 text-navy-soft"
        >
          {share.close}
        </Button>
      </div>
    </Modal>
  );
}
