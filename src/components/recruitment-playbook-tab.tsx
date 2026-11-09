'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, Field, Textarea, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import type { ApiError } from '@/lib/api-client';
import type { PlaybookBody, PlaybookLimits, RecruitmentVocabulary, Words } from '@/lib/recruitment-playbook';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplatePlaybookMessages } from '@/i18n/messages/admin-template-playbook';
import { planMessages } from '@/i18n/messages/plan';

/** The API's bounds for this read, for every input below the tab (invariant §7: served, not mirrored). */
const LimitsContext = createContext<PlaybookLimits | null>(null);

function useLimits(): PlaybookLimits {
  const limits = useContext(LimitsContext);
  if (!limits) throw new Error('The playbook editor is drawn outside the tab that read its bounds.');
  return limits;
}

/** A profile as it is typed: the same fields as the stored one, untrimmed, with every motivation present. */
interface ProfileForm {
  label: string;
  tagline: string;
  goodFitFor: string;
  benefits: string[];
  openings: Record<string, string>;
}

/**
 * **The playbook as the screen holds it**: every candidate type, motivation and hesitation of the
 * vocabulary present (empty where nothing is written), and a type's own objections only where it has
 * one. Turned back into a {@link PlaybookBody} — trimmed, in the vocabulary's order — only to save.
 */
export interface PlaybookForm {
  profiles: Record<string, ProfileForm>;
  objections: Record<string, Words>;
  profileObjections: Record<string, Record<string, Words>>;
  nextAction: string;
}

const PROFILE_TEXTS = ['label', 'tagline', 'goodFitFor'] as const;
type ProfileText = (typeof PROFILE_TEXTS)[number];
const SIDES = ['theySay', 'youSay'] as const;

/**
 * A stored playbook — or the AgencyBoost words, or nothing — as the form the screen edits.
 *
 * Keyed by the **vocabulary**, not by what the body happens to hold, so a candidate type the body
 * lacks still draws its card (empty), and one with no benefits still offers one to write.
 */
export function toForm(body: PlaybookBody | null, vocab: RecruitmentVocabulary): PlaybookForm {
  const profiles: Record<string, ProfileForm> = {};
  const profileObjections: Record<string, Record<string, Words>> = {};
  for (const { code: type } of vocab.types) {
    const stored = body?.profiles?.[type];
    profiles[type] = {
      label: stored?.label ?? '',
      tagline: stored?.tagline ?? '',
      goodFitFor: stored?.goodFitFor ?? '',
      benefits: stored?.benefits?.length ? [...stored.benefits] : [''],
      openings: Object.fromEntries(vocab.motivations.map(({ code }) => [code, stored?.openings?.[code] ?? ''])),
    };
    const own: Record<string, Words> = {};
    for (const { code: hesitation } of vocab.hesitations) {
      const words = body?.profileObjections?.[type]?.[hesitation];
      if (words) own[hesitation] = { theySay: words.theySay ?? '', youSay: words.youSay ?? '' };
    }
    profileObjections[type] = own;
  }
  const objections = Object.fromEntries(vocab.hesitations.map(({ code }) => [code, {
    theySay: body?.objections?.[code]?.theySay ?? '',
    youSay: body?.objections?.[code]?.youSay ?? '',
  }]));
  return { profiles, objections, profileObjections, nextAction: body?.nextAction ?? '' };
}

/**
 * **The form as the draft holds it** (ADR-0210 §1): every text as typed — the server trims at *Terbitkan* — so a space
 * typed at the end of a word is not taken away before the next one arrives. A type's own objections only where it has
 * some, as {@link toBody}.
 */
export function rawBody(form: PlaybookForm, vocab: RecruitmentVocabulary): Record<string, unknown> {
  return toBody(form, vocab, (text) => text) as unknown as Record<string, unknown>;
}

/** The form as one write sends it: every text trimmed, a type's own objections only where it has some. */
export function toBody(
  form: PlaybookForm, vocab: RecruitmentVocabulary, clean: (text: string) => string = (text) => text.trim(),
): PlaybookBody {
  const trimmed = (words: Words): Words => ({ theySay: clean(words.theySay), youSay: clean(words.youSay) });
  const profileObjections: PlaybookBody['profileObjections'] = {};
  for (const { code: type } of vocab.types) {
    const own = vocab.hesitations.filter(({ code }) => form.profileObjections[type]?.[code]);
    if (own.length > 0) {
      profileObjections[type] = Object.fromEntries(
        own.map(({ code }) => [code, trimmed(form.profileObjections[type][code])]),
      );
    }
  }
  return {
    profiles: Object.fromEntries(vocab.types.map(({ code: type }) => {
      const p = form.profiles[type];
      return [type, {
        label: clean(p.label),
        tagline: clean(p.tagline),
        goodFitFor: clean(p.goodFitFor),
        benefits: p.benefits.map(clean),
        openings: Object.fromEntries(vocab.motivations.map(({ code }) => [code, clean(p.openings[code])])),
      }];
    })),
    objections: Object.fromEntries(vocab.hesitations.map(({ code }) => [code, trimmed(form.objections[code])])),
    profileObjections,
    nextAction: clean(form.nextAction),
  };
}

/**
 * Every place on the screen an error can be drawn: each field, each benefits list, each hesitation's
 * box, and each card as a whole for what names no one field of it.
 */
function errorSlots(form: PlaybookForm, vocab: RecruitmentVocabulary): Set<string> {
  const slots = new Set<string>(['objections', 'nextAction']);
  for (const { code: type } of vocab.types) {
    slots.add(`profiles.${type}`);
    for (const key of PROFILE_TEXTS) slots.add(`profiles.${type}.${key}`);
    slots.add(`profiles.${type}.benefits`);
    form.profiles[type].benefits.forEach((_, i) => slots.add(`profiles.${type}.benefits.${i}`));
    for (const { code } of vocab.motivations) slots.add(`profiles.${type}.openings.${code}`);
    for (const code of Object.keys(form.profileObjections[type] ?? {})) {
      slots.add(`profileObjections.${type}.${code}`);
      for (const side of SIDES) slots.add(`profileObjections.${type}.${code}.${side}`);
    }
  }
  for (const { code } of vocab.hesitations) {
    slots.add(`objections.${code}`);
    for (const side of SIDES) slots.add(`objections.${code}.${side}`);
  }
  return slots;
}

/**
 * **A `400 VALIDATION_FAILED`'s violations, put beside the fields they name.**
 *
 * The playbook's check answers each as `{ field, message }` — `{ field: 'body.profiles.retiree.tagline',
 * message: 'Must not be empty.' }` (`recruitment-playbook-input.ts`). The rest of the API words a
 * violation as a sentence **beginning with the field's address** (`error-catalog.md`,
 * `VALIDATION_FAILED`), as the calendar's dialog reads them, and that is read too, so a refusal from the
 * DTO layer lands as well. Either way the address is a dotted path into the body, with or without its
 * leading `body.`, and `[2]` or `['fresh-grad']` read the same as `.2`.
 *
 * A path naming something smaller than any slot (`profiles.retiree.openings`) lands on the nearest one
 * that holds it — the card, at worst. What names nothing on the screen — the version, the body as a
 * whole, a sentence with no path — is handed back for the banner, so nothing the server said is lost.
 *
 * What the server said is shown as it said it, in the reader's language already (P18.10-T5); a violation with no words
 * at all says *Refused by the server.* in `language`, the reader's (English when none is passed).
 */
export function placeViolations(
  details: Record<string, unknown> | undefined,
  slots: Set<string>,
  language: Language = SOURCE_LANGUAGE,
): { placed: Record<string, string>; rest: string[] } {
  const violations = Array.isArray(details?.violations) ? (details.violations as unknown[]) : [];
  const placed: Record<string, string> = {};
  const rest: string[] = [];
  for (const violation of violations) {
    const named = namedViolation(violation);
    if (named === null) continue;
    const slot = slotFor(
      named.field.replace(/[:,;.]+$/, '').replace(/\[['"]?([^\]'"]*)['"]?\]/g, '.$1').replace(/^body(\.|$)/, ''),
      slots,
    );
    if (slot === null) {
      rest.push(named.whole);
      continue;
    }
    const said = named.message.trim();
    placed[slot] ??= said ? said[0].toUpperCase() + said.slice(1) : messagesIn(adminTemplatePlaybookMessages, language).refused;
  }
  return { placed, rest };
}

/** A violation as its field, what was said of it, and the whole of it for a banner; `null` if neither shape. */
function namedViolation(violation: unknown): { field: string; message: string; whole: string } | null {
  if (typeof violation === 'string') {
    const [, field = '', message = ''] = /^\s*(\S+)\s*([\s\S]*)$/.exec(violation) ?? [];
    return { field, message, whole: violation };
  }
  if (violation !== null && typeof violation === 'object') {
    const { field, message } = violation as { field?: unknown; message?: unknown };
    if (typeof field !== 'string') return null;
    const said = typeof message === 'string' ? message : '';
    return { field, message: said, whole: said ? `${field} — ${said}` : field };
  }
  return null;
}

/** The deepest slot holding a path; a type's own objections, as a whole, belong to its card. */
function slotFor(path: string, slots: Set<string>): string | null {
  let parts = path.split('.').filter(Boolean);
  while (parts.length > 0) {
    const at = parts.join('.');
    if (slots.has(at)) return at;
    if (parts.length === 2 && parts[0] === 'profileObjections' && slots.has(`profiles.${parts[1]}`)) {
      return `profiles.${parts[1]}`;
    }
    parts = parts.slice(0, -1);
  }
  return null;
}

/** The card a slot sits in, so a refused field is never left inside a closed one. */
function cardOf(slot: string): string {
  const [head, type] = slot.split('.');
  if (head === 'profiles' || head === 'profileObjections') return `profile:${type}`;
  if (head === 'objections') return 'objections';
  return 'next';
}

/** An id for a slot's control: the path, with its dots made dashes. */
const idOf = (slot: string) => `playbook-${slot.replace(/\./g, '-')}`;

/**
 * **A template's *Rekrutmen* section** (P19.4-T5 AC-6; ADR-0210 §1; P17-T8, OD-88 → 5, ADR-0125): the recruitment
 * playbook every agent of a KPM made from the template builds an Attack Plan from — a card per candidate type,
 * *Objections* and *Next action*.
 *
 * **A section like every other since ADR-0210**, through the section page's `KindEditor`: what is typed goes into the
 * section's draft as it is made (`onChange`, saved by `useTemplateDrafts`), and *Terbitkan* on the draft bar publishes it
 * whole — the server checks it then, and its `400 VALIDATION_FAILED` comes back as `refusal`, each violation put beside
 * the field it names ({@link placeViolations}), its card opened, the first refused field focused. A version conflict, a
 * save that did not land and leaving with one are the draft bar's, as for every section.
 *
 * - **A template with none** (*Kosong*) says so and offers two starts — the AgencyBoost words (the read's
 *   `playbook.defaults`, the prototype's text verbatim) or nothing. Either becomes the section's draft, which reaches no
 *   agent until *Terbitkan*.
 * - **Each card reads as text until *Ubah*** is pressed, as every row of a template does (P4-T24).
 *
 * The words are kept as typed in the draft — a trailing space included, so typing is never fought — and trimmed by the
 * server when published. Every word is drawn as text, never as markup: the playbook is free text the agents' plan prints.
 */
export function RecruitmentPlaybookEditor({
  payload,
  onChange,
  playbook,
  disabled = false,
  refusal = null,
}: {
  /** The section's draft as the editor holds it: a playbook, or `{}` for *Kosong*. */
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** What the section's read serves beside it: the AgencyBoost words, the vocabulary and the bounds. */
  playbook: { defaults: PlaybookBody; vocabulary: RecruitmentVocabulary; limits: PlaybookLimits } | undefined;
  disabled?: boolean;
  /** The section's last publish refused, or `null`: a `400` is placed beside the fields it names. */
  refusal?: ApiError | null;
}) {
  const t = useMessages(adminTemplatePlaybookMessages);
  const language = useLanguage();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rest, setRest] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);
  const vocab = playbook?.vocabulary;
  const written = isWritten(payload);
  const form = vocab && written ? toForm(payload as unknown as PlaybookBody, vocab) : null;

  // A publish refused field by field: each said beside its field, its card opened, the first one focused.
  useEffect(() => {
    if (!refusal || refusal.code !== 'VALIDATION_FAILED' || !form || !vocab) {
      setErrors({});
      setRest(null);
      return;
    }
    const { placed, rest: unplaced } = placeViolations(refusal.details, errorSlots(form, vocab), language);
    setErrors(placed);
    setRest(unplaced.length > 0 ? unplaced.join(' ') : null);
    setOpen((now) => new Set([...now, ...Object.keys(placed).map(cardOf)]));
    focusFirst.current = Object.keys(placed).length > 0;
    // The form is read for its slots when the refusal arrives, not on every keystroke after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refusal, language]);

  // Once the marked fields are drawn: the first of them.
  useEffect(() => {
    if (!focusFirst.current || Object.keys(errors).length === 0) return;
    focusFirst.current = false;
    root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  if (!playbook || !vocab) return <SkeletonCards count={4} />;

  if (!form) {
    return (
      <EmptyState
        title={t.none}
        action={disabled ? undefined : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => onChange(rawBody(toForm(playbook.defaults, vocab), vocab))}>{t.startFromDefaults}</Button>
            <Button variant="secondary" onClick={() => onChange(rawBody(toForm(null, vocab), vocab))}>{t.startFromNothing}</Button>
          </div>
        )}
      />
    );
  }

  /** One edit: into the draft, and whatever was said about the slots it touched goes. */
  const edit = (slots: string[], change: (now: PlaybookForm) => PlaybookForm) => {
    onChange(rawBody(change(form), vocab));
    setErrors((now) => {
      const touched = Object.keys(now).filter((k) => slots.some((x) => k === x || k.startsWith(`${x}.`)));
      if (touched.length === 0) return now;
      const next = { ...now };
      for (const k of touched) delete next[k];
      return next;
    });
  };

  const toggle = (card: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(card)) next.delete(card);
    else next.add(card);
    return next;
  });

  const setProfile = (type: string, change: (p: ProfileForm) => ProfileForm, slots: string[]) =>
    edit(slots, (now) => ({ ...now, profiles: { ...now.profiles, [type]: change(now.profiles[type]) } }));
  const setOwn = (type: string, change: (own: Record<string, Words>) => Record<string, Words>, slots: string[]) =>
    edit(slots, (now) => ({
      ...now,
      profileObjections: { ...now.profileObjections, [type]: change(now.profileObjections[type] ?? {}) },
    }));

  return (
    <LimitsContext.Provider value={playbook.limits}>
    <div ref={root} className="flex flex-col gap-4">
      {/* Gone once every marked field has been changed, so it never points at nothing. */}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-semibold text-alert">{t.refusedFields}</p>
      )}
      {rest && <p role="alert" className="text-sm font-semibold text-alert">{rest}</p>}

      {vocab.types.map(({ code: type, label: typeLabel }) => {
        const p = form.profiles[type];
        const own = form.profileObjections[type] ?? {};
        const card = `profile:${type}`;
        const named = p.label.trim() !== '' || p.tagline.trim() !== '';
        return (
          <PlaybookCard
            key={type}
            id={`playbook-${type}`}
            title={typeLabel}
            open={open.has(card)}
            onToggle={() => toggle(card)}
            error={errors[`profiles.${type}`]}
            summary={named ? (
              <>
                <p className="mt-0.5 break-words text-md text-navy">{p.label}</p>
                <p className="break-words text-sm text-muted">{p.tagline}</p>
              </>
            ) : <p className="mt-0.5 text-sm text-muted">{t.notWritten}</p>}
          >
            <ProfileEditor
              type={type}
              profile={p}
              own={own}
              vocab={vocab}
              errors={errors}
              disabled={disabled}
              onText={(key, value) => setProfile(type, (now) => ({ ...now, [key]: value }), [`profiles.${type}.${key}`])}
              onBenefit={(index, value) => setProfile(
                type,
                (now) => ({ ...now, benefits: now.benefits.map((b, i) => (i === index ? value : b)) }),
                [`profiles.${type}.benefits.${index}`],
              )}
              onAddBenefit={() => setProfile(
                type, (now) => ({ ...now, benefits: [...now.benefits, ''] }), [`profiles.${type}.benefits`],
              )}
              onRemoveBenefit={(index) => setProfile(
                type,
                (now) => ({ ...now, benefits: now.benefits.filter((_, i) => i !== index) }),
                // The later ones move up a place, so what was said about any of them no longer fits.
                [`profiles.${type}.benefits`],
              )}
              onOpening={(motivation, value) => setProfile(
                type,
                (now) => ({ ...now, openings: { ...now.openings, [motivation]: value } }),
                [`profiles.${type}.openings.${motivation}`],
              )}
              onOwn={(hesitation, side, value) => setOwn(
                type,
                (now) => ({ ...now, [hesitation]: { ...now[hesitation], [side]: value } }),
                [`profileObjections.${type}.${hesitation}.${side}`],
              )}
              onAddOwn={(hesitation) => setOwn(
                type, (now) => ({ ...now, [hesitation]: { theySay: '', youSay: '' } }), [],
              )}
              onRemoveOwn={(hesitation) => setOwn(
                type,
                (now) => Object.fromEntries(Object.entries(now).filter(([code]) => code !== hesitation)),
                [`profileObjections.${type}.${hesitation}`],
              )}
            />
          </PlaybookCard>
        );
      })}

      <PlaybookCard
        id="playbook-objections"
        title={t.objections}
        open={open.has('objections')}
        onToggle={() => toggle('objections')}
        error={errors.objections}
        summary={<p className="mt-0.5 text-sm text-muted">{t.objectionsSummary}</p>}
      >
        {vocab.hesitations.map(({ code, label }, index) => (
          <WordsFields
            key={code}
            slot={`objections.${code}`}
            legend={label}
            words={form.objections[code]}
            errors={errors}
            disabled={disabled}
            className={index === 0 ? undefined : 'mt-4'}
            onChange={(side, value) => edit(
              [`objections.${code}.${side}`],
              (now) => ({ ...now, objections: { ...now.objections, [code]: { ...now.objections[code], [side]: value } } }),
            )}
          />
        ))}
      </PlaybookCard>

      <PlaybookCard
        id="playbook-next"
        title={t.nextAction}
        open={open.has('next')}
        onToggle={() => toggle('next')}
        summary={form.nextAction.trim()
          ? <p className="mt-0.5 break-words text-md text-navy">{form.nextAction}</p>
          : <p className="mt-0.5 text-sm text-muted">{t.notWritten}</p>}
      >
        <Textarea
          id={idOf('nextAction')}
          aria-labelledby="playbook-next-heading"
          aria-describedby={errors.nextAction ? `${idOf('nextAction')}-error` : undefined}
          rows={2}
          className="w-full"
          maxLength={playbook.limits.textMax}
          value={form.nextAction}
          invalid={!!errors.nextAction}
          disabled={disabled}
          onChange={(e) => edit(['nextAction'], (now) => ({ ...now, nextAction: e.target.value }))}
        />
        {errors.nextAction && (
          <p id={`${idOf('nextAction')}-error`} role="alert" className="mt-1 text-xs font-semibold text-alert">
            {errors.nextAction}
          </p>
        )}
      </PlaybookCard>
    </div>
    </LimitsContext.Provider>
  );
}

/** Whether a section's payload holds a playbook at all: *Kosong* is `{}`. */
const isWritten = (payload: Record<string, unknown> | null | undefined) =>
  Boolean(payload && typeof payload === 'object' && payload.profiles && typeof payload.profiles === 'object');

/**
 * One card of the playbook, as a product is one card of the catalog: its heading and what it says,
 * read as text, and *Edit* to open the fields beneath. Closing it keeps what was typed — the whole
 * playbook saves together.
 */
function PlaybookCard({
  id, title, summary, open, onToggle, disabled, error, children,
}: {
  id: string;
  title: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Said of the card as a whole: a refusal naming none of its fields. */
  error?: string;
  children: React.ReactNode;
}) {
  const t = useMessages(adminTemplatePlaybookMessages);
  const headingId = `${id}-heading`;
  const panelId = `${id}-panel`;
  return (
    // A group named by its heading, so a field inside is announced with the card it belongs to.
    <Card className="p-0" role="group" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          {/* An `h2` per card, as Products heads each product: the page's `h1` is the screen's. */}
          <h2 id={headingId} className="break-words text-md font-semibold text-navy">{title}</h2>
          {summary}
        </div>
        <Button
          variant="inline"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-describedby={headingId}
          onClick={onToggle}
        >
          {open ? t.close : t.edit}
        </Button>
      </div>
      {open && (
        <div id={panelId} className="border-t border-hairline px-4 py-4 sm:px-5">
          {error && <p role="alert" className="mb-3 text-sm font-semibold text-alert">{error}</p>}
          {children}
        </div>
      )}
    </Card>
  );
}

/** *They say* and *You say* for one hesitation, under its label. */
function WordsFields({
  slot, legend, words, errors, disabled, className, onChange, action,
}: {
  /** `objections.time`, or `profileObjections.retiree.time`. */
  slot: string;
  legend: string;
  words: Words;
  errors: Record<string, string>;
  disabled?: boolean;
  className?: string;
  onChange: (side: (typeof SIDES)[number], value: string) => void;
  /** *Remove*, for a candidate type's own. */
  action?: React.ReactNode;
}) {
  const t = useMessages(adminTemplatePlaybookMessages);
  const limits = useLimits();
  return (
    // The legend is the fieldset's first child, or it stops naming the group.
    <fieldset className={className}>
      <legend className="text-sm font-bold text-navy">{legend}</legend>
      {errors[slot] && <p role="alert" className="mt-1 text-xs font-semibold text-alert">{errors[slot]}</p>}
      <Field label={t.theySay} htmlFor={idOf(`${slot}.theySay`)} error={errors[`${slot}.theySay`]} className="mt-2">
        <Textarea
          id={idOf(`${slot}.theySay`)}
          rows={2}
          maxLength={limits.textMax}
          value={words.theySay}
          invalid={!!errors[`${slot}.theySay`]}
          disabled={disabled}
          onChange={(e) => onChange('theySay', e.target.value)}
        />
      </Field>
      <Field label={t.youSay} htmlFor={idOf(`${slot}.youSay`)} error={errors[`${slot}.youSay`]} className="mt-2">
        <Textarea
          id={idOf(`${slot}.youSay`)}
          rows={3}
          maxLength={limits.textMax}
          value={words.youSay}
          invalid={!!errors[`${slot}.youSay`]}
          disabled={disabled}
          onChange={(e) => onChange('youSay', e.target.value)}
        />
      </Field>
      {action && <div className="mt-2">{action}</div>}
    </fieldset>
  );
}

/**
 * One candidate type opened for editing: what the plan prints for it, in the plan's order — label and
 * tagline, *Good fit for*, the benefits, an opening per motivation — then its own objections.
 *
 * **Benefits are rows, not lines of one box**: the API takes one to the API's `limits.benefitsMax`, so
 * a row is added up to that and the last one left cannot be removed, each saying why rather than
 * failing on save — as the commission editor stops adding years.
 */
function ProfileEditor({
  type, profile, own, vocab, errors, disabled,
  onText, onBenefit, onAddBenefit, onRemoveBenefit, onOpening, onOwn, onAddOwn, onRemoveOwn,
}: {
  type: string;
  profile: ProfileForm;
  own: Record<string, Words>;
  vocab: RecruitmentVocabulary;
  errors: Record<string, string>;
  disabled?: boolean;
  onText: (key: ProfileText, value: string) => void;
  onBenefit: (index: number, value: string) => void;
  onAddBenefit: () => void;
  onRemoveBenefit: (index: number) => void;
  onOpening: (motivation: string, value: string) => void;
  onOwn: (hesitation: string, side: (typeof SIDES)[number], value: string) => void;
  onAddOwn: (hesitation: string) => void;
  onRemoveOwn: (hesitation: string) => void;
}) {
  const t = useMessages(adminTemplatePlaybookMessages);
  const plan = useMessages(planMessages);
  const limits = useLimits();
  const at = (key: string) => `profiles.${type}.${key}`;
  const hidden = (words: string) => <span className="sr-only">{words}</span>;
  const full = profile.benefits.length >= limits.benefitsMax;
  const fullId = `${idOf(at('benefits'))}-full`;
  const addOwnId = `playbook-${type}-add-own`;
  const ownCodes = vocab.hesitations.filter(({ code }) => own[code]);
  const notOwn = vocab.hesitations.filter(({ code }) => !own[code]);

  const text = (key: ProfileText, label: string, lines?: number) => (
    <Field label={label} htmlFor={idOf(at(key))} error={errors[at(key)]} className="min-w-60 flex-1">
      {lines ? (
        <Textarea
          id={idOf(at(key))}
          rows={lines}
          maxLength={limits.textMax}
          value={profile[key]}
          invalid={!!errors[at(key)]}
          disabled={disabled}
          onChange={(e) => onText(key, e.target.value)}
        />
      ) : (
        <TextInput
          id={idOf(at(key))}
          maxLength={limits.textMax}
          value={profile[key]}
          invalid={!!errors[at(key)]}
          disabled={disabled}
          onChange={(e) => onText(key, e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {text('label', t.label)}
        {text('tagline', t.tagline)}
      </div>
      <div className="mt-3 flex">{text('goodFitFor', plan.goodFitFor, 2)}</div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">{t.benefits}</legend>
        {errors[at('benefits')] && (
          <p role="alert" className="mt-1 text-xs font-semibold text-alert">{errors[at('benefits')]}</p>
        )}
        <ol className="mt-1 flex flex-col gap-2">
          {profile.benefits.map((benefit, index) => {
            const slot = at(`benefits.${index}`);
            const error = errors[slot];
            return (
              // Keyed by place: a benefit has no identity but its place, and every field is controlled.
              <li key={index} className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Textarea
                    id={idOf(slot)}
                    aria-label={t.benefit({ n: index + 1 })}
                    aria-describedby={error ? `${idOf(slot)}-error` : undefined}
                    rows={2}
                    maxLength={limits.textMax}
                    value={benefit}
                    invalid={!!error}
                    disabled={disabled}
                    onChange={(e) => onBenefit(index, e.target.value)}
                  />
                  {error && (
                    <p id={`${idOf(slot)}-error`} role="alert" className="text-xs font-semibold text-alert">{error}</p>
                  )}
                </div>
                <Button
                  variant="inlineDanger"
                  className="mt-2"
                  disabled={disabled || profile.benefits.length <= 1}
                  title={profile.benefits.length <= 1 ? t.oneBenefit : undefined}
                  onClick={() => onRemoveBenefit(index)}
                >
                  {t.removeBenefit({ n: index + 1, hidden })}
                </Button>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="inline"
            disabled={disabled || full}
            aria-describedby={full ? fullId : undefined}
            onClick={onAddBenefit}
          >
            {t.addBenefit}
          </Button>
          {full && (
            <p id={fullId} className="m-0 text-xs text-muted">{t.mostBenefits({ max: limits.benefitsMax })}</p>
          )}
        </div>
      </fieldset>

      <h3 className="mt-5 font-display text-md font-bold text-navy">{plan.openingLines}</h3>
      {vocab.motivations.map(({ code, label }) => {
        const slot = at(`openings.${code}`);
        return (
          <Field key={code} label={label} htmlFor={idOf(slot)} error={errors[slot]} className="mt-3">
            <Textarea
              id={idOf(slot)}
              rows={2}
              maxLength={limits.textMax}
              value={profile.openings[code]}
              invalid={!!errors[slot]}
              disabled={disabled}
              onChange={(e) => onOpening(code, e.target.value)}
            />
          </Field>
        );
      })}

      <h3 className="mt-5 font-display text-md font-bold text-navy">{t.ownObjections}</h3>
      <p className="text-sm text-muted">{t.ownObjectionsHint}</p>
      {ownCodes.map(({ code, label }) => (
        <WordsFields
          key={code}
          slot={`profileObjections.${type}.${code}`}
          legend={label}
          words={own[code]}
          errors={errors}
          disabled={disabled}
          className="mt-3"
          onChange={(side, value) => onOwn(code, side, value)}
          action={(
            <Button variant="inlineDanger" disabled={disabled} onClick={() => onRemoveOwn(code)}>
              {t.removeOwn({ label, hidden })}
            </Button>
          )}
        />
      ))}
      {notOwn.length > 0 && (
        <div className="mt-3">
          <p id={addOwnId} className="text-sm font-semibold text-navy">{t.addOwnFor}</p>
          <div role="group" aria-labelledby={addOwnId} className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {notOwn.map(({ code, label }) => (
              <Button key={code} variant="inline" disabled={disabled} onClick={() => onAddOwn(code)}>
                + {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
