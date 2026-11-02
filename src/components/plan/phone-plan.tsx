'use client';

import { useId, useState, type ReactNode, type Ref } from 'react';
import { TEXT_TAP } from '@/components/ui/phone';
import { useMessages } from '@/i18n/language-provider';
import { planMessages } from '@/i18n/messages/plan';
import { cn } from '@/lib/cn';
import { PlanIcon } from './plan-icons';

/**
 * **A plan's second step on a phone** (UI V1, UI-107; `attack-plan-mobile` 3 and 5; Mobile only): the parts the Sales
 * Attack Plan and the Recruitment Attack Plan both draw below 768px — the brief's answers as chips with *Ubah*, the
 * product or the candidate in a navy card, then numbered white sections with sentence-case headings, the long list and
 * the full script folded, the push-back as two bubbles. From 768px each screen draws its plan as before
 * (`script-blocks.tsx`).
 *
 * Presentational, as the other parts in this folder are: every word that is content comes in by props and is rendered as
 * text; the frame's own words are `messages/plan.ts`'.
 */

/** The brief's answers as chips, and *Ubah* back to the brief (the step's pill and *‹ Back* above 768px). */
export function PhoneAnswers({ label, answers, onChange }: {
  /** Names the list for a screen reader: the step's own name. */
  label: string;
  answers: readonly string[];
  onChange: () => void;
}) {
  const p = useMessages(planMessages);
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5" data-part="answers">
      <ul aria-label={label} className="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0">
        {answers.map((answer) => (
          <li key={answer} className="flex h-[1.875rem] items-center rounded-pill bg-card px-2.5 text-sm font-semibold text-ink">
            {answer}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onChange}
        className={cn('ml-auto flex items-center gap-0.5 rounded-sm px-1 text-base font-bold text-navy', TEXT_TAP)}
      >
        {p.change}
        <PlanIcon name="chevronRight" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A tag on the navy card: the need, the channel, *Profil kandidat*. */
export function NavyTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-pill bg-white/[0.14] px-2 py-0.5 text-sm font-semibold text-white">{children}</span>;
}

/** The verdict on the navy card, a word as well as a tint: *Cocok* green, *Cek kecocokan* amber, the rest muted. */
export function NavyVerdict({ tone, children }: { tone: 'good' | 'check' | 'neutral'; children: ReactNode }) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-sm font-bold',
        tone === 'good' && 'bg-on-navy-green text-navy',
        tone === 'check' && 'bg-amber text-navy',
        tone === 'neutral' && 'bg-white/[0.14] text-white',
      )}
    >
      {tone === 'good' && <PlanIcon name="check" className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/**
 * The product or the candidate, in a navy card: its tags and the verdict, its name — the result's heading, which takes
 * the focus once the plan is drawn — its line, and *Cocok untuk* with the fit.
 */
export function NavyHead({ tags, verdict, title, headingRef, line, fitLabel, fit, note }: {
  tags: ReactNode;
  verdict: ReactNode;
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  line: string;
  fitLabel: string;
  fit: string;
  /** A warning under the line — outside the brief's bands, in run-off. */
  note?: string | null;
}) {
  return (
    <article className="rounded-lg bg-navy p-3.5 text-white" data-part="navy-head">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">{tags}</div>
        {verdict}
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="m-0 mt-2 break-words text-2xl font-extrabold text-white">{title}</h2>
      {line && <p className="m-0 mt-1 text-base leading-snug text-on-navy-muted">{line}</p>}
      {fit && (
        <p className="m-0 mt-1 text-base leading-snug text-on-navy-muted">
          <span className="font-semibold text-white">{fitLabel}</span> {fit}
        </p>
      )}
      {note && <p className="m-0 mt-2 text-base leading-snug text-on-navy-red">{note}</p>}
    </article>
  );
}

/** One numbered section: a white card, its number in an amber disc, its heading in sentence case. */
export function PhoneSection({ n, label, children }: { n?: number; label: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-2 rounded-lg bg-card p-3" data-block={n}>
      <h3 id={id} className="m-0 mb-2 flex items-center gap-2 text-md font-bold text-navy">
        {n !== undefined && (
          <span aria-hidden="true" className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-amber/[0.14] text-sm text-amber-ink">
            {n}
          </span>
        )}
        {n !== undefined && <span className="sr-only">{n} </span>}
        {label}
      </h3>
      {children}
    </section>
  );
}

/** The line to open with: italic, behind an amber rule. */
export function PhoneQuote({ text }: { text: string }) {
  return <p className="m-0 border-l-[3px] border-amber pl-2.5 text-md italic leading-normal text-ink">“{text}”</p>;
}

/** How many benefits show before *Lihat n manfaat lagi* (`attack-plan-mobile` 3: four, then the link). */
export const BENEFITS_SHOWN = 4;

/** The benefits, each behind a ticked circle; past the fourth, folded behind *Lihat n manfaat lagi*. */
export function PhoneBenefits({ items }: { items: readonly string[] }) {
  const p = useMessages(planMessages);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const hidden = items.length - BENEFITS_SHOWN;
  const shown = open || hidden <= 0 ? items : items.slice(0, BENEFITS_SHOWN);
  return (
    <>
      <ul id={listId} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {shown.map((item, i) => (
          <li key={`${i}-${item}`} className="flex gap-2 text-base leading-snug text-ink">
            <PlanIcon name="circleCheck" className="mt-px h-4 w-4 text-signal-green" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((now) => !now)}
          className={cn('mt-1.5 flex items-center gap-1 rounded-sm text-base font-bold text-navy', TEXT_TAP)}
        >
          {open ? p.showLess : p.moreBenefits({ n: hidden })}
          <PlanIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

/** The full script, folded to three lines under a fade until *Baca semua*. */
export function PhoneScript({ text }: { text: string }) {
  const p = useMessages(planMessages);
  const [open, setOpen] = useState(false);
  const textId = useId();
  return (
    <>
      <div
        id={textId}
        className={cn(
          'relative whitespace-pre-line text-base leading-normal text-ink',
          !open && 'max-h-[3.625rem] overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:bg-gradient-to-b after:from-card/0 after:to-card after:content-[\'\']',
        )}
      >
        {text}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={textId}
        onClick={() => setOpen((now) => !now)}
        className={cn('mt-1.5 flex items-center gap-1 rounded-sm text-base font-bold text-navy', TEXT_TAP)}
      >
        {open ? p.showLess : p.readAll}
        <PlanIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
      </button>
    </>
  );
}

/** What they say, and what you say back: two bubbles, *Dia berkata* to the left and *Anda menjawab* to the right. */
export function PhoneBubbles({ theySay, youSay }: { theySay: string; youSay: string }) {
  const p = useMessages(planMessages);
  return (
    <div data-part="bubbles">
      <p className="m-0 mr-7 mt-1.5 rounded-row bg-hover-row px-3 py-2.5 text-base leading-snug text-ink">
        <small className="mb-0.5 block text-sm font-bold text-muted">{p.theySaid}</small>
        “{theySay}”
      </p>
      <p className="m-0 ml-7 mt-1.5 rounded-row bg-amber/[0.14] px-3 py-2.5 text-base leading-snug text-ink">
        <small className="mb-0.5 block text-sm font-bold text-amber-ink">{p.youAnswer}</small>
        “{youSay}”
      </p>
    </div>
  );
}

/** A link at a section's foot, with a chevron: *Lihat di Product Catalog ›*, *Buka Pitch Materials ›*. */
export function PhoneMore({ children }: { children: ReactNode }) {
  return <span className="mt-1.5 flex items-center gap-1 text-base font-bold text-navy">{children}<PlanIcon name="chevronRight" className="h-4 w-4" /></span>;
}
