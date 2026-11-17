'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Button, Card, ErrorBanner, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataIntakeMessages } from '@/i18n/messages/product-data-intake';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatCalendarDay } from '@/lib/format';
import {
  answerIntakeQuestion, confirmIntakeCard, intakeFileLink, readIntake, rejectIntakeCard,
  type IntakeCard, type IntakeDetail, type IntakeQuestion, type IntakeSource,
} from '@/lib/product-data-intake';
import { useMediaQuery } from '@/lib/use-media-query';

/** How often a reading upload is asked again: every 2.5 s, until it leaves `reading`. */
export const INTAKE_POLL_MS = 2_500;

const STATUS_TONE: Record<string, PillTone> = {
  reading: 'grey', needs_answers: 'amber', ready: 'blue', applied: 'green', rejected: 'grey', failed: 'red',
};

/**
 * ***Yang kami pahami*: one upload, its cards and its questions** (P19.15-T3 AC-2, AC-3; ADR-0259 §4; the P1b spec §0).
 *
 * - **While it is read** the sheet says so and asks again every 2.5 s; a file that could not be read says why.
 * - **One card per product**: what kind of change, old → new for every value, each with its file, page, sheet and cell
 *   — a link to the original where it was kept — the table's gaps and a percentage's rule in plain words.
 * - **A question card per unclear point**, answered in place; *Konfirmasi* is disabled until none is open, and the
 *   server refuses it too. A confirmed card says where it went next (*Tabel premi*, *Ilustrasi*).
 * - **Read-only** for a reader who may not manage the company: the cards, no controls.
 */
export function IntakeDetailSheet({ intakeId, onClose, onChanged }: { intakeId: string; onClose: () => void; onChanged?: () => void }) {
  const t = useMessages(productDataIntakeMessages);
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const [detail, setDetail] = useState<IntakeDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await readIntake(intakeId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [intakeId]);

  useEffect(() => { void load(); }, [load]);

  // Asked again while it is read; each answer ends the wait.
  useEffect(() => {
    if (detail?.status !== 'reading') return undefined;
    const timer = setTimeout(() => { void load(); }, INTAKE_POLL_MS);
    return () => clearTimeout(timer);
  }, [detail, load]);

  const replaced = (card: IntakeCard) => {
    setDetail((now) => (now ? { ...now, cards: now.cards.map((c) => (c.id === card.id ? card : c)) } : now));
    onChanged?.();
    void load();
  };

  return (
    <Modal
      open
      title={t.detail.title}
      description={detail ? detail.files.map((f) => f.name).join(', ') : undefined}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      className="lg:max-w-3xl"
    >
      <div className="flex flex-col gap-4 pb-2">
        {error && <ErrorBanner {...error} />}
        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <TonePill tone={STATUS_TONE[detail.status] ?? 'grey'}>{t.intake.status[detail.status]}</TonePill>
              {detail.companyName && <span className="text-sm text-muted">{detail.companyName}</span>}
            </div>
            {!detail.canManage && <p className="text-sm text-muted">{t.detail.readOnly}</p>}
            {detail.status === 'reading' && <p role="status" className="text-md text-navy">{t.detail.reading}</p>}
            <FileList detail={detail} />
            {detail.status !== 'reading' && detail.cards.length === 0 && detail.status !== 'failed' && (
              <p className="text-md text-muted">{t.detail.nothing}</p>
            )}
            <ul className="flex flex-col gap-3">
              {detail.cards.map((card) => (
                <li key={card.id}>
                  <IntakeCardView intakeId={detail.id} card={card} canManage={detail.canManage} kept={detail.files} onChanged={replaced} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

function FileList({ detail }: { detail: IntakeDetail }) {
  const t = useMessages(productDataIntakeMessages).detail;
  return (
    <section aria-label={t.files}>
      <ul className="flex flex-col gap-1">
        {detail.files.map((f) => (
          <li key={f.index} className="flex flex-col text-sm">
            <span className="text-navy">
              <span className="font-semibold">{f.name}</span>
              <span className="text-muted"> · {t.fileStatus[f.status]}</span>
            </span>
            {f.status === 'failed' && f.failure && <span className="text-alert">{t.failure[f.failure] ?? t.failure.unreadable}</span>}
          </li>
        ))}
      </ul>
      {detail.failure === 'stale' && <p className="mt-1 text-sm text-alert">{t.failure.stale}</p>}
    </section>
  );
}

/** Where a value came from, in words, with a link to the original when it was kept. */
function SourceLine({ intakeId, source, kept }: { intakeId: string; source: IntakeSource; kept: boolean }) {
  const t = useMessages(productDataIntakeMessages).detail;
  const parts = [
    source.fileName,
    source.page ? t.page({ page: source.page }) : null,
    source.sheet,
    source.cell,
  ].filter(Boolean).join(' · ');
  const open = async () => {
    const { url } = await intakeFileLink(intakeId, source.file);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <p className="text-xs text-muted">
      {t.source}: {kept ? (
        <button type="button" className="underline decoration-dotted underline-offset-2 hover:text-navy" onClick={() => void open()} aria-label={t.openSource({ file: source.fileName })}>
          {parts}
        </button>
      ) : parts}
      {source.quote && <span> · “{source.quote}”</span>}
    </p>
  );
}

function IntakeCardView({
  intakeId, card, canManage, kept, onChanged,
}: { intakeId: string; card: IntakeCard; canManage: boolean; kept: IntakeDetail['files']; onChanged: (card: IntakeCard) => void }) {
  const t = useMessages(productDataIntakeMessages).detail;
  const language = useFigureLanguage();
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const isKept = (file: number) => kept.find((f) => f.index === file)?.kept ?? false;
  const open = card.questions.filter((q) => q.open);
  const decided = card.status === 'applied' || card.status === 'rejected';
  const headingId = useId();

  const act = async (what: 'confirm' | 'reject') => {
    setBusy(what);
    setError(null);
    try {
      onChanged(await (what === 'confirm' ? confirmIntakeCard : rejectIntakeCard)(intakeId, card.id));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card density="compact" aria-labelledby={headingId} role="group" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.kind[card.kind]}</p>
          <h3 id={headingId} className="text-md font-semibold text-navy">
            {card.productName ?? card.newProductName ?? card.productAsWritten ?? t.unknownProduct}
          </h3>
        </div>
        <TonePill tone={STATUS_TONE[card.status] ?? 'grey'}>{t.status[card.status]}</TonePill>
      </div>
      {card.summary && <p className="text-md text-ink">{card.summary}</p>}
      {card.effectiveFrom && <p className="text-sm text-muted">{t.from({ date: formatCalendarDay(card.effectiveFrom, language) })}</p>}
      {card.diff.length > 0 && (
        <dl className="flex flex-col gap-2">
          {card.diff.map((row) => (
            <div key={row.key} className="flex flex-col">
              <dt className="text-sm font-semibold text-navy">{row.label}</dt>
              <dd className="text-md text-ink">
                <span className="text-muted">{row.old ?? t.none}</span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> → </span>
                <span className={row.certain ? 'font-semibold' : 'font-semibold text-alert'}>{row.new ?? t.noValue}</span>
                <SourceLine intakeId={intakeId} source={row.source} kept={isKept(row.source.file)} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {card.diff.length === 0 && <SourceLine intakeId={intakeId} source={card.source} kept={isKept(card.source.file)} />}
      {card.table && card.table.gaps.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-navy">{t.gaps}</p>
          <ul className="list-disc pl-5 text-sm text-ink">{card.table.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      )}
      {card.percent && (
        <p className="text-sm text-ink"><span className="font-semibold text-navy">{t.rule}:</span> {card.percent.rule}</p>
      )}
      {card.confidence === 'low' && !decided && <p className="text-sm text-muted">{t.lowConfidence}</p>}
      {card.questions.some((q) => q.asked) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-navy">{t.questions}</p>
          {card.questions.filter((q) => q.asked).map((q) => (
            <QuestionCard key={q.id} intakeId={intakeId} itemId={card.id} question={q} editable={canManage && !decided} onAnswered={onChanged} />
          ))}
        </div>
      )}
      {card.status === 'applied' && card.appliedRef && <p role="status" className="text-sm text-success">{t.next[card.appliedRef.kind]}</p>}
      {error && <ErrorBanner {...error} />}
      {canManage && !decided && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 max-md:[&>button]:flex-1">
            <Button variant="secondary" onClick={() => void act('reject')} disabled={busy !== null}>{busy === 'reject' ? t.working : t.reject}</Button>
            <Button onClick={() => void act('confirm')} disabled={busy !== null || open.length > 0} aria-describedby={open.length ? `${headingId}-open` : undefined}>
              {busy === 'confirm' ? t.working : t.confirm}
            </Button>
          </div>
          {open.length > 0 && <p id={`${headingId}-open`} className="text-xs text-muted">{t.answerFirst}</p>}
        </div>
      )}
    </Card>
  );
}

/** **A question card**: its choices as a list to pick from, a day, a number as written, or a short text. */
function QuestionCard({
  intakeId, itemId, question, editable, onAnswered,
}: { intakeId: string; itemId: string; question: IntakeQuestion; editable: boolean; onAnswered: (card: IntakeCard) => void }) {
  const t = useMessages(productDataIntakeMessages).detail;
  const id = useId();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const choices = question.choices.length > 0 && !['date', 'type_number', 'text'].includes(question.kind);

  if (question.answer !== null) {
    const label = question.choices.find((c) => c.value === question.answer)?.label ?? question.answer;
    return (
      <div className="rounded-md bg-base p-2">
        <p className="text-sm text-ink">{question.text}</p>
        <p className="text-sm font-semibold text-navy">{t.answered({ answer: label })}</p>
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onAnswered(await answerIntakeQuestion(intakeId, itemId, question.id, value.trim()));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset className="rounded-md border border-card-edge p-2" disabled={!editable || saving}>
      <legend className="px-1 text-sm font-semibold text-ink">{question.text}</legend>
      {choices ? (
        <div className="flex flex-col gap-1">
          {question.choices.map((c) => (
            <label key={c.value} className="flex min-h-11 items-center gap-3 text-md text-navy lg:min-h-9">
              <input type="radio" name={id} className="h-4 w-4" checked={value === c.value} onChange={() => setValue(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={`${id}-input`}>
          {question.kind === 'date' ? t.date : question.kind === 'type_number' ? t.typeNumber : t.text}
          <TextInput
            id={`${id}-input`}
            type={question.kind === 'date' ? 'date' : 'text'}
            inputMode={question.kind === 'type_number' ? 'decimal' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      )}
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
      {editable && (
        <div className="mt-2 flex">
          <Button variant="secondary" onClick={() => void save()} disabled={saving || value.trim() === ''} className="max-md:flex-1">
            {saving ? t.answering : t.answer}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
