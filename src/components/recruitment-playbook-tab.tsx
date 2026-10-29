'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Textarea, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNoticeFull, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  readRecruitmentPlaybook, saveRecruitmentPlaybook,
  type PlaybookBody, type PlaybookDto, type PlaybookLimits, type PlaybookRead, type RecruitmentVocabulary,
  type Words,
} from '@/lib/recruitment-playbook';
import { useCan } from '@/lib/session';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
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

/** The form as one write sends it: every text trimmed, a type's own objections only where it has some. */
export function toBody(form: PlaybookForm, vocab: RecruitmentVocabulary): PlaybookBody {
  const trimmed = (words: Words): Words => ({ theySay: words.theySay.trim(), youSay: words.youSay.trim() });
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
        label: p.label.trim(),
        tagline: p.tagline.trim(),
        goodFitFor: p.goodFitFor.trim(),
        benefits: p.benefits.map((b) => b.trim()),
        openings: Object.fromEntries(vocab.motivations.map(({ code }) => [code, p.openings[code].trim()])),
      }];
    })),
    objections: Object.fromEntries(vocab.hesitations.map(({ code }) => [code, trimmed(form.objections[code])])),
    profileObjections,
    nextAction: form.nextAction.trim(),
  };
}

/**
 * Every text left empty, by the address the API names it by (`profiles.fresh-grad.tagline`,
 * `profileObjections.retiree.time.youSay`, …). Asked before sending: an empty field is one the server
 * refuses anyway, and saying so beside it costs no round trip.
 */
export function blankFields(form: PlaybookForm, vocab: RecruitmentVocabulary): string[] {
  const blank: string[] = [];
  const check = (path: string, value: string) => { if (value.trim() === '') blank.push(path); };
  for (const { code: type } of vocab.types) {
    const p = form.profiles[type];
    for (const key of PROFILE_TEXTS) check(`profiles.${type}.${key}`, p[key]);
    p.benefits.forEach((b, i) => check(`profiles.${type}.benefits.${i}`, b));
    for (const { code } of vocab.motivations) check(`profiles.${type}.openings.${code}`, p.openings[code]);
    for (const { code } of vocab.hesitations) {
      const own = form.profileObjections[type]?.[code];
      if (own) for (const side of SIDES) check(`profileObjections.${type}.${code}.${side}`, own[side]);
    }
  }
  for (const { code } of vocab.hesitations) {
    for (const side of SIDES) check(`objections.${code}.${side}`, form.objections[code][side]);
  }
  check('nextAction', form.nextAction);
  return blank;
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
 * What the server said is shown as it said it, in the reader's language already (P18.98-T5); a violation with no words
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
 * Who saved a playbook and when, as its sentences take them (`saved`, `conflictDetail`): the name, or `null` for the
 * one a company was given, and the moment in the reader's figures — *9 Okt 2026, 14.05*, *9 Oct 2026, 14:05*.
 */
const savedBy = (dto: PlaybookDto, figures: Language) => ({
  version: dto.version,
  name: dto.updatedBy?.name ?? null,
  when: formatNoticeFull(dto.updatedAt, OFFICE_TIME_ZONE, figures),
});

/**
 * The Company template's **Recruitment** tab (P17-T8, OD-88 → 5, ADR-0125): the company's recruitment
 * playbook, which every agent of the company builds an Attack Plan from.
 *
 * **Products' idiom, because it is Products' kind of thing**: the company's own, read live, shared by
 * every template, so it carries no draft bar and no *Publish*. Each card reads as text until *Edit* is
 * pressed, as every row on this screen does (P4-T24); what is typed is held until *Save playbook*,
 * which sends **the whole playbook in one write, pinned to the version it was read at**.
 *
 * - **A company with none** says so and offers two starts — the AgencyBoost words (the API's
 *   `defaults`, the prototype's text verbatim) or nothing. Neither saves: nothing reaches an agent
 *   until *Save playbook*.
 * - **`409 VERSION_CONFLICT`** — somebody saved first. The playbook is read again and the reader's
 *   edits stay on the screen; the amber notice this screen already uses for unsaved edits says which
 *   version is stored now and offers to load it instead. Saving pins to the version just read.
 * - **`400 VALIDATION_FAILED`** — each violation beside the field it names ({@link placeViolations}),
 *   its card opened, the first refused field focused.
 *
 * Every word is drawn as text, never as markup: the playbook is free text the agents' plan prints.
 */
export function RecruitmentPlaybookTab({
  companyId,
  onDirtyChange,
}: {
  companyId: string;
  /**
   * Told whenever edits become unsaved or stop being, so the screen can ask before another tab
   * discards them. Pass a stable function — a state setter.
   */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  // Reading is `company_template:read`; saving is its own grant (ADR-0125), so a reader who may read
  // the playbook but not write it is offered no *Save* the API would refuse.
  const canSave = useCan('recruitment_playbook:write');
  const t = useMessages(adminTemplatePlaybookMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const [read, setRead] = useState<PlaybookRead | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  /** The stored playbook the edits are pinned to: `null` while the company has none. */
  const [base, setBase] = useState<PlaybookDto | null>(null);
  /** What is on the screen: `null` while a company with none has not started one. */
  const [form, setForm] = useState<PlaybookForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** The line beside *Save playbook* after a save refused field by field. */
  const [refused, setRefused] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  /** The version somebody else saved, while the notice about it is up. */
  const [conflict, setConflict] = useState<PlaybookDto | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);

  const load = useCallback(async () => {
    try {
      const answer = await readRecruitmentPlaybook(companyId);
      setRead(answer);
      setBase(answer.playbook);
      setForm(answer.playbook ? toForm(answer.playbook.body, answer.vocabulary) : null);
      setDirty(false);
      setLoadError(null);
    } catch (err) {
      setLoadError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  // Leaving the tab takes the edits with it, so nothing is left unsaved behind it.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // After a refusal: the first marked field, now that its card is open.
  useEffect(() => {
    if (!focusFirst.current) return;
    focusFirst.current = false;
    root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  if (loadError && read === null) {
    return (
      <EmptyState
        title={t.readFailed({ message: loadError.message })}
        action={<Button onClick={() => void load()}>{t.tryAgain}</Button>}
      />
    );
  }
  if (read === null) return <SkeletonCards count={4} />;
  const vocab = read.vocabulary;

  const reset = (next: PlaybookForm | null) => {
    setForm(next);
    setDirty(false);
    setErrors({});
    setRefused(false);
    setBanner(null);
    setConflict(null);
    setOpen(new Set());
  };

  const start = (from: PlaybookBody | null) => {
    reset(toForm(from, vocab));
    setDirty(true);
  };

  /** One edit: the form changed, and whatever was said about the slots it touched goes. */
  const edit = (slots: string[], change: (now: PlaybookForm) => PlaybookForm) => {
    setForm((now) => (now ? change(now) : now));
    setDirty(true);
    setErrors((now) => {
      const touched = Object.keys(now).filter((k) => slots.some((s) => k === s || k.startsWith(`${s}.`)));
      if (touched.length === 0) return now;
      const next = { ...now };
      for (const k of touched) delete next[k];
      return next;
    });
  };

  const refuse = (found: Record<string, string>) => {
    setErrors(found);
    setRefused(true);
    setOpen((now) => new Set([...now, ...Object.keys(found).map(cardOf)]));
    focusFirst.current = true;
  };

  async function save() {
    if (!form) return;
    const blank = blankFields(form, vocab);
    if (blank.length > 0) {
      setBanner(null);
      refuse(Object.fromEntries(blank.map((slot) => [slot, t.writeThis])));
      return;
    }
    setBusy(true);
    setBanner(null);
    setRefused(false);
    setErrors({});
    try {
      const saved = await saveRecruitmentPlaybook(companyId, base?.version ?? null, toBody(form, vocab));
      setBase(saved);
      reset(toForm(saved.body, vocab));
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') {
        await readAgain(shown);
      } else if (shown.code === 'VALIDATION_FAILED') {
        const { placed, rest } = placeViolations(shown.details, errorSlots(form, vocab), language);
        const any = Object.keys(placed).length > 0;
        if (any) refuse(placed);
        if (!any) setBanner(shown);
        else if (rest.length > 0) setBanner({ ...shown, message: rest.join(' ') });
      } else {
        setBanner(shown);
      }
    } finally {
      setBusy(false);
    }
  }

  /** Somebody saved first: read what is stored now, keep the edits, and say so. */
  async function readAgain(refusal: ApiError) {
    try {
      const answer = await readRecruitmentPlaybook(companyId);
      setBase(answer.playbook);
      if (answer.playbook) setConflict(answer.playbook);
      else setBanner(refusal);
    } catch (err) {
      setBanner(toDisplayError(err));
    }
  }

  if (form === null) {
    return (
      <EmptyState
        title={t.none}
        action={canSave ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => start(read.defaults)}>{t.startFromDefaults}</Button>
            <Button variant="secondary" onClick={() => start(null)}>{t.startFromNothing}</Button>
          </div>
        ) : undefined}
      />
    );
  }

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
    <LimitsContext.Provider value={read.limits}>
    <div ref={root} className="flex flex-col gap-4">
      <Card>
        {base ? (
          <p className="text-md text-navy">
            <strong>{t.live}</strong>{' '}
            <span className="text-muted">{t.liveDetail}</span>
          </p>
        ) : (
          <p className="text-md text-navy">
            <strong>{t.notSaved}</strong>{' '}
            <span className="text-muted">{t.notSavedDetail}</span>
          </p>
        )}
        {/* Always in the page, so a save that lands is announced rather than merely redrawn. */}
        <p role="status" className={base ? 'mt-2 text-sm text-muted' : 'sr-only'}>
          {base ? t.saved(savedBy(base, figures)) : ''}
        </p>
        {canSave && <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !dirty}
            onClick={() => reset(base ? toForm(base.body, vocab) : null)}
          >
            {t.discard}
          </Button>
        </div>}
        {/* Gone once every marked field has been changed, so it never points at nothing. */}
        {refused && Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-2 text-sm font-semibold text-alert">{t.refusedFields}</p>
        )}
      </Card>

      {conflict && (
        <div role="alert" className="rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">
            <strong>{t.conflict}</strong>{' '}
            <span className="text-muted">{t.conflictDetail(savedBy(conflict, figures))}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => reset(toForm(conflict.body, vocab))}>
              {t.loadVersion({ version: conflict.version })}
            </Button>
            <Button disabled={busy} onClick={() => setConflict(null)}>{t.keepMine}</Button>
          </div>
        </div>
      )}

      {banner && <ErrorBanner {...banner} />}

      {vocab.types.map(({ code: type, label: typeLabel }) => {
        const p = form.profiles[type];
        const own = form.profileObjections[type] ?? {};
        const card = `profile:${type}`;
        const written = p.label.trim() !== '' || p.tagline.trim() !== '';
        return (
          <PlaybookCard
            key={type}
            id={`playbook-${type}`}
            title={typeLabel}
            open={open.has(card)}
            onToggle={() => toggle(card)}
            disabled={busy}
            error={errors[`profiles.${type}`]}
            summary={written ? (
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
              disabled={busy}
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
        disabled={busy}
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
            disabled={busy}
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
        disabled={busy}
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
          maxLength={read.limits.textMax}
          value={form.nextAction}
          invalid={!!errors.nextAction}
          disabled={busy}
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
