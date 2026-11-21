'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { surveyAnalyticsMessages } from '@/i18n/messages/surveys-analytics';
import { surveyMessages } from '@/i18n/messages/surveys';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { whatsAppHref } from '@/lib/phone-number';
import {
  readPeople, readPersonAnswers, type CoachingSection, type RoleClass, type SurveyPeople, type SurveyPersonAnswers,
  type SurveyPersonRow,
} from '@/lib/surveys';
import { useMediaQuery } from '@/lib/use-media-query';
import { PillSelect, SegmentPills } from './survey-bits';
import { useSurveyWords } from './survey-words';

type Status = 'all' | 'done' | 'notYet';
const NO_GROUP = '__none__';
const ALL = '__all__';

/** *AB* and *AAB* in orange, *Agent* in grey: the role label beside every name (DESIGN-RULES). */
function RoleLabel({ roleClass }: { roleClass: RoleClass }) {
  return (
    <span className={cn('whitespace-nowrap text-sm font-extrabold', roleClass === 'agent' ? 'text-muted' : 'text-primary-ink')}>
      {roleWord(roleClass)}
    </span>
  );
}

/** *AB*, *AAB* — kept terms, the same in both languages — or *Agent*. */
const roleWord = (roleClass: RoleClass) => (roleClass === 'agent' ? 'Agent' : roleClass.toUpperCase());

/**
 * ***Analisa kualitatif › Per orang*** (P19.22-T7 AC-3; ADR-0276 §5): filters — the survey month, the informal group,
 * *Semua / Sudah / Belum* — then one row per invitee: photo, NAME, role, upline, *waktu*, *masa kerja*, *usia*, and
 * *n item* bermasalah, or *Belum menjawab* with WhatsApp. **Tapping a row opens their full answers right under it**, the
 * row highlighted; again closes them. On a phone each row is a card: the name, then one grey line *role · upline · waktu ·
 * masa kerja · usia*, the count on the right (part C).
 *
 * Who may open whom is the server's (`canOpen`): an anonymous run never, a core leader only their own downline.
 */
export function QualPeople({ runId, onRun, surveyName, closesOn }: {
  runId: string | undefined;
  onRun: (runId: string) => void;
  /** *Survei kualitatif Jun 2026*: the reminder's words. */
  surveyName: (periodKey: string) => string;
  closesOn: (periodKey: string) => string;
}) {
  const t = useMessages(surveyAnalyticsMessages);
  const s = useMessages(surveyMessages);
  const w = t.people;
  const { period } = useSurveyWords();
  const phone = useMediaQuery('phone');
  const [view, setView] = useState<SurveyPeople | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [group, setGroup] = useState<string>(ALL);
  const [status, setStatus] = useState<Status>('all');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    readPeople(runId).then((v) => { if (live) setView(v); }).catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [runId]);

  const rows = useMemo(() => (view?.people ?? []).filter((p) => (
    (group === ALL || (group === NO_GROUP ? p.groupId === null : p.groupId === group))
    && (status === 'all' || (status === 'done' ? p.answered : !p.answered))
  )), [view, group, status]);

  if (error) return <ErrorBanner {...error} />;
  if (!view) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-2"><SkeletonBar className="h-11" /><SkeletonBar className="h-48" /></div>
      </Skeleton>
    );
  }
  if (!view.run) return <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{w.none}</p>;

  const run = view.run;
  const gen = (g: number | null) => (g === null ? null : [s.coaching.generations.z, s.coaching.generations.y, s.coaching.generations.x][g]);
  const facts = (p: Pick<SurveyPersonRow, 'workStatus' | 'tenureYears' | 'age' | 'generation'>) => ({
    time: p.workStatus === 'full_time' ? w.fullTime : p.workStatus === 'part_time' ? w.partTime : w.notFilled,
    tenure: p.tenureYears === null ? w.notFilled : w.years({ n: p.tenureYears }),
    age: p.age === null ? w.notFilled : w.ageGen({ age: p.age, gen: gen(p.generation) ?? '' }),
  });
  const remindHref = (p: SurveyPersonRow) => {
    const text = w.remindOne({ name: p.name.split(' ')[0], survey: surveyName(run.periodKey), date: closesOn(run.periodKey) });
    return whatsAppHref(p.phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const right = (p: SurveyPersonRow) => (p.answered ? (
    <span className="inline-flex items-center gap-1.5">
      {p.issues !== null && <span className="rounded-pill bg-pill-red px-2.5 py-0.5 text-xs font-bold text-pill-red-ink">{w.issueCount({ n: p.issues })}</span>}
      {p.canOpen && <LineIcon name={open === p.membershipId ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 text-primary-ink" />}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-pill bg-pill-red px-2.5 py-0.5 text-xs font-bold text-pill-red-ink">{w.notAnswered}</span>
      <a
        href={remindHref(p)}
        target="_blank"
        rel="noreferrer"
        aria-label={w.whatsApp({ name: p.name })}
        className="relative flex h-11 w-11 items-center justify-center"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-whatsapp text-white"><LineIcon name="whatsapp" className="h-4 w-4" /></span>
      </a>
    </span>
  ));

  return (
    <div data-qual-people="" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PillSelect
          label={t.periodLabel}
          value={run.runId}
          options={view.runs.map((r) => ({ id: r.runId, label: period(r.periodKey) }))}
          onChange={(id) => { setOpen(null); onRun(id); }}
        />
        <PillSelect
          label={w.groupLabel}
          value={group}
          options={[{ id: ALL, label: w.allGroups }, ...view.groups.map((g) => ({ id: g.groupId, label: g.name })), { id: NO_GROUP, label: w.noGroup }]}
          onChange={setGroup}
        />
        <SegmentPills
          label={w.statusLabel}
          value={status}
          options={[{ id: 'all', label: w.status.all }, { id: 'done', label: w.status.done }, { id: 'notYet', label: w.status.notYet }]}
          onChange={setStatus}
        />
      </div>

      {!view.answersShown && <p className="rounded-row bg-pill-grey px-3 py-2 text-xs text-pill-grey-ink">{w.anonymous}</p>}
      {view.people === null ? (
        <p className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{w.summary}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
          {!phone && (
            <div className="grid grid-cols-[minmax(0,2.2fr)_0.6fr_1.4fr_1fr_0.9fr_1fr_1.4fr] gap-2 border-b border-divider px-4 py-2 text-xs font-bold text-muted" aria-hidden="true">
              <span>{w.name}</span><span>{w.role}</span><span>{w.upline}</span><span>{w.time}</span><span>{w.tenure}</span><span>{w.age}</span><span>{w.issues}</span>
            </div>
          )}
          {rows.length === 0 && <p className="px-4 py-6 text-center text-md text-muted">{w.noneMatch}</p>}
          <ul>
            {rows.map((p) => {
              const f = facts(p);
              const isOpen = open === p.membershipId;
              const toggle = () => setOpen(isOpen ? null : p.membershipId);
              const name = (
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={28} />
                  <b className="truncate text-md uppercase text-ink">{p.name}</b>
                  {phone && <RoleLabel roleClass={p.roleClass} />}
                </span>
              );
              const body = phone ? (
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    {name}
                    <span className="mt-0.5 block truncate pl-9 text-xs text-muted">
                      {[roleWord(p.roleClass), p.upline, f.time, f.tenure, f.age].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="grid grid-cols-[minmax(0,2.2fr)_0.6fr_1.4fr_1fr_0.9fr_1fr] items-center gap-2 text-md text-ink">
                  {name}
                  <RoleLabel roleClass={p.roleClass} />
                  <span className="truncate uppercase">{p.upline ?? '—'}</span>
                  <span>{f.time}</span>
                  <span>{f.tenure}</span>
                  <span>{f.age}</span>
                </span>
              );
              return (
                <li key={p.membershipId} data-person-row={p.membershipId} className="border-b border-divider last:border-0">
                  <div className={cn('flex items-center gap-2 border-l-4 px-4 py-2', isOpen ? 'border-primary bg-today' : 'border-transparent')}>
                    {p.canOpen ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? w.close({ name: p.name }) : w.open({ name: p.name })}
                        onClick={toggle}
                        className="min-h-11 min-w-0 flex-1 text-left"
                      >
                        {body}
                      </button>
                    ) : <div className="min-h-11 min-w-0 flex-1 py-1">{body}</div>}
                    <span className={cn('shrink-0', !phone && 'w-[14%] min-w-36')}>{right(p)}</span>
                  </div>
                  {isOpen && <PersonAnswers membershipId={p.membershipId} runId={run.runId} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One person's full answers, read when their row opens. */
function PersonAnswers({ membershipId, runId }: { membershipId: string; runId: string }) {
  const t = useMessages(surveyAnalyticsMessages);
  const [answers, setAnswers] = useState<SurveyPersonAnswers | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    let live = true;
    readPersonAnswers(membershipId, runId)
      .then((a) => { if (live) setAnswers(a); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipId, runId]);
  if (error) return <div className="px-4 py-3"><ErrorBanner {...error} /></div>;
  if (!answers) {
    return (
      <Skeleton label={t.loading}>
        <div className="space-y-2 px-4 py-3"><SkeletonBar className="h-16" /><SkeletonBar className="h-32" /></div>
      </Skeleton>
    );
  }
  return <PersonAnswersView answers={answers} />;
}

/**
 * **A person's answers, as the brief draws them** (P19.22-T7 AC-3): a strip of two white cards — *Waktu · Masa kerja ·
 * Usia* and *Item bermasalah* per area — Q4 as ticked options with the note, A–C on the 1–5 scale (the chosen box
 * filled: dark red at the cut-off or below, green above) or as *Konsisten / Tidak konsisten / Tidak dilakukan*, D with
 * both, *Coaching leader downline*, and Q12's score for the office. One column on a phone.
 */
export function PersonAnswersView({ answers }: { answers: SurveyPersonAnswers }) {
  const t = useMessages(surveyAnalyticsMessages);
  const s = useMessages(surveyMessages);
  const w = t.people;
  const { pair } = useSurveyWords();
  const max = answers.issueMaxRating;
  const gen = answers.person.generation === null ? '' : [s.coaching.generations.z, s.coaching.generations.y, s.coaching.generations.x][answers.person.generation];
  const time = answers.person.workStatus === 'full_time' ? w.fullTime : answers.person.workStatus === 'part_time' ? w.partTime : w.notFilled;

  const scale = (label: string, v: number | null) => (
    <span role="img" aria-label={v === null ? `${label}: —` : w.rating({ label, v })} className="flex shrink-0 gap-0.5">
      {[1, 2, 3, 4, 5].map((k) => (
        <i
          key={k}
          aria-hidden="true"
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-[4px] text-2xs not-italic',
            k === v ? (v <= max ? 'bg-pill-red-ink font-bold text-white' : 'bg-signal-green font-bold text-white') : 'bg-pill-grey text-muted',
          )}
        >
          {k}
        </i>
      ))}
    </span>
  );
  const state = (v: string | null) => (v === null ? <span className="text-xs text-muted">—</span> : (
    <span className={cn(
      'whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-bold',
      v === 'consistent' ? 'bg-pill-green text-pill-green-ink' : v === 'inconsistent' ? 'bg-pill-amber text-pill-amber-ink' : 'bg-pill-red text-pill-red-ink',
    )}
    >
      {s.states[v as 'consistent' | 'inconsistent' | 'not_done']}
    </span>
  ));
  const card = (kodes: string, title: string, hint: string, children: ReactNode, wide = false) => (
    <section key={kodes} className={cn('rounded-row bg-card p-3', wide && 'md:col-span-2')}>
      <h4 className="mb-2 flex flex-wrap items-center gap-2 text-md font-bold text-ink">
        <span className="rounded-[6px] bg-secondary px-1.5 py-0.5 text-2xs font-bold text-secondary-contrast">{kodes}</span>
        {title}
        <small className="ml-auto text-xs font-normal text-muted">{hint}</small>
      </h4>
      {children}
    </section>
  );
  const sectionCard = (x: CoachingSection) => {
    const kodes = x.questionKodes.join(' · ');
    const title = pair(x.title);
    switch (x.kind) {
      case 'scale':
        return card(kodes, title, w.scaleHint({ max }), (
          <ul className="divide-y divide-divider">
            {x.items.map((i) => <li key={i.kode} className="flex min-h-9 items-center justify-between gap-2 py-1 text-md text-ink">{pair(i.label)}{scale(pair(i.label), i.rating)}</li>)}
          </ul>
        ));
      case 'state':
        return card(kodes, title, '', (
          <ul className="divide-y divide-divider">
            {x.items.map((i) => <li key={i.kode} className="flex min-h-9 items-center justify-between gap-2 py-1 text-md text-ink">{pair(i.label)}{state(i.state)}</li>)}
          </ul>
        ));
      case 'unit':
        return card(kodes, title, w.unitHint, (
          <ul className="divide-y divide-divider">
            {x.items.map((i) => (
              <li key={i.kode} className="flex min-h-9 flex-wrap items-center justify-between gap-2 py-1 text-md text-ink">
                <span className="min-w-0 flex-1">{pair(i.label)}</span>{state(i.state)}{scale(pair(i.label), i.rating)}
              </li>
            ))}
          </ul>
        ), true);
      case 'downline':
        return card(kodes, title, w.downlineHint, (
          <ul className="divide-y divide-divider">
            <li className="flex min-h-9 items-center justify-between gap-2 py-1 text-md text-ink">
              {w.stillCoaching}
              {x.stillCoaching !== null && (
                <span className={cn('rounded-pill px-2 py-0.5 text-xs font-bold', x.stillCoaching ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-grey text-pill-grey-ink')}>
                  {x.stillCoaching ? w.yes : w.no}
                </span>
              )}
            </li>
            {x.leaders.map((l) => (
              <li key={l.membershipId ?? l.name} className="flex min-h-9 flex-wrap items-center justify-between gap-2 py-1 text-md text-ink">
                <span className="uppercase">{l.name || '—'}</span>
                <span className="flex flex-wrap gap-1">
                  {l.areas.length === 0
                    ? <span className="rounded-pill bg-pill-green px-2 py-0.5 text-xs font-bold text-pill-green-ink">{w.independent}</span>
                    : l.areas.map((a) => <b key={a.kode} className="rounded-pill bg-pill-red px-2 py-0.5 text-xs text-pill-red-ink">{pair(a.label)}</b>)}
                </span>
              </li>
            ))}
          </ul>
        ));
    }
  };

  return (
    <div data-person-answers={answers.membershipId} className="space-y-3 bg-hover-row px-3 py-3 md:px-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="grid grid-cols-3 gap-2 rounded-row bg-card p-3">
          {([['schedule', w.time, time], ['building', w.tenure, answers.person.tenureYears === null ? w.notFilled : w.years({ n: answers.person.tenureYears })],
            ['user', w.age, answers.person.age === null ? w.notFilled : w.ageGen({ age: answers.person.age, gen })]] as const).map(([icon, label, value]) => (
            <div key={label}>
              <LineIcon name={icon} className="h-4 w-4 text-primary-ink" />
              <p className="mt-1 text-2xs font-bold uppercase tracking-wide text-muted">{label}</p>
              <p className="text-md font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-row bg-card p-3">
          <p className="mb-2 flex justify-between text-2xs font-bold uppercase tracking-wide text-muted"><span>{w.problemItems}</span><span className="normal-case">{w.scoreRange({ max })}</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {answers.tiles.map((tile) => (
              <div key={tile.kode} className="rounded-row bg-pill-red px-2 py-1.5 text-pill-red-ink">
                <b className="text-[18px]">{tile.count}<small className="text-xs">/{tile.of}</small></b>
                <span className="block truncate text-xs font-semibold">{pair(tile.title).replace(/^[A-D]\.\s*/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {answers.aspiration && card(answers.aspiration.kode, t.qual.aspiration, t.qual.manyAllowed, (
        <>
          <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {answers.aspiration.options.map((o) => (
              <li key={o.kode} className={cn('flex items-center gap-2 text-md', o.chosen ? 'font-semibold text-ink' : 'text-muted')}>
                <span aria-hidden="true" className={cn('flex h-4 w-4 items-center justify-center rounded-[4px] border', o.chosen ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-card-edge')}>
                  {o.chosen && <LineIcon name="check" className="h-3 w-3" />}
                </span>
                <span>{pair(o.label)}<span className="sr-only">{o.chosen ? ' ✓' : ''}</span></span>
              </li>
            ))}
          </ul>
          {answers.aspiration.note && <p className="mt-2 rounded-row bg-hover-row px-3 py-2 text-md italic text-ink">“{answers.aspiration.note}”</p>}
        </>
      ), true)}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {answers.sections.filter((x) => x.kind === 'scale' || x.kind === 'state').map(sectionCard)}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {answers.sections.filter((x) => x.kind === 'unit' || x.kind === 'downline').map(sectionCard)}
      </div>
      {answers.support && card(answers.support.kode, t.qual.support, t.qual.supportScale, (
        <p className="flex items-center justify-between gap-2 text-md text-ink">
          {w.supportQuestion}
          <b className="text-[18px] text-navy">{answers.support.score === null ? '—' : w.supportScore({ n: answers.support.score })}</b>
        </p>
      ), true)}
    </div>
  );
}
