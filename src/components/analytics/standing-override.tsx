'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ToastHost, useHostToast } from '@/components/ui/toast';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { messagesIn } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { kpmComplianceMessages } from '@/i18n/messages/kpm-compliance';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { complianceLabels, NO_STATUS, pillOf } from '@/lib/kpm-compliance';
import {
  clearOverride, OVERRIDE_REASON_MAX, setOverride, type OverrideStatus, type StandingOverride,
} from '@/lib/standing-override';
import { CompliancePill } from './compliance-parts';

/** The cell as the compliance read serves it — only what the campaigns' *Achieved* column reads. */
export interface AchievedCellData {
  /** The registry's qualification code, the override applied; `null` unless the campaign is an ended seasonal one. */
  second?: string | null;
  override?: StandingOverride | null;
  /** A stored, final standing — a chaser's at the window's end (D-override). */
  overridable?: boolean;
}

export interface AchievedCellProps {
  row: { membershipId: string; name: string; cell: AchievedCellData };
  campaign: { code: string; title: string };
  /** The reader holds the override and is not in a read-only session (the read's `can.override`). */
  canOverride: boolean;
  /** Called after a save or a clear, so the tree is read again. */
  onChanged(): void;
}

/** The *Achieved* column's pills, in a language. */
const achievedIn = (language: Language) => complianceLabels(language).campaigns.achieved;

/** The two results an override may set, in the column's order. */
const CHOICES: readonly OverrideStatus[] = ['qualified', 'not_met'];

/**
 * The campaigns' *Achieved* column (`KPM_Owner.html:3886-3900`): the prototype's pill — *Achieved*, *Not
 * achieved* or *—* by the registry's labels — and the override of a final standing (P18.6-T2 AC-8; ADR-0144 §4;
 * D-override), which the prototype does not draw (contradiction 11).
 *
 * **The smallest footprint** (ADR-0062 §2). The pill of a stored final standing becomes the button that opens
 * the dialog (form 3), so nothing is added to the row; an overridden result carries the provenance marker beside
 * it, `ⓘ`, its words on hover, focus and tap (form 2). A read-only session, a reader without the override and a
 * member with no stored standing (a non-chaser, ADR-0143) get the plain pill: the server refuses them all the
 * same. The marker shows to every reader of the tree, since it says why the result is what it is.
 *
 * **Named by the words drawn on it, then what it opens** (WCAG 2.5.3): *"Achieved — Override Budi's result for
 * …"*. A *—* has no words to say, so it is named by what it opens alone.
 *
 * **The toast is the cell's own**, mounted with the first one (`ToastHost`), so a page whose shell holds none
 * gains a live region only when a cell has something to say.
 *
 * **Its words are the reader's** (P18.98-T4; `kpmComplianceMessages.override`), the day it was set in the figures'
 * language; the campaign's title, the member's name and the reason are shown as typed.
 */
export function AchievedCell(props: AchievedCellProps) {
  return (
    <ToastHost>
      <Cell {...props} />
    </ToastHost>
  );
}

function Cell({ row, campaign, canOverride, onChanged }: AchievedCellProps) {
  const t = useMessages(kpmComplianceMessages).override;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const raise = useHostToast();
  const [open, setOpen] = useState(false);
  const pill = pillOf(achievedIn(language), row.cell.second);
  const override = row.cell.override ?? null;
  const control = canOverride && row.cell.overridable === true;
  /** *—*: nothing drawn a voice could say, so the button is named by what it opens alone. */
  const dash = pill.label === NO_STATUS.label;

  const face = <CompliancePill words={pill} />;
  const marker = override && overriddenBy(override, language, figures);

  return (
    <>
      {/*
        No gap, and the marker's 28px target hangs 6px past the column's end: *Not achieved* and the marker then fit
        the prototype's 116px column (`:163`), the glyph's own inset keeping it clear of the pill.
      */}
      <span className="inline-flex items-center">
        {control ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="rounded-pill hover:opacity-80"
          >
            {dash ? <span aria-hidden="true">{face}</span> : face}
            <span className="sr-only">
              {dash ? '' : ' — '}
              {t.overrideFor({ name: row.name, campaign: campaign.title })}
            </span>
          </button>
        ) : face}
        {marker && <TippedGlyph glyph="ⓘ" name={marker} tip={marker} align="fit" className="-my-1.5 -mr-1.5" />}
      </span>
      {open && (
        <OverrideDialog
          row={row}
          campaign={campaign}
          onClose={() => setOpen(false)}
          onStale={onChanged}
          onDone={(message) => {
            setOpen(false);
            raise?.(message);
            onChanged();
          }}
        />
      )}
    </>
  );
}

/** Who, on which day of the office's calendar, and why — the reason as typed, rendered as text; the day a figure. */
function overriddenBy(override: StandingOverride, language: Language, figures: Language): string {
  const day = formatOfficeDay(override.at, OFFICE_TIME_ZONE, figures);
  return messagesOf(language).overriddenBy({ name: override.by.name, day, reason: override.reason });
}

/** The override's words in a language, for a function outside a component. */
const messagesOf = (language: Language) => messagesIn(kpmComplianceMessages, language).override;

/** The results an override may ask for: never the one the standing already reads. */
function offeredFor(current: string | null): OverrideStatus[] {
  return CHOICES.filter((code) => code !== current);
}

/**
 * The result chosen when the dialog opens, and again whenever the result it reads changes underneath it: the only
 * one offered, where there is one; else the one chosen before, while it is still offered; else none.
 */
function chosenFor(current: string | null, was: OverrideStatus | null): OverrideStatus | null {
  const offered = offeredFor(current);
  if (offered.length === 1) return offered[0];
  return was !== null && offered.includes(was) ? was : null;
}

/**
 * A refusal that means the view behind the dialog is stale: a lost race (`VERSION_CONFLICT`), a standing or an
 * override gone (`NOT_FOUND`), or *already reads* — a `VALIDATION_FAILED` naming the status, which the dialog never
 * offers, so it only arrives when somebody else set that result meanwhile. A reason refused (no `details.status`)
 * and `CAMPAIGN_OVERRIDE_SELF` are not: nothing moved, and reading the tree again would change nothing.
 */
function isStale(error: ApiError): boolean {
  if (error.code === 'VERSION_CONFLICT' || error.code === 'NOT_FOUND') return true;
  return error.code === 'VALIDATION_FAILED' && typeof error.details?.status === 'string';
}

/**
 * The override's dialog (form 3): the result now, *Achieved* / *Not achieved* — the one it already reads not
 * offered, so the server's 400 for the same status arrives only when the result moved meanwhile — a required
 * *Reason*, and, once overridden, *Clear override*, which asks for a reason too. Escape, the backdrop and *Close*
 * put it away and the focus goes back to the cell (`Modal`). A refusal stays in the dialog with what was typed; one
 * that says the standing moved meanwhile also reads the tree again behind it, as *Update production* does — and
 * when the result read again differs, the choice follows it, so the dialog never offers the result it now reads.
 */
function OverrideDialog({
  row, campaign, onClose, onStale, onDone,
}: {
  row: AchievedCellProps['row'];
  campaign: AchievedCellProps['campaign'];
  onClose: () => void;
  /** The standing moved while the dialog was open: read the tree again behind it. */
  onStale: () => void;
  onDone: (toast: string) => void;
}) {
  const t = useMessages(kpmComplianceMessages).override;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const achieved = achievedIn(language);
  const current = row.cell.second ?? null;
  const override = row.cell.override ?? null;
  const offered = offeredFor(current);
  // Where only one result can be asked for, it is the one chosen.
  const [status, setStatus] = useState<OverrideStatus | null>(() => chosenFor(current, null));
  // The tree read again behind the dialog (a refusal said the result moved): the choice follows what it reads now.
  useEffect(() => setStatus((was) => chosenFor(current, was)), [current]);
  const sendable = status !== null && offered.includes(status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const reasonId = useId();
  const name = `override-${useId()}`;
  const pill = pillOf(achieved, current);
  const typed = reason.trim();

  async function write(send: () => Promise<unknown>, toast: string) {
    if (!typed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await send();
      onDone(toast);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      setBusy(false);
      // Somebody else set or cleared it meanwhile: the refusal stays here, and the tree behind it is read again so
      // the cell — and this dialog's choice — say what is true.
      if (isStale(shown)) onStale();
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!status || !sendable) return;
    void write(() => setOverride(campaign.code, row.membershipId, { status, reason: typed }), t.saved);
  };
  const clear = () =>
    void write(() => clearOverride(campaign.code, row.membershipId, { reason: typed }), t.cleared);

  return (
    <Modal open title={t.overrideFor({ name: row.name, campaign: campaign.title })} onClose={onClose} className="text-left">
      <form onSubmit={save} className="flex flex-col gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
            {t.resultNow}
            <CompliancePill words={pill} />
          </p>
          {override && <p className="mt-1 break-words text-sm text-muted">{overriddenBy(override, language, figures)}</p>}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-navy">{t.newResult}</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {CHOICES.map((code) => (
              <label
                key={code}
                className="flex items-center gap-2 text-md text-navy has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted"
              >
                {/* A selection is navy (ADR-0137 §2), as the template picker's radios are — not the browser's blue. */}
                <input
                  type="radio"
                  name={name}
                  value={code}
                  checked={status === code}
                  disabled={!offered.includes(code)}
                  onChange={() => setStatus(code)}
                  className="accent-navy"
                />
                {achieved[code].label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-semibold text-navy">{t.reason}</label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={OVERRIDE_REASON_MAX}
            required
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && <ErrorBanner {...error} />}

        {/*
          The house footer — *Close* and the confirming button together at the end (`Dialog`, `ReopenDialog`) — kept
          as one group, so it never splits. *Clear override* leads on the left; where the three do not fit on one row
          (360px), it keeps the row above to itself and the pair wraps beneath it, still at the end.
        */}
        <div className="flex flex-wrap items-center gap-2.5">
          {override && (
            <Button variant="secondary" disabled={busy || !typed} onClick={clear}>
              {t.clear}
            </Button>
          )}
          <div className="ml-auto flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>{t.close}</Button>
            <Button type="submit" disabled={busy || !typed || !sendable}>{t.save}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
