'use client';

import { useEffect, useState } from 'react';
import { useCoachee, useCoacheeNotFound } from '@/components/coaching-person';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readCoachingSurvey, type CoachingSection, type CoachingSurvey, type LabelPair, type SurveyState } from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

/** The known blocks' card titles and chips, as the coaching mockup writes them; any other block reads its own title. */
type KnownBlock = 'SALES' | 'RECRUIT' | 'ACTIVATION' | 'UNIT' | 'COACHING';

/**
 * **The coaching *Survei* tab** (P19.5-T4; ADR-0216 §7; B2, B4; `coaching-survey-results-2026-11-02.html`, `vSurvei`).
 *
 * - **The bar**: *Waktu* · *Masa kerja* · *Usia · Gen*, from the member list, then ***Item bermasalah*** with one count
 *   per section — red with a count, green at none.
 * - **Q4 *Aspirasi jangka panjang***: the four options, the chosen ones ticked, and the note in italics.
 * - **One card per section**, three columns on a desktop with *D. Manajemen unit* across two, two on a tablet, one on a
 *   phone (B2): *A. Penjualan* — *Penjualan tim* for a leader — *B. Rekrutmen*, *C. Aktivasi agen baru*, *D. Manajemen
 *   unit* (*Butir · Konsistensi · Nyaman 1–5*) and *Coaching leader downline*. A 1-to-5 scale has the chosen value
 *   filled, red at the run's cut-off or below, green above (AC-17); a state is a pill.
 * - **The empty states**: *"<Nama> belum mengisi survei Jun 2026"* with *"Survei ditutup <tanggal>."*; *"Survei Jun 2026
 *   dijalankan anonim"* with the mockup's line — **no answer comes over the network** for it (B4-4); *Belum ada survei*.
 *
 * **Q12 never arrives**, and nothing is sorted (B-R6). What the mockup leaves out is not built: no *Perlu bantuan*, no
 * *Jadikan tindakan*, no run picker, no comparison (ADR-0216 §9).
 */
export function CoachingSurveyTab() {
  const coachee = useCoachee();
  const notFound = useCoacheeNotFound();
  const { t, period, day, pair } = useSurveyWords();
  const [view, setView] = useState<CoachingSurvey | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    readCoachingSurvey(coachee.membershipId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) notFound();
        else if (err instanceof ApiRequestError && err.error.code === 'SURVEY_ANSWERS_HIDDEN') setHidden(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [coachee.membershipId, notFound]);

  if (hidden) return <Empty title={t.coaching.hidden} />;
  if (error) return <ErrorBanner {...error} />;
  if (!view) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-3"><SkeletonBar className="h-9 w-2/3" /><SkeletonBar className="h-28" /></div>
      </Skeleton>
    );
  }

  const first = coachee.name.split(' ')[0] ?? coachee.name;
  if (view.state === 'none') return <Empty title={t.coaching.none} line={t.coaching.noneLine} />;
  if (view.state === 'not_answered') {
    return (
      <Empty
        title={t.coaching.notAnswered({ name: first, period: period(view.run!.periodKey) })}
        line={t.coaching.closedOn({ date: day(view.run!.closesOn, true) })}
      />
    );
  }
  if (view.state === 'anonymous') {
    return <Empty title={t.coaching.anonymousTitle({ period: period(view.run!.periodKey) })} line={t.coaching.anonymousLine} />;
  }

  const person = view.person!;
  const leader = person.roleClass !== 'agent';
  const titleOf = (s: { kode: string; title: LabelPair }) => {
    const known = t.coaching.titles[s.kode as KnownBlock];
    if (s.kode === 'SALES' && leader) return t.coaching.titles.SALES_TEAM;
    return known ?? pair(s.title);
  };
  const shortOf = (s: { kode: string; title: LabelPair }) => t.coaching.short[s.kode as Exclude<KnownBlock, 'COACHING'>] ?? pair(s.title);
  const generation = person.generation === null ? null : [t.coaching.generations.z, t.coaching.generations.y, t.coaching.generations.x][person.generation];
  const max = view.issueMaxRating ?? 0;
  const cards = view.sections.filter((s) => s.kind !== 'unit');
  const unit = view.sections.find((s) => s.kind === 'unit');

  return (
    <div data-coaching-survey="" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill label={t.coaching.time}>
          {person.workStatus === 'full_time' ? t.coaching.fullTime : person.workStatus === 'part_time' ? t.coaching.partTime : t.coaching.notFilled}
        </Pill>
        <Pill label={t.coaching.tenure}>{person.tenureYears === null ? t.coaching.notFilled : t.coaching.years({ n: person.tenureYears })}</Pill>
        <Pill label={t.coaching.age}>{person.age === null ? t.coaching.notFilled : `${person.age} · ${generation}`}</Pill>
        <span className="hidden flex-1 md:block" />
        <span className="basis-full text-xs font-bold uppercase tracking-wide text-ink md:basis-auto">{t.coaching.issues}</span>
        {view.issueCounts.map((c) => (
          <span
            key={c.kode}
            data-issue-count={c.kode}
            className={cn(
              'whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold',
              c.count > 0 ? 'bg-pill-red text-pill-red-ink' : 'bg-pill-green text-pill-green-ink',
            )}
          >
            {shortOf(c)} {c.count}
          </span>
        ))}
      </div>

      {view.aspiration && (
        <section className="rounded-row border border-card-edge bg-card px-3.5 py-3">
          <CardHead kode={view.aspiration.kode} title={t.coaching.aspiration} hint={t.coaching.manyAllowed} />
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 pt-2 md:grid-cols-2">
            {view.aspiration.options.map((o) => (
              <li key={o.kode} className={cn('flex items-center gap-2.5 py-1 text-md', o.chosen ? 'text-ink' : 'text-signal-grey')}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border-[1.5px] text-xs text-secondary-contrast',
                    o.chosen ? 'border-secondary bg-secondary' : 'border-hairline',
                  )}
                >
                  {o.chosen ? '✓' : ''}
                </span>
                <span>{pair(o.label)}</span>
                {o.chosen && <span className="sr-only">✓</span>}
              </li>
            ))}
          </ul>
          {view.aspiration.note && (
            <p className="mt-1.5 rounded-row bg-hover-row px-3 py-2 text-md italic text-ink">“{view.aspiration.note}”</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.filter((s) => s.kind !== 'downline').map((s) => <SectionCard key={s.kode} section={s} title={titleOf(s)} max={max} />)}
        {unit && <SectionCard section={unit} title={titleOf(unit)} max={max} className="lg:col-span-2" />}
        {cards.filter((s) => s.kind === 'downline').map((s) => <SectionCard key={s.kode} section={s} title={titleOf(s)} max={max} />)}
      </div>
    </div>
  );
}

function Empty({ title, line }: { title: string; line?: string }) {
  return (
    <div data-coaching-survey-empty="" className="rounded-lg bg-card px-4 py-7 text-center">
      <b className="block text-lg font-bold text-ink">{title}</b>
      {line && <p className="mt-1 text-xs text-muted">{line}</p>}
    </div>
  );
}

function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-pill border border-hairline bg-card px-3.5 py-1.5 text-md font-bold text-ink">
      <i className="text-2xs font-semibold not-italic uppercase tracking-wider text-muted">{label}</i>
      {children}
    </span>
  );
}

function CardHead({ kode, title, hint }: { kode: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-divider pb-2">
      <span className="rounded-[6px] bg-ink px-1.5 py-0.5 text-2xs font-bold text-white">{kode}</span>
      <b className="text-md font-bold text-ink">{title}</b>
      {hint && <small className="ml-auto text-xs text-muted max-md:ml-0">{hint}</small>}
    </div>
  );
}

/** A 1-to-5 row with the chosen value filled: red at the cut-off or below, green above (B-R6, AC-17). */
function Scale({ value, max }: { value: number | null; max: number }) {
  const { t } = useSurveyWords();
  return (
    <span className="inline-flex shrink-0 gap-[3px]" role="img" aria-label={value === null ? '—' : t.coaching.rating({ v: value })}>
      {[1, 2, 3, 4, 5].map((k) => (
        <i
          key={k}
          aria-hidden="true"
          className={cn(
            'grid h-5 w-5 place-items-center rounded-[5px] text-2xs not-italic',
            k === value
              ? cn('font-bold text-white', value <= max ? 'bg-signal-red' : 'bg-success')
              : 'bg-hover-row text-signal-grey',
          )}
        >
          {k}
        </i>
      ))}
    </span>
  );
}

function StatePill({ state }: { state: SurveyState | null }) {
  const { t } = useSurveyWords();
  if (!state) return <span className="text-xs text-muted">—</span>;
  return (
    <span
      className={cn(
        'inline-block min-w-[112px] whitespace-nowrap rounded-pill px-2.5 py-0.5 text-center text-xs font-semibold max-md:min-w-0',
        state === 'consistent' ? 'bg-pill-green text-pill-green-ink' : state === 'inconsistent' ? 'bg-pill-amber text-pill-amber-ink' : 'bg-pill-red text-pill-red-ink',
      )}
    >
      {t.states[state]}
    </span>
  );
}

function SectionCard({ section, title, max, className }: { section: CoachingSection; title: string; max: number; className?: string }) {
  const { t, pair } = useSurveyWords();
  const kode = section.questionKodes.join(' · ');
  const row = 'flex min-h-[31px] items-center gap-2.5 border-b border-divider py-1 text-md last:border-0 max-md:flex-wrap';
  return (
    <section data-survey-section={section.kode} className={cn('rounded-row border border-card-edge bg-card px-3.5 py-3', className)}>
      <CardHead
        kode={kode}
        title={title}
        hint={section.kind === 'scale' ? t.coaching.scaleHint({ max }) : section.kind === 'downline' ? t.coaching.downlineHint : undefined}
      />
      {section.kind === 'scale' && section.items.map((i) => (
        <div key={i.kode} className={row}><span className="min-w-0 flex-1">{pair(i.label)}</span><Scale value={i.rating} max={max} /></div>
      ))}
      {section.kind === 'state' && section.items.map((i) => (
        <div key={i.kode} className={row}><span className="min-w-0 flex-1">{pair(i.label)}</span><StatePill state={i.state} /></div>
      ))}
      {section.kind === 'unit' && (
        <>
          <div className="grid min-h-6 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-divider py-1 text-2xs font-bold uppercase tracking-wide text-ink md:grid-cols-[minmax(0,1fr)_112px_auto]">
            <span>{t.coaching.unitItem}</span>
            <span className="text-center">{t.coaching.unitConsistency}</span>
            <span className="text-center max-md:hidden">{t.coaching.unitComfort}</span>
          </div>
          {section.items.map((i) => (
            <div key={i.kode} className="grid min-h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-divider py-1 text-md last:border-0 md:grid-cols-[minmax(0,1fr)_112px_auto]">
              <span className="min-w-0">{pair(i.label)}</span>
              <StatePill state={i.state} />
              <span className="max-md:col-span-2 max-md:justify-self-end"><Scale value={i.rating} max={max} /></span>
            </div>
          ))}
        </>
      )}
      {section.kind === 'downline' && (
        <>
          <div className={row}>
            <span className="min-w-0 flex-1">{t.coaching.stillCoaching}</span>
            <span className="rounded-pill bg-pill-green px-2.5 py-0.5 text-xs font-semibold text-pill-green-ink">
              {section.stillCoaching ? t.form.yes : t.form.no}
            </span>
          </div>
          {section.leaders.map((l, n) => (
            <div key={l.membershipId ?? n} className={row}>
              <span className="min-w-0 flex-1">{l.name}</span>
              <span className="flex flex-wrap justify-end gap-1.5 max-md:justify-start">
                {l.areas.length === 0
                  ? <span className="rounded-pill bg-pill-green px-2.5 py-0.5 text-xs font-semibold text-pill-green-ink">{t.coaching.independent}</span>
                  : l.areas.map((a) => (
                    <span key={a.kode} className="rounded-pill bg-pill-red px-2.5 py-0.5 text-xs font-semibold text-pill-red-ink">{pair(a.label)}</span>
                  ))}
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
