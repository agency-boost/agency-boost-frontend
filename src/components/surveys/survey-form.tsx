'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Boost } from '@/components/boost';
import { Button, ErrorBanner, buttonClass } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useHostToast } from '@/components/ui/toast';
import { isImpersonating, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  SURVEY_STATES, answered, readForm, refreshPending, saveAnswer, scaleOf, submitSurvey, type AnswerValue, type FormQuestion,
  type SurveyForm,
} from '@/lib/surveys';
import { useSurveyWords } from './survey-words';

/**
 * **`/surveys/[runId]` — the form** (C-R6, C-R8, C-R9; ADR-0216 §5; `survey-reminder-user-2026-11-03.html`, `form()` and
 * `thanks()`): one question a screen.
 *
 * - **The head**: ✕ — *"Tersimpan. Lanjutkan dari Lainnya."* as it closes — and *Tersimpan otomatis*; the run's name; a
 *   progress bar; *"Pertanyaan n dari M · ditutup <tanggal>"*.
 * - **The screen**, by the question's type: 0 to 10 with *0 · Sangat tidak mungkin* and *10 · Sangat mungkin* and *Kenapa?
 *   (opsional)*; the open question's box; Q4's choices and note; 1-to-5 or *Konsisten / Tidak konsisten / Tidak
 *   dilakukan* per item; *Ya / Tidak*; the areas per downline leader; *Dukungan leader* 0 to 10 with its reason.
 * - **The notice**, the run's: *"Anonim. KPM hanya melihat ringkasan, bukan nama Anda."* or B-R4's.
 * - **The foot**: *Kembali*, *Lanjut*, *Kirim* on the last screen — waiting for a required answer.
 *
 * ***Tersimpan otomatis*** (C-R6): a choice is saved as it is made, a text as the screen is left. It opens at the first
 * question not answered. **A view-as session** reads the questions with no saved answer and can save nothing.
 */
export function SurveyFormScreen({ runId }: { runId: string }) {
  const { t, name, day, pair } = useSurveyWords();
  const router = useRouter();
  const toast = useHostToast();
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const dirty = useRef<Set<string>>(new Set());
  const viewOnly = isImpersonating();

  useEffect(() => {
    let live = true;
    readForm(runId)
      .then((next) => {
        if (!live) return;
        setForm(next);
        setAnswers(next.answers);
        setIndex(next.resumeIndex);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [runId]);

  if (error) return <ErrorBanner {...error} />;
  if (!form) {
    return (
      <Skeleton label={t.loading}>
        <div className="max-w-[560px] space-y-3"><SkeletonBar className="h-5 w-1/2" /><SkeletonBar className="h-24" /></div>
      </Skeleton>
    );
  }

  if (sent || form.state === 'submitted') {
    return (
      <div data-survey-thanks="" className="mx-auto max-w-[420px] py-16 text-center">
        <Boost pose="celebrating" size={64} className="mx-auto" />
        <h2 className="mt-3.5 text-xl font-bold text-navy">{t.form.thanks}</h2>
        <p className="mt-1.5 text-md text-muted">{t.form.thanksLine}</p>
        <Link href="/home" className={buttonClass('primary', 'mt-4')}>{t.form.backHome}</Link>
      </div>
    );
  }
  if (form.state === 'closed') {
    return (
      <div data-survey-closed="" className="mx-auto max-w-[420px] py-16 text-center">
        <h2 className="text-xl font-bold text-navy">{t.form.closed}</h2>
        <p className="mt-1.5 text-md text-muted">{t.form.closedLine({ date: day(form.run.closesOn, true) })}</p>
        <Link href="/surveys" className={buttonClass('secondary', 'mt-4')}>{t.title}</Link>
      </div>
    );
  }

  const questions = form.questions;
  const question = questions[Math.min(index, questions.length - 1)];
  const last = index >= questions.length - 1;
  const value = answers[question.kode];
  const ready = !question.required || answered(question, value);

  /** Save what changed on this screen, once. Nothing in a view-as session. */
  const flush = async (kode: string, next?: AnswerValue) => {
    const v = next ?? answers[kode];
    if (viewOnly || !v || !dirty.current.has(kode)) return;
    dirty.current.delete(kode);
    await saveAnswer(form.run.runId, kode, v);
  };
  const change = (next: AnswerValue, saveNow: boolean) => {
    setAnswers((all) => ({ ...all, [question.kode]: next }));
    dirty.current.add(question.kode);
    if (saveNow) void flush(question.kode, next).catch((err) => setError(toDisplayError(err)));
  };
  const move = async (to: number) => {
    try {
      await flush(question.kode);
      setIndex(to);
    } catch (err) {
      setError(toDisplayError(err));
    }
  };
  const close = async () => {
    try {
      await flush(question.kode);
    } finally {
      void refreshPending();
      toast?.(t.form.savedToast);
      router.push('/home');
    }
  };
  const send = async () => {
    setSending(true);
    try {
      await flush(question.kode);
      await submitSurvey(form.run.runId);
      setSent(true);
      void refreshPending();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSending(false);
    }
  };

  const done = questions.filter((q) => answered(q, answers[q.kode])).length;
  return (
    <div data-survey-form={form.run.runId} className="mx-auto max-w-[560px] pb-28">
      <div className="flex h-12 items-center justify-between">
        <button
          type="button"
          onClick={() => void close()}
          aria-label={t.form.close}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-pill-grey text-pill-grey-ink"
        >
          <NavIcon name="close" className="h-5 w-5" />
        </button>
        <span className="text-xs text-muted">{t.form.savedAuto}</span>
      </div>
      <h2 className="text-lg font-bold text-ink">{name(form.run.kind, form.run.periodKey)}</h2>
      <div aria-hidden="true" className="mb-1 mt-2 h-1.5 overflow-hidden rounded-pill bg-hairline">
        <i className="block h-full bg-primary" style={{ width: `${Math.round((done / Math.max(1, questions.length)) * 100)}%` }} />
      </div>
      <p className="text-xs text-muted">{t.form.progress({ n: index + 1, m: questions.length, date: day(form.run.closesOn) })}</p>
      {viewOnly && <p className="mt-2 rounded-row bg-pill-grey px-2.5 py-2 text-xs text-ink">{t.form.viewOnly}</p>}

      {question.blockTitle && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{pair(question.blockTitle)}</p>}
      <h3 id={`q-${question.kode}`} className="mb-3.5 mt-1.5 text-lg font-bold leading-snug text-ink">{pair(question.text)}</h3>

      <QuestionInput
        question={question}
        value={value}
        disabled={viewOnly}
        downline={form.downlineLeaders}
        onChange={change}
      />

      {form.run.notice && (
        <p data-survey-notice={form.run.notice} className="mt-3 rounded-row bg-card px-2.5 py-2 text-xs text-muted">
          {form.run.notice === 'anonymous' ? t.form.noticeAnonymous : t.form.noticePerPerson}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-divider bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0">
        <Button variant="secondary" disabled={index === 0} onClick={() => void move(index - 1)}>{t.form.back}</Button>
        {last ? (
          <Button className="flex-1 justify-center" disabled={!ready || sending || viewOnly} onClick={() => void send()}>
            {sending ? t.form.sending : t.form.send}
          </Button>
        ) : (
          <Button className="flex-1 justify-center" disabled={!ready && !viewOnly} onClick={() => void move(index + 1)}>{t.form.next}</Button>
        )}
      </div>
    </div>
  );
}

/** One screen's control, by its question's type. */
function QuestionInput({
  question, value, disabled, downline, onChange,
}: {
  question: FormQuestion;
  value: AnswerValue | undefined;
  disabled: boolean;
  downline: SurveyForm['downlineLeaders'];
  onChange: (next: AnswerValue, saveNow: boolean) => void;
}) {
  const { t, pair } = useSurveyWords();
  const uid = useId();
  const v = value ?? {};
  const text = (key: string, label: string) => (
    <>
      <label htmlFor={`${uid}-${key}`} className="mt-3.5 block text-xs text-muted">{label}</label>
      <textarea
        id={`${uid}-${key}`}
        disabled={disabled}
        value={typeof v[key] === 'string' ? (v[key] as string) : ''}
        onChange={(e) => onChange({ ...v, [key]: e.target.value }, false)}
        className="mt-1 min-h-[84px] w-full rounded-[14px] border border-hairline bg-card px-3 py-2.5 text-md text-ink"
      />
    </>
  );

  switch (question.type) {
    case 'score':
    case 'support':
      return (
        <>
          <ScoreRow
            values={scaleOf(question.scale)}
            chosen={typeof v.score === 'number' ? v.score : null}
            label={t.form.scale}
            disabled={disabled}
            onPick={(score) => onChange({ ...v, score }, true)}
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>{question.type === 'score' ? t.form.low : t.form.supportLow}</span>
            <span>{question.type === 'score' ? t.form.high : t.form.supportHigh}</span>
          </div>
          {question.type === 'score' && question.askWhy && text('why', t.form.why)}
          {question.type === 'support' && text('reason', t.form.reason)}
        </>
      );
    case 'text':
      return (
        <textarea
          aria-label={t.form.answer}
          disabled={disabled}
          value={typeof v.text === 'string' ? v.text : ''}
          onChange={(e) => onChange({ text: e.target.value }, false)}
          className="min-h-[84px] w-full rounded-[14px] border border-hairline bg-card px-3 py-2.5 text-md text-ink"
        />
      );
    case 'aspiration': {
      const chosen = Array.isArray(v.chosen) ? (v.chosen as string[]) : [];
      const toggle = (kode: string, exclusive: boolean) => {
        const on = chosen.includes(kode);
        const next = on ? chosen.filter((c) => c !== kode)
          : exclusive ? [kode]
            : [...chosen.filter((c) => !question.items.find((i) => i.kode === c)?.exclusive), kode];
        onChange({ ...v, chosen: next }, true);
      };
      return (
        <>
          <p className="mb-2 text-xs text-muted">{t.form.many}</p>
          <ul className="space-y-1.5">
            {question.items.map((item) => (
              <li key={item.kode}>
                <label className="flex min-h-11 items-center gap-2.5 rounded-row border border-hairline bg-card px-3 text-md text-ink">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={chosen.includes(item.kode)}
                    onChange={() => toggle(item.kode, item.exclusive === true)}
                  />
                  <span className="flex-1">{pair(item.label)}</span>
                  {item.exclusive && <span className="text-xs text-muted">{t.form.onlyAlone}</span>}
                </label>
              </li>
            ))}
          </ul>
          {text('note', t.form.note)}
        </>
      );
    }
    case 'scale_items':
    case 'unit_items':
      return (
        <ul className="space-y-3">
          {question.items.map((item) => (
            <li key={item.kode}>
              <p className="mb-1 text-md text-ink">{pair(item.label)}</p>
              <ScoreRow
                values={scaleOf(question.scale)}
                chosen={typeof v[item.kode] === 'number' ? (v[item.kode] as number) : null}
                label={pair(item.label)}
                disabled={disabled}
                onPick={(n) => onChange({ ...v, [item.kode]: n }, true)}
                compact
              />
            </li>
          ))}
        </ul>
      );
    case 'state_items':
      return (
        <ul className="space-y-3">
          {question.items.map((item) => (
            <li key={item.kode} role="radiogroup" aria-label={pair(item.label)}>
              <p className="mb-1 text-md text-ink">{pair(item.label)}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SURVEY_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    role="radio"
                    aria-checked={v[item.kode] === state}
                    disabled={disabled}
                    onClick={() => onChange({ ...v, [item.kode]: state }, true)}
                    className={cn(
                      'min-h-11 rounded-row border px-1.5 text-xs font-semibold',
                      v[item.kode] === state ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
                    )}
                  >
                    {t.states[state]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      );
    case 'downline_yes_no':
      return (
        <div role="radiogroup" aria-labelledby={`q-${question.kode}`} className="grid grid-cols-2 gap-2">
          {(['yes', 'no'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={v.answer === a}
              disabled={disabled}
              onClick={() => onChange({ answer: a }, true)}
              className={cn('min-h-11 rounded-row border font-bold', v.answer === a ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink')}
            >
              {a === 'yes' ? t.form.yes : t.form.no}
            </button>
          ))}
        </div>
      );
    case 'downline_areas': {
      if (downline.length === 0) return <p className="text-md text-muted">{t.form.noDownline}</p>;
      const rows = Array.isArray(v.leaders) ? (v.leaders as { membershipId: string; areas: string[] }[]) : [];
      const areasOf = (id: string) => rows.find((r) => r.membershipId === id)?.areas ?? [];
      const toggle = (id: string, area: string) => {
        const now = areasOf(id);
        const next = now.includes(area) ? now.filter((a) => a !== area) : [...now, area];
        const others = rows.filter((r) => r.membershipId !== id);
        onChange({ leaders: [...others, { membershipId: id, areas: next }] }, true);
      };
      return (
        <ul className="space-y-3">
          {downline.map((leader) => (
            <li key={leader.membershipId}>
              <fieldset>
                <legend className="mb-1 text-md font-semibold text-ink">{leader.name}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {question.items.map((area) => (
                    <label key={area.kode} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 text-xs text-ink">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={areasOf(leader.membershipId).includes(area.kode)}
                        onChange={() => toggle(leader.membershipId, area.kode)}
                      />
                      {pair(area.label)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
      );
    }
  }
}

/** A row of scores, one a press: the mockup's `.scale`, 44px targets, the chosen one navy. */
function ScoreRow({
  values, chosen, label, disabled, onPick, compact = false,
}: {
  values: number[];
  chosen: number | null;
  label: string;
  disabled: boolean;
  onPick: (n: number) => void;
  compact?: boolean;
}) {
  const { t } = useSurveyWords();
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-1.5', compact ? 'grid-cols-5' : 'grid-cols-6')}>
      {values.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={chosen === n}
          aria-label={compact ? t.form.rating({ label, v: n }) : undefined}
          disabled={disabled}
          onClick={() => onPick(n)}
          className={cn(
            'h-11 rounded-[12px] border font-bold',
            chosen === n ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
