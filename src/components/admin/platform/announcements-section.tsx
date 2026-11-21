'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner, Field, Textarea } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformMessages } from '@/i18n/messages/admin-platform';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { insurersOf, listCompanies, listTenants, type Company, type TenantListRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDateTime, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  ANNOUNCEMENT_MESSAGE_MAX, listAnnouncements, previewAnnouncement, sendAnnouncement,
  type Announcement, type AnnouncementAudience, type AudienceChoice,
} from '@/lib/platform';
import { useMediaQuery } from '@/lib/use-media-query';

const AUDIENCES: readonly AnnouncementAudience[] = ['owners', 'members', 'selected'];

/** How long the count waits after the audience last changed before it asks the server. */
const COUNT_SETTLE_MS = 250;

/**
 * ***Platform* › *Pengumuman*** (P19.23-T6 AC-4; ADR-0279; frame f55).
 *
 * - ***Kepada*** — *Semua owner · Semua anggota · Pilih perusahaan / KPM*, one chosen (a radio group); the third opens a
 *   picker of companies and KPMs, and the row under it names what was chosen.
 * - ***Pesan*** — at most 500 characters, counted as typed.
 * - ***Pratinjau*** — the line each person will find in their notifications, and how many people it reaches.
 * - ***Kirim ke n owner*** — `n` the server's count for the audience as it stands (each person once, test accounts not),
 *   asked whenever the audience changes. Sent in the app; the list under it is what was sent, newest first.
 */
export function AnnouncementsSection() {
  const t = useMessages(adminPlatformMessages).announcements;
  const words = useMessages(adminPlatformMessages);
  const [choice, setChoice] = useState<AudienceChoice>({ audience: 'owners', companyIds: [], kpmIds: [] });
  const [message, setMessage] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [sent, setSent] = useState<Announcement[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [kpms, setKpms] = useState<TenantListRow[]>([]);
  const { toast, show } = useToast();

  const loadSent = useCallback(() => {
    setListError(null);
    listAnnouncements().then(setSent).catch((err) => setListError(toDisplayError(err)));
  }, []);
  useEffect(loadSent, [loadSent]);

  useEffect(() => {
    void listCompanies().then((all) => setCompanies(insurersOf(all))).catch(() => setCompanies([]));
    void listTenants().then(setKpms).catch(() => setKpms([]));
  }, []);

  const nothingChosen = choice.audience === 'selected' && choice.companyIds.length + choice.kpmIds.length === 0;

  // The count for the audience as it stands — never for *Pilih* with nothing chosen, which the server refuses.
  useEffect(() => {
    setCount(null);
    if (nothingChosen) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      previewAnnouncement(choice)
        .then((answer) => { if (live) setCount(answer.recipients); })
        .catch((err) => { if (live) setError(toDisplayError(err)); });
    }, COUNT_SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [choice, nothingChosen]);

  const trimmed = message.trim();
  const tooLong = trimmed.length > ANNOUNCEMENT_MESSAGE_MAX;
  const canSend = !sending && !nothingChosen && trimmed !== '' && !tooLong && count !== null && count > 0;
  const who = choice.audience === 'owners' ? 'owners' : 'members';

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const done = await sendAnnouncement(choice, trimmed);
      setMessage('');
      setSent((before) => [done, ...(before ?? [])]);
      show(t.sent({ n: done.recipientCount }));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSending(false);
    }
  };

  const chosenNames = [
    ...companies.filter((c) => choice.companyIds.includes(c._id)).map((c) => c.name),
    ...kpms.filter((k) => choice.kpmIds.includes(k._id)).map((k) => `${kept('KPM')} ${k.code} · ${k.branchName}`),
  ];

  return (
    <>
      <div className="rounded-lg bg-card p-4">
        <p id="announcement-to" className="mb-1.5 text-sm font-semibold text-navy">{t.to}</p>
        <div role="radiogroup" aria-labelledby="announcement-to" className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {AUDIENCES.map((audience) => {
            const on = choice.audience === audience;
            return (
              <button
                key={audience}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setError(null);
                  setChoice((c) => ({ ...c, audience }));
                  if (audience === 'selected') setPicking(true);
                }}
                className={cn(
                  'min-h-11 rounded-md border bg-card px-3.5 text-left text-base font-semibold text-navy',
                  on ? 'border-secondary ring-1 ring-secondary' : 'border-hairline hover:bg-hover-row',
                )}
              >
                {t[audience]}
              </button>
            );
          })}
        </div>
        {choice.audience === 'selected' && (
          <p className="mt-2 text-sm text-muted">
            {chosenNames.length > 0 ? chosenNames.join(' · ') : t.chosen({ n: 0 })}
          </p>
        )}

        <div className="mt-4">
          <Field label={t.message} htmlFor="announcement-message" error={tooLong ? t.counter({ n: trimmed.length, max: ANNOUNCEMENT_MESSAGE_MAX }) : undefined}>
            <Textarea
              id="announcement-message"
              rows={3}
              value={message}
              invalid={tooLong}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full"
            />
          </Field>
          <p className="mt-1 text-right text-xs text-muted" aria-live="polite">
            {t.counter({ n: trimmed.length, max: ANNOUNCEMENT_MESSAGE_MAX })}
          </p>
        </div>

        {error && <div className="mt-3"><ErrorBanner code={error.code} message={error.message} requestId={error.requestId} /></div>}

        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <Button variant="secondary" className="min-h-11" disabled={trimmed === '' || tooLong} onClick={() => setPreviewing(true)}>
            {t.preview}
          </Button>
          <Button className="min-h-11" disabled={!canSend} onClick={() => void send()}>
            {count === null ? (nothingChosen ? t.send : t.counting) : t.sendTo({ n: count, who })}
          </Button>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-md font-bold text-navy">{t.sentList}</h2>
      <SentList sent={sent} error={listError} onRetry={loadSent} retry={words.retry} failed={words.failed} loading={words.loading} />

      <Picker
        open={picking}
        companies={companies}
        kpms={kpms}
        choice={choice}
        onClose={() => setPicking(false)}
        onDone={(companyIds, kpmIds) => {
          setChoice({ audience: 'selected', companyIds, kpmIds });
          setPicking(false);
        }}
      />
      <Preview open={previewing} message={trimmed} count={count} onClose={() => setPreviewing(false)} />
      <Toast toast={toast} />
    </>
  );
}

/** What was sent, newest first: the message, and *to whom · how many · who · when*. */
function SentList({
  sent, error, onRetry, retry, failed, loading,
}: { sent: Announcement[] | null; error: ApiError | null; onRetry: () => void; retry: string; failed: string; loading: string }) {
  const t = useMessages(adminPlatformMessages).announcements;
  const figures = useFigureLanguage();
  if (error) {
    return (
      <div>
        <ErrorBanner code={error.code} message={failed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={onRetry}>{retry}</Button>
      </div>
    );
  }
  if (sent === null) {
    return (
      <Skeleton label={loading}>
        <div className="rounded-lg bg-card p-4"><SkeletonBar className="w-2/3" /><SkeletonBar className="mt-2 w-1/3" /></div>
      </Skeleton>
    );
  }
  if (sent.length === 0) return <div className="rounded-lg bg-card"><EmptyState title={t.emptySent} /></div>;
  return (
    <ul aria-label={t.sentList} className="rounded-lg bg-card [&>li+li]:border-t [&>li+li]:border-hairline">
      {sent.map((a) => (
        <li key={a.announcementId} className="px-4 py-3">
          <p className="line-clamp-2 break-words text-md font-semibold text-navy">{a.message}</p>
          <p className="mt-0.5 text-sm text-muted">
            {t.sentLine({
              who: a.audience === 'selected' && a.chosen.length ? a.chosen.join(', ') : t.audienceWords[a.audience],
              n: a.recipientCount,
              by: a.sentBy.fullName ?? a.sentBy.userId,
            })}
            {' · '}
            <time dateTime={a.sentAt}>{formatDateTime(a.sentAt, OFFICE_TIME_ZONE, figures)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** *Pilih perusahaan / KPM*: two lists of checkboxes, companies then KPMs; *Selesai* keeps the choice. */
function Picker({
  open, companies, kpms, choice, onClose, onDone,
}: {
  open: boolean;
  companies: Company[];
  kpms: TenantListRow[];
  choice: AudienceChoice;
  onClose: () => void;
  onDone: (companyIds: string[], kpmIds: string[]) => void;
}) {
  const t = useMessages(adminPlatformMessages).announcements;
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [kpmIds, setKpmIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCompanyIds(choice.companyIds);
      setKpmIds(choice.kpmIds);
    }
  }, [open, choice.companyIds, choice.kpmIds]);

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const n = companyIds.length + kpmIds.length;

  return (
    <Modal
      open={open}
      title={t.chooseTitle}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">{t.chosen({ n })}</span>
          <Button className="min-h-11 max-md:flex-1" disabled={n === 0} onClick={() => onDone(companyIds, kpmIds)}>{t.done}</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4 pb-2">
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-navy">{t.companies}</legend>
          {companies.map((c) => (
            <label key={c._id} className="flex min-h-11 items-center gap-3 text-base text-ink">
              <input type="checkbox" className="h-5 w-5 accent-secondary" checked={companyIds.includes(c._id)}
                onChange={() => toggle(companyIds, setCompanyIds, c._id)} />
              {c.name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-navy">{t.kpms}</legend>
          {kpms.map((k) => (
            <label key={k._id} className="flex min-h-11 items-center gap-3 text-base text-ink">
              <input type="checkbox" className="h-5 w-5 accent-secondary" checked={kpmIds.includes(k._id)}
                onChange={() => toggle(kpmIds, setKpmIds, k._id)} />
              <span>{`${kept('KPM')} ${k.code} · ${k.branchName}`}<span className="block text-sm text-muted">{k.companyName}</span></span>
            </label>
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

/** *Pratinjau*: the line each person will find in their notifications, and how many it reaches. */
function Preview({ open, message, count, onClose }: { open: boolean; message: string; count: number | null; onClose: () => void }) {
  const t = useMessages(adminPlatformMessages).announcements;
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  return (
    <Modal
      open={open}
      title={t.previewTitle}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={<div className="flex justify-end"><Button variant="secondary" className="min-h-11 max-md:w-full" onClick={onClose}>{t.close}</Button></div>}
    >
      <p className="mb-2 text-sm text-muted">{t.previewInbox}</p>
      <div className="rounded-md border border-hairline bg-card p-3">
        <p className="text-md font-bold text-navy">{t.previewHeading}</p>
        <p className="mt-1 whitespace-pre-line break-words text-base text-ink">{message}</p>
      </div>
      {count !== null && <p className="mt-3 pb-2 text-sm text-muted">{t.previewReach({ n: count })}</p>}
    </Modal>
  );
}
