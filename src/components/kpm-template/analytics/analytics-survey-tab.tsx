'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, Card, Field, Select, Textarea, TextInput } from '@/components/ui/field';
import { ChoiceField } from '@/components/ui/rows-and-sheets';
import { TonePill } from '@/components/ui/tone-pill';
import { pairIn, type AdvancedAnalyticsConfig, type LabelPair } from '@/lib/advanced-analytics';
import { useMessages } from '@/i18n/language-provider';
import { useMediaQuery } from '@/lib/use-media-query';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';
import { Kode, NumberBox, RowHead, useContentLanguage, type AnalyticsTabProps } from './analytics-shared';

/** One question the editor dialog opens: its text in both languages, and its aspect where it has one. */
interface Editing {
  title: string;
  questions: { kode: string; text: LabelPair; aspect?: string }[];
  save: (next: { kode: string; text: LabelPair; aspect?: string }[]) => void;
}

/**
 * **Survei, the template's half** (P19.5-T1 AC-13; ADR-0216 §1): *Survei NPS* — its schedule, the run's defaults,
 * *Ingatkan 1 hari sebelum berakhir* always on (C-R10, a line, not a switch), the cut-offs with their check, the score
 * questions and the open one — and *Survei kualitatif*, its eight blocks through the same question editor.
 *
 * **A question's kode is permanent** (invariant §3): a changed text keeps it, and the dialog says what that does to the
 * comparison. A new score question takes the next free `P<n>`.
 */
export function AnalyticsSurveyTab({ config, onChange, disabled }: AnalyticsTabProps) {
  const words = useMessages(adminTemplateAnalyticsMessages);
  const t = words.surveys;
  const lang = useContentLanguage();
  const nps = config.nps;
  /** **No native select below 1024px** (P19.2-T2 AC-4; UI-134): *Jadwal*'s two as choice rows; a laptop keeps its select. */
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [cutoffs, setCutoffs] = useState({ prom: nps.promoterMin, pas: nps.passiveMin });
  const crossed = cutoffs.pas >= cutoffs.prom;

  const setNps = (change: Partial<AdvancedAnalyticsConfig['nps']>) => onChange({ ...config, nps: { ...nps, ...change } });
  const setCut = (next: { prom: number; pas: number }) => {
    setCutoffs(next);
    // Only a pair the section holds is saved: the passive cut-off below the promoter one.
    if (next.pas < next.prom) setNps({ promoterMin: next.prom, passiveMin: next.pas });
  };
  const section = (kode: 'NPS' | 'QUAL') => config.sections.find((s) => s.kode === kode)?.enabled ?? false;
  const sectionChip = (kode: 'NPS' | 'QUAL') => (
    <TonePill tone={section(kode) ? 'green' : 'grey'}>{section(kode) ? t.sectionOn : t.sectionOff}</TonePill>
  );

  const editScore = (index: number) => {
    const q = nps.questions[index];
    setEditing({
      title: t.editTitle,
      questions: [{ kode: q.kode, text: q.text, aspect: q.aspect }],
      save: ([next]) => setNps({
        questions: nps.questions.map((x, i) => (i === index ? { ...x, text: next.text, aspect: next.aspect ?? x.aspect } : x)),
      }),
    });
  };
  const addScore = () => {
    const used = new Set(nps.questions.map((q) => q.kode));
    let n = nps.questions.length + 1;
    while (used.has(`P${n}`)) n += 1;
    const kode = `P${n}`;
    setEditing({
      title: t.editTitle,
      questions: [{ kode, text: { id: t.newQuestion, en: '' }, aspect: t.otherAspect }],
      save: ([next]) => setNps({
        questions: [...nps.questions, { kode, text: next.text, aspect: next.aspect || t.otherAspect, askWhy: true }],
      }),
    });
  };
  const editOpen = () => setEditing({
    title: t.editTitle,
    questions: [{ kode: 'OPEN', text: nps.openQuestion.text }],
    save: ([next]) => setNps({ openQuestion: { kode: 'OPEN', text: next.text } }),
  });
  const editBlock = (index: number) => {
    const block = config.qualitative.blocks[index];
    setEditing({
      title: pairIn(block.title, lang),
      questions: block.questions.map((q) => ({ kode: q.kode, text: q.text })),
      save: (next) => onChange({
        ...config,
        qualitative: {
          ...config.qualitative,
          blocks: config.qualitative.blocks.map((b, i) => (i !== index ? b : {
            ...b, questions: b.questions.map((q) => ({ ...q, text: next.find((x) => x.kode === q.kode)?.text ?? q.text })),
          })),
        },
      }),
    });
  };

  const months = config.qualitative.months.map((m) => t.months[m as 6 | 12] ?? String(m)).join(` ${t.and} `);
  return (
    <>
      <RowHead title={t.npsHeading} hint={t.npsHint}>{sectionChip('NPS')}</RowHead>
      <Card className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
        {belowLaptop ? (
          <ChoiceField<'quarter' | 'half'>
            id="analytics-nps-cadence"
            label={t.cadence}
            hint={t.cadenceHelp}
            value={nps.cadence}
            disabled={disabled}
            onChange={(cadence) => setNps({ cadence })}
            options={[{ key: 'quarter', label: t.cadenceQuarter }, { key: 'half', label: t.cadenceHalf }]}
          />
        ) : (
          <Field label={t.cadence} htmlFor="analytics-nps-cadence" hint={t.cadenceHelp}>
            <Select id="analytics-nps-cadence" value={nps.cadence} disabled={disabled}
              onChange={(e) => setNps({ cadence: e.target.value as 'quarter' | 'half' })}>
              <option value="quarter">{t.cadenceQuarter}</option>
              <option value="half">{t.cadenceHalf}</option>
            </Select>
          </Field>
        )}
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-navy">{t.defaults}</legend>
          <div className="flex flex-wrap gap-1.5">
            <Check label={t.anonymous} checked={nps.defaults.anonymous} disabled={disabled}
              onChange={(v) => setNps({ defaults: { ...nps.defaults, anonymous: v } })} />
            <Check label={t.remindHalfway} checked={nps.defaults.remindHalfway} disabled={disabled}
              onChange={(v) => setNps({ defaults: { ...nps.defaults, remindHalfway: v } })} />
          </div>
          {/* C-R10: always on, so a line and never a switch. */}
          <p className="mt-1.5 text-xs text-muted">{t.remindLastDay}</p>
        </fieldset>
        <fieldset className="md:col-span-2" aria-describedby="analytics-nps-cutoffs-help">
          <legend className="mb-1 text-sm font-semibold text-navy">{t.cutoffs}</legend>
          <div className="flex flex-wrap items-center gap-3.5 text-md text-navy">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />{t.promoter}
              <NumberBox value={cutoffs.prom} min={1} max={10} label={t.promoterName} disabled={disabled} invalid={crossed}
                onValue={(n) => n !== null && setCut({ ...cutoffs, prom: n })} className="w-16" />
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber" />{t.passive}
              <NumberBox value={cutoffs.pas} min={0} max={9} label={t.passiveName} disabled={disabled} invalid={crossed}
                onValue={(n) => n !== null && setCut({ ...cutoffs, pas: n })} className="w-16" />
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-alert" />{t.detractor({ max: cutoffs.pas - 1 })}
            </span>
          </div>
          {crossed && <p role="alert" className="mt-1 text-xs font-semibold text-alert">{t.passiveBelow}</p>}
          <p id="analytics-nps-cutoffs-help" className="mt-1 text-xs text-muted">{t.cutoffsHelp}</p>
        </fieldset>
      </Card>

      <ul className="mt-3 divide-y divide-divider overflow-hidden rounded-lg border border-card-edge bg-card">
        {nps.questions.map((q, i) => (
          <li key={q.kode} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-md font-semibold text-navy">{t.numbered({ n: i + 1, text: pairIn(q.text, lang) })}</p>
              <p className="mt-0.5 text-sm text-muted">{t.scoreLine({ aspect: q.aspect })}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 md:gap-3">
              <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11" disabled={disabled} onClick={() => editScore(i)}>
                {t.edit}
              </Button>
              <Button
                variant="inline"
                className="max-md:min-h-11 max-md:min-w-11 hover:text-alert"
                disabled={disabled || nps.questions.length <= 1}
                title={nps.questions.length <= 1 ? t.lastQuestion : undefined}
                onClick={() => setNps({ questions: nps.questions.filter((_, j) => j !== i) })}
              >
                {t.remove}
              </Button>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-md font-semibold text-navy">{t.numbered({ n: nps.questions.length + 1, text: pairIn(nps.openQuestion.text, lang) })}</p>
            <p className="mt-0.5 text-sm text-muted">{t.openLine}</p>
          </div>
          <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11" disabled={disabled} onClick={editOpen}>
            {t.edit}
          </Button>
        </li>
      </ul>
      <Button variant="secondary" className="mt-2.5" disabled={disabled} onClick={addScore}>{t.addScore}</Button>

      <RowHead title={t.qualHeading} hint={t.qualHint({ months })}>{sectionChip('QUAL')}</RowHead>
      <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-card-edge bg-card">
        {config.qualitative.blocks.map((block, i) => (
          <li key={block.kode} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-md font-semibold text-navy">{pairIn(block.title, lang)} <Kode>{block.kode}</Kode></p>
              <p className="mt-0.5 text-sm text-muted">
                {t.questions({ n: block.questions.length })}
                {block.questions[0] ? ` · ${t.types[block.questions[0].type as keyof typeof t.types] ?? block.questions[0].type}` : ''}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <TonePill tone={block.audience === 'all' ? 'green' : 'grey'}>{block.audience === 'all' ? t.everyone : t.leader}</TonePill>
              <Button variant="inline" className="max-md:min-h-11 max-md:min-w-11" disabled={disabled} onClick={() => editBlock(i)}>
                {t.edit}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-sm text-muted">{t.tokens}</p>

      <QuestionDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/** A checkbox pill, as the mockup's `.seg` labels draw them. */
function Check({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md border border-hairline bg-card px-2.5 text-md text-navy md:min-h-9">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * ***Ubah pertanyaan*** (AC-13): each question's text in ID and EN, and its aspect for a score question, with the
 * mockup's warning — a changed text keeps its kode, and old results keep the old text.
 */
function QuestionDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const t = useMessages(adminTemplateAnalyticsMessages).surveys;
  const [draft, setDraft] = useState<Editing['questions']>([]);
  const [opened, setOpened] = useState<Editing | null>(null);
  if (editing !== opened) {
    setOpened(editing);
    setDraft(editing?.questions.map((q) => ({ ...q, text: { ...q.text } })) ?? []);
  }
  const set = (i: number, change: Partial<Editing['questions'][number]>) =>
    setDraft((all) => all.map((q, j) => (j === i ? { ...q, ...change } : q)));
  return (
    <Modal
      open={editing !== null}
      title={editing?.title ?? ''}
      onClose={onClose}
      className="max-w-[34rem]"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button onClick={() => {
            // An empty ID text keeps what it had, as the mockup's `saveQ` does.
            editing?.save(draft.map((q, i) => ({
              ...q, text: { id: q.text.id.trim() || editing.questions[i].text.id, en: q.text.en.trim() },
            })));
            onClose();
          }}>
            {t.save}
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        {draft.map((q, i) => (
          <div key={q.kode} className="flex flex-col gap-2.5">
            {draft.length > 1 && <Kode>{q.kode}</Kode>}
            <Field label={t.textId} htmlFor={`analytics-q-${q.kode}-id`}>
              <Textarea id={`analytics-q-${q.kode}-id`} value={q.text.id}
                onChange={(e) => set(i, { text: { ...q.text, id: e.target.value } })} />
            </Field>
            <Field label={t.textEn} htmlFor={`analytics-q-${q.kode}-en`}>
              <Textarea id={`analytics-q-${q.kode}-en`} value={q.text.en}
                onChange={(e) => set(i, { text: { ...q.text, en: e.target.value } })} />
            </Field>
            {q.aspect !== undefined && (
              <Field label={t.aspect} htmlFor={`analytics-q-${q.kode}-aspect`}>
                <TextInput id={`analytics-q-${q.kode}-aspect`} value={q.aspect} onChange={(e) => set(i, { aspect: e.target.value })} />
              </Field>
            )}
          </div>
        ))}
        <p className="text-xs text-muted">{t.editWarning}</p>
      </div>
    </Modal>
  );
}
