'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { TAP_AREA } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { useCampaignDialogHost, toggleChase } from '@/components/campaigns/campaign-list';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/lib/use-scroll-lock';
import {
  figureWords, isReservedCode, progressWords, ratioUnitsOf, readCampaign, showsChase,
  type CampaignCard, type CampaignDetail, type CampaignRequirement, type ProgressRow,
} from '@/lib/campaigns';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { ChaseButton, DialogTags, Poster, PromotionLabel } from './campaign-parts';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * **The routed dialog** (`/campaigns/[campaignCode]`; P18.5-T7 AC-4): the list's host closes it — Back, or
 * the list's own address — and takes each chase made in it.
 */
export function RoutedCampaignDialog({ code }: { code: string }) {
  const host = useCampaignDialogHost();
  return <CampaignDialog code={code} onClose={host.close} onChased={host.chased} />;
}

/**
 * **One campaign's dialog** (`renderModalContent`, `:8177-8222`; CSS `:1918-1970`): the poster with ✕, the
 * tags, *Promotion path*, the title, *📅 {duration}*, the description, *Prize*, *Requirements* and the chase.
 *
 * **A dialog, where the prototype's is a `div` over a backdrop** (row 45): named by the campaign's title,
 * the ✕ named *Close*, the focus moved into it and held there, and given back where it was when it closes.
 * ✕, the backdrop and Escape close it, and — at its own address over the list — so does Back; a link opens
 * it, and so does a typed address. The Summary's *View →* opens the same dialog in place (AC-6).
 *
 * **The requirement rows carry the reader's progress** (OD-157, ADR-0147; T8 AC-6): *"{current} of
 * {target}"*, ✓ when met, *Not uploaded yet* where a month it reads is not held — never ✕ — and *Not
 * measured yet* where nothing measures it; the months read beside the heading (D-windows). Upcoming, a row
 * is its target alone, as drawn.
 *
 * Its own states are Fills: a skeleton while it loads, an error with a retry, and not-found for a code the
 * reader's list does not hold.
 */
export function CampaignDialog({
  code, onClose, onChased,
}: {
  code: string;
  onClose: () => void;
  /** Each chase answer, so whoever opened it can update itself and say the toast. */
  onChased: (card: CampaignCard) => void;
}) {
  const t = useMessages(campaignsMessages);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [chaseError, setChaseError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // The page behind holds still while it is open (P18.96-T1 AC-2); the box scrolls, never past the screen.
  useScrollLock(true);

  useEffect(() => {
    let live = true;
    setCampaign(null);
    setMissing(false);
    setError(null);
    // `/campaigns/chasing` is the chasing list's route, not a campaign: a typed one is not found, never read.
    if (isReservedCode(code)) {
      setMissing(true);
      return () => { live = false; };
    }
    readCampaign(code)
      .then((next) => { if (live) setCampaign(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [code, attempt]);

  // Into the dialog as it opens, and back as it closes: to the card's *View details*, or wherever it was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    return () => {
      const cue = document.querySelector<HTMLElement>(
        `[data-campaign-card="${code.replace(/["\\]/g, '\\$&')}"] [data-open-campaign]`,
      );
      (cue?.closest<HTMLElement>('button, a') ?? before)?.focus?.();
    };
  }, [code]);

  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  const chase = async () => {
    if (!campaign) return;
    setBusy(true);
    setChaseError(null);
    try {
      const next = await toggleChase(campaign);
      setCampaign((current) => current && { ...current, ...next });
      onChased(next);
    } catch (err) {
      setChaseError(toDisplayError(err));
      // Ended or closed to the rung since it was read: read it again, so the dialog says so.
      if (err instanceof ApiRequestError && (err.status === 409 || err.status === 403)) setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const close = (
    <button
      type="button"
      aria-label={t.close}
      onClick={onClose}
      className={cn('absolute right-3 top-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-navy/50 text-md text-white hover:bg-navy/70', TAP_AREA)}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );

  return (
    // The backdrop closes it (`:8224-8229`); a click inside does not, so selecting its words never does.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/35 p-4 print:hidden" onClick={onClose} data-scrim>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={campaign ? titleId : undefined}
        aria-label={campaign ? undefined : t.title}
        tabIndex={-1}
        onKeyDown={keys}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100dvh-2rem)] w-[560px] max-w-full overflow-y-auto overscroll-contain rounded-[14px] bg-card shadow-modal"
      >
        {campaign ? (
          <Poster campaign={campaign} size="dialog">{close}</Poster>
        ) : (
          <div className="relative h-[60px]">{close}</div>
        )}

        <div className="px-5 pb-[26px] pt-[22px] sm:px-[26px]">
          {!campaign && !missing && !error && (
            <Skeleton label={t.loadingOne}>
              <SkeletonBar className="w-24" />
              <SkeletonBar className="mt-3 h-6 w-2/3" />
              <SkeletonText lines={3} className="mt-4" />
            </Skeleton>
          )}
          {error && (
            <div>
              <ErrorBanner {...error} />
              <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
            </div>
          )}
          {missing && (
            <div data-state="not-found">
              <p className="text-md font-semibold text-navy">{t.notFound}</p>
              <p className="mt-1 text-base text-muted">{t.notFoundHint}</p>
            </div>
          )}
          {campaign && (
            <>
              <DialogTags campaign={campaign} />
              {campaign.subtype === 'promotion' && <PromotionLabel className="mb-2" />}
              <h2 id={titleId} className="mb-1.5 font-display text-[1.1875rem] font-extrabold text-navy">{campaign.title}</h2>
              <p className="mb-4 text-[0.8125rem] text-muted">
                <span aria-hidden="true">📅 </span><strong className="font-bold text-navy">{campaign.duration}</strong>
              </p>
              {campaign.description && (
                <p className="mb-5 whitespace-pre-line text-[0.84375rem] leading-relaxed text-navy">{campaign.description}</p>
              )}
              {campaign.reward && (
                <div className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-amber/35 bg-amber/10 px-3.5 py-3">
                  <span aria-hidden="true" className="shrink-0 text-lg">🏆</span>
                  <div className="min-w-0">
                    {/* Navy on the amber wash, where the prototype's amber-dark title is 2.6:1 (row 44). */}
                    <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-navy">{t.prize}</p>
                    <p className="text-[0.84375rem] font-semibold text-navy">{campaign.reward}</p>
                  </div>
                </div>
              )}
              {campaign.requirements.length > 0 && (
                <Requirements campaign={campaign} />
              )}
              {/* No chase once the campaign has ended (P18.95-T10 AC-2): its tag says *Ended*. */}
              {showsChase(campaign, campaign.can) && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <ChaseButton
                    chasing={campaign.chasing}
                    blocked={campaign.chaseBlocked}
                    busy={busy}
                    onToggle={() => void chase()}
                    compact={false}
                  />
                </div>
              )}
              {chaseError && <div className="mt-3"><ErrorBanner {...chaseError} /></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * *Requirements* (`.req-table`, `:8203-8212`): each row its metric's name and, on the right, the target — or,
 * once the campaign runs, the reader's *"{current} of {target}"* with ✓ when met (OD-157). Where there is no
 * figure the target stays and the reason sits under it: *Not uploaded yet*, *Not measured yet*.
 */
function Requirements({ campaign }: { campaign: CampaignDetail }) {
  const t = useMessages(campaignsMessages);
  const headingId = useId();
  // A ratio requirement in the office's unit for it, as the card writes it (P18.97-T7; ADR-0174 §2).
  const { config } = useTenantConfig();
  const ratioUnits = useMemo(() => ratioUnitsOf(config?.ratios), [config]);
  // One progress row per requirement, in the requirements' order: by position, never by metric, so two
  // requirements on one metric can never share a row.
  const rows = campaign.progress?.rows ?? [];
  return (
    <section aria-labelledby={headingId} className="mb-5 border-t border-hairline">
      <h3 id={headingId} className="mb-2.5 mt-4 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-bold uppercase tracking-wide text-muted">
        {t.requirementsTitle}
        {/* The months the progress reads (D-windows): the one line a rolling or a year-to-date figure needs. */}
        {campaign.progress && (
          <span className="text-xs font-semibold normal-case tracking-normal">{campaign.progress.windowLabel}</span>
        )}
      </h3>
      <ul>
        {campaign.requirements.map((r, i) => (
          <RequirementRow key={i} requirement={r} progress={campaign.progress ? rows[i] : undefined} ratioUnit={ratioUnits.get(r.metricKey)} />
        ))}
      </ul>
    </section>
  );
}

function RequirementRow({
  requirement, progress, ratioUnit,
}: { requirement: CampaignRequirement; progress: ProgressRow | undefined; ratioUnit?: 'percent' | 'decimal' }) {
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  // A stored requirement nothing measures says so, whether or not the campaign has started.
  const words = !requirement.measured
    ? { text: t.notMeasured, met: false, figure: false }
    : progressWords(progress, ratioUnit, language, figures);
  const target = figureWords(requirement.value, requirement.unit, ratioUnit, figures, language);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0" data-requirement={requirement.metricKey}>
      <span className="min-w-0 text-[0.84375rem] font-medium text-navy">{requirement.metricName}</span>
      <span className="shrink-0 text-right">
        {words?.figure ? (
          <span className="text-[0.84375rem] font-bold text-navy">
            {words.text}
            {words.met && (
              <>
                {' '}<span aria-hidden="true" className="text-success">✓</span>
                <span className="sr-only">{t.metAfter}</span>
              </>
            )}
          </span>
        ) : (
          <>
            <span className="block text-[0.84375rem] font-bold text-navy">{target}</span>
            {words && <span className="mt-0.5 block text-xs text-muted">{words.text}</span>}
          </>
        )}
      </span>
    </li>
  );
}
