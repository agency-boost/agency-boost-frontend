'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Button, buttonClass, ErrorBanner, TextInput } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  breakdownOf, confirmPackage, endOfPlan, offerPdf, OfferInputError, officeToday, planMonths, policiesText, priceOffer,
  rupiahOf, tierFor, wholeOf, whatsappLink,
  type BillingKpmRow, type BillingPrices, type BreakdownLine, type OfferBody, type OfferField, type OfferPricing,
  type SubscriptionPlan,
} from '@/lib/billing';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatPercent, formatRupiah, MINOR_UNITS_PER_MAJOR, moneyPrefix } from '@/lib/format';
import { groupDigits } from '@/lib/goals';
import { saveFile } from '@/lib/save-file';
import { useMediaQuery } from '@/lib/use-media-query';
import { PlanCards } from './plan-cards';

/**
 * **The calculator** (P19.23-T5 AC-2; ADR-0279 §2; frames f43–f46, f50–f51) — on the *Kalkulator* tab and inside a KPM's
 * *Atur* dialog, one component.
 *
 * - **Fields**: *KPM* (the tab's alone: pick an existing KPM — its leaders fill in — or type a new name), *Jumlah leader*,
 *   *Jumlah agent (Opsional)*, *Periode* (*Tahunan* · HEMAT 5%, the default, or *6 bulan*), *Mulai – berakhir* (today, and
 *   the period's last day; both editable), *Harga / leader / bulan* or, after *isi total*, the period's total, *Diskon
 *   bulk order* (% or Rp, 0 by default) and *Catatan*.
 * - **The result** is `priceOffer`'s — the server's function, pinned to it by a shared fixture: *Harga normal* struck
 *   through, the big total, per bulan · per leader / hari · per agent / hari, *Hemat*, the breakdown, *Balik modal*.
 * - **The buttons**: *Pakai untuk KPM* (in *Atur*: *Konfirmasi paket*) writes the subscription; *Kirim penawaran* opens
 *   WhatsApp (OD-359); *Buat PDF* downloads the server's PDF.
 * - **Layout**: from 1024px the form beside the result, the plan cards above (the tab); below it the result on top and
 *   the form under it, the plan cards at the foot (§12).
 */
export function Calculator({
  prices,
  kpms = [],
  kpm = null,
  variant,
  onConfirmed,
}: {
  prices: BillingPrices;
  /** The KPMs the tab's *KPM* field offers. */
  kpms?: readonly BillingKpmRow[];
  /** The KPM *Atur* opened it for: no *KPM* field, and *Konfirmasi paket*. */
  kpm?: BillingKpmRow | null;
  variant: 'page' | 'dialog';
  onConfirmed?: (row: BillingKpmRow) => void;
}) {
  const T = useMessages(billingMessages);
  const C = T.calc;
  const fig = useFigureLanguage();
  const laptop = useMediaQuery('laptop');
  const { toast, show } = useToast();
  const money = (minor: number) => formatRupiah(minor, fig);
  const today = useMemo(() => officeToday(), []);

  // ---- The inputs, as typed.
  const [picked, setPicked] = useState<BillingKpmRow | null>(kpm);
  const [kpmText, setKpmText] = useState(kpm?.branch ?? '');
  const [leadersText, setLeadersText] = useState(String(Math.max(kpm?.leadersUsed ?? 15, 1)));
  const [agentsText, setAgentsText] = useState(kpm?.agents ? String(kpm.agents) : '');
  const [plan, setPlan] = useState<SubscriptionPlan>(kpm?.plan ?? 'annual');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(endOfPlan(today, kpm?.plan ?? 'annual'));
  const [mode, setMode] = useState<'per_leader' | 'total'>('per_leader');
  /*
   * **Money is held as digits and grouped as it is drawn**, in the figures' language — so a reader who switches
   * language reads the amount they typed in their new marks (`375.000` ⇄ `375,000`).
   */
  const [rateText, setRateText] = useState<string | null>(
    kpm?.rateMinor != null ? String(kpm.rateMinor / MINOR_UNITS_PER_MAJOR) : null,
  );
  const [totalText, setTotalText] = useState('');
  const [bulkType, setBulkType] = useState<'percent' | 'amount'>(kpm?.bulkDiscount?.type ?? 'percent');
  const [bulkText, setBulkText] = useState(
    kpm?.bulkDiscount ? String(kpm.bulkDiscount.type === 'percent' ? kpm.bulkDiscount.percent
      : kpm.bulkDiscount.amountMinor / MINOR_UNITS_PER_MAJOR) : '0',
  );
  const [note, setNote] = useState(kpm?.note ?? '');
  const [kpmError, setKpmError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'confirm' | 'pdf' | null>(null);
  const [failure, setFailure] = useState<{ error: ApiError; words: string } | null>(null);

  // ---- The inputs, read.
  const leaders = wholeOf(leadersText);
  const tier = tierFor(prices.tiers, Math.max(leaders ?? 1, 1));
  /** The price field follows the tier's offer price until it is typed in (*harga diubah* after). */
  const rateShown = rateText ?? (tier.offerMinor !== null ? String(tier.offerMinor / MINOR_UNITS_PER_MAJOR) : '');
  const agents = agentsText.trim() === '' ? null : wholeOf(agentsText);
  const bulkValue = wholeOf(bulkText || '0');
  const datesWrong = !!start && !!end && end < start;

  const { pricing, field } = useMemo((): { pricing: OfferPricing | null; field: OfferField | null } => {
    if (leaders === null) return { pricing: null, field: 'leaders' };
    if (agentsText.trim() !== '' && agents === null) return { pricing: null, field: 'agents' };
    const rate = rupiahOf(rateShown);
    const total = rupiahOf(totalText);
    if (mode === 'per_leader' && (rateShown.trim() === '' || rate === null)) {
      return { pricing: null, field: rateShown.trim() === '' ? null : 'price.rateMinor' };
    }
    if (mode === 'total' && (totalText.trim() === '' || total === null)) {
      return { pricing: null, field: totalText.trim() === '' ? null : 'price.totalMinor' };
    }
    if (bulkValue === null) return { pricing: null, field: bulkType === 'percent' ? 'bulk.percent' : 'bulk.amountMinor' };
    try {
      return {
        pricing: priceOffer(prices, {
          leaders,
          agents,
          plan,
          price: mode === 'per_leader'
            ? { mode, rateMinor: (rate as number) * MINOR_UNITS_PER_MAJOR }
            : { mode, totalMinor: (total as number) * MINOR_UNITS_PER_MAJOR },
          bulk: bulkValue ? (bulkType === 'percent'
            ? { type: 'percent', percent: bulkValue }
            : { type: 'amount', amountMinor: bulkValue * MINOR_UNITS_PER_MAJOR }) : null,
        }),
        field: null,
      };
    } catch (err) {
      if (err instanceof OfferInputError) return { pricing: null, field: err.field };
      throw err;
    }
  }, [prices, leaders, agents, agentsText, plan, mode, rateShown, totalText, bulkType, bulkValue]);

  const max = formatNumber(prices.countMax, {}, fig);
  const errorOf = (f: OfferField): string | null => (field !== f ? null : {
    leaders: C.errors.leaders({ max }),
    agents: C.errors.agents({ max }),
    'price.rateMinor': C.errors.rate({ max: money(prices.rateMaxMinor) }),
    'price.totalMinor': C.errors.total,
    'bulk.percent': C.errors.percent({ max: formatNumber(prices.bulkPercentMax, {}, fig) }),
    'bulk.amountMinor': C.errors.amount,
  }[f]);

  // ---- Changes that move other fields.
  const choosePlan = (next: SubscriptionPlan) => {
    setPlan(next);
    if (start) setEnd(endOfPlan(start, next));
  };
  const chooseStart = (next: string) => {
    setStart(next);
    if (next) setEnd(endOfPlan(next, plan));
  };
  /** *isi total* ⇄ *isi per leader*: the other field starts from what the result reads now. */
  const switchMode = () => {
    if (mode === 'per_leader') {
      if (pricing) setTotalText(String((pricing.totalMinor + pricing.bulkDiscountMinor) / MINOR_UNITS_PER_MAJOR));
      setMode('total');
    } else {
      if (pricing) setRateText(String(pricing.rateMinor / MINOR_UNITS_PER_MAJOR));
      setMode('per_leader');
    }
  };
  const pick = (row: BillingKpmRow) => {
    setPicked(row);
    setKpmText(row.branch);
    setLeadersText(String(Math.max(row.leadersUsed, 1)));
    setKpmError(null);
  };

  // ---- The three actions.
  const body = (): OfferBody | null => {
    if (!pricing || datesWrong || !start || !end) return null;
    const rest = { startDate: start, endDate: end, note: note.trim() || null };
    return {
      leaders: pricing.leaders,
      agents: pricing.agents,
      plan,
      price: mode === 'per_leader'
        ? { mode, rateMinor: pricing.rateMinor }
        : { mode, totalMinor: pricing.totalMinor + pricing.bulkDiscountMinor },
      bulk: pricing.bulkDiscountMinor > 0 && bulkValue
        ? (bulkType === 'percent' ? { type: 'percent', percent: bulkValue } : { type: 'amount', amountMinor: pricing.bulkDiscountMinor })
        : null,
      ...rest,
    };
  };
  const target = kpm ?? picked;

  const confirm = async () => {
    const payload = body();
    if (!target) {
      setKpmError(C.errors.pickKpm);
      return;
    }
    if (!payload) return;
    setBusy('confirm');
    setFailure(null);
    try {
      const row = await confirmPackage(target.kpmId, payload);
      show(T.actions.confirmed({ branch: row.branch }));
      onConfirmed?.(row);
    } catch (err) {
      setFailure({ error: toDisplayError(err), words: T.actions.saveFailed });
    } finally {
      setBusy(null);
    }
  };

  const pdf = async () => {
    const payload = body();
    const name = kpmText.trim();
    if (!target && !name) {
      setKpmError(C.errors.nameKpm);
      return;
    }
    if (!payload) return;
    setBusy('pdf');
    setFailure(null);
    try {
      const blob = await offerPdf({ ...payload, ...(target ? { kpmId: target.kpmId } : { kpmName: name }) });
      saveFile(blob, `Penawaran-${(target?.branch ?? name).replace(/[^\p{L}\p{N}]+/gu, '-')}-${today}.pdf`);
    } catch (err) {
      setFailure({ error: toDisplayError(err), words: T.actions.pdfFailed });
    } finally {
      setBusy(null);
    }
  };

  const offerText = (p: OfferPricing) => {
    const O = T.offer;
    const lines = [
      O.greeting({ name: target?.owner?.fullName ?? null }),
      O.intro({ kpm: target?.branch ?? (kpmText.trim() || T.calc.kpm) }),
      '',
      O.period({
        period: plan === 'annual' ? C.annual : C.sixMonths,
        start: formatCalendarDay(start, fig),
        end: formatCalendarDay(end, fig),
      }),
      O.leaders({ n: formatNumber(p.leaders, {}, fig) }),
      O.rate({ money: money(p.rateMinor) }),
      O.total({ money: money(p.totalMinor) }),
      ...(p.savingMinor > 0 ? [O.saving({ money: money(p.savingMinor), pct: formatPercent(p.savingPct, {}, fig) })] : []),
      O.perMonth({ money: money(p.perMonthMinor) }),
    ];
    return lines.join('\n');
  };

  const ready = pricing !== null && !datesWrong && !!start && !!end;

  // ---- The parts.
  const head = variant === 'page' && (
    <div className="mb-3 flex items-center gap-2.5">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-ink">
        <NavIcon name="receipt" />
      </span>
      <h2 className="text-lg font-bold text-navy">{C.title}</h2>
    </div>
  );

  const form = (
    <CalculatorForm
      prices={prices}
      showKpm={!kpm}
      kpms={kpms}
      kpmText={kpmText}
      onKpmText={(text) => { setKpmText(text); setPicked(null); setKpmError(null); }}
      onPick={pick}
      kpmError={kpmError}
      leadersText={leadersText}
      onLeaders={setLeadersText}
      leadersError={errorOf('leaders')}
      agentsText={agentsText}
      onAgents={setAgentsText}
      agentsError={errorOf('agents')}
      plan={plan}
      onPlan={choosePlan}
      start={start}
      end={end}
      onStart={chooseStart}
      onEnd={setEnd}
      datesError={datesWrong ? C.errors.dates : null}
      mode={mode}
      onSwitchMode={switchMode}
      rateShown={rateShown}
      rateChanged={rateText !== null && tier.offerMinor !== null && Number(rateText) !== tier.offerMinor / MINOR_UNITS_PER_MAJOR}
      onRate={setRateText}
      totalText={totalText}
      onTotal={setTotalText}
      priceError={errorOf(mode === 'per_leader' ? 'price.rateMinor' : 'price.totalMinor')}
      tierStandardMinor={tier.standardMinor}
      customTier={tier.customPricing}
      derivedRateMinor={mode === 'total' && pricing ? pricing.rateMinor : null}
      bulkType={bulkType}
      onBulkType={(next) => { setBulkType(next); setBulkText('0'); }}
      bulkText={bulkText}
      onBulk={setBulkText}
      bulkError={errorOf(bulkType === 'percent' ? 'bulk.percent' : 'bulk.amountMinor')}
      note={note}
      onNote={setNote}
    />
  );

  const result = (
    <div className="space-y-3">
      <ResultCard
        pricing={pricing}
        plan={plan}
        hasError={field !== null}
        customTier={tier.customPricing}
        annualPct={prices.annualDiscountPct}
        bulkPercent={bulkType === 'percent' ? bulkValue : null}
      />
      {pricing && <BreakEven pricing={pricing} prices={prices} />}
      {failure && <ErrorBanner code={failure.error.code} message={failure.words} requestId={failure.error.requestId} />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={confirm} disabled={!ready || busy !== null} className="w-full">
          {busy === 'confirm' ? T.actions.saving : (kpm ? T.actions.confirm : T.actions.use)}
        </Button>
        {pricing && ready ? (
          <a
            href={whatsappLink(target?.owner?.phone ?? null, offerText(pricing))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('secondary', 'w-full gap-1.5')}
          >
            <NavIcon name="whatsapp" className="h-4 w-4 shrink-0" />
            {T.actions.whatsapp}
          </a>
        ) : (
          <Button variant="secondary" disabled className="w-full">
            <NavIcon name="whatsapp" className="h-4 w-4 shrink-0" />
            {T.actions.whatsapp}
          </Button>
        )}
        <Button onClick={pdf} disabled={!ready || busy !== null} className="col-span-2 w-full">
          <NavIcon name="document" className="h-4 w-4 shrink-0" />
          {busy === 'pdf' ? T.actions.making : T.actions.pdf}
        </Button>
      </div>
    </div>
  );

  const cards = variant === 'page' && (
    <PlanCards tiers={prices.tiers} current={pricing?.tier.code ?? tier.code} label={T.cards.label} />
  );

  return (
    <div>
      {variant === 'page' && laptop && cards}
      <div className={cn(variant === 'page' && 'rounded-2xl border border-card-edge bg-card p-4 md:p-5')}>
        {head}
        {laptop && variant === 'page' ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
            <div>{form}</div>
            <div>{result}</div>
          </div>
        ) : laptop ? (
          // The dialog from 1024px (frame f50): the form, then the result under it.
          <div className="space-y-4">
            {form}
            {result}
          </div>
        ) : (
          // §12: the result on top, the form below it.
          <div className="space-y-5">
            {result}
            {form}
          </div>
        )}
      </div>
      {variant === 'page' && !laptop && <div className="mt-4">{cards}</div>}
      <Toast toast={toast} />
    </div>
  );
}

/** A field's row: its label beside it from 768px, above it on a phone. */
function Row({ label, htmlFor, labelId, children, hint, error }: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <div className="grid gap-1.5 py-1.5 md:grid-cols-[9.5rem_minmax(0,1fr)] md:items-start md:gap-3">
      {htmlFor
        ? <label htmlFor={htmlFor} className="pt-2.5 text-sm font-bold text-navy max-md:pt-0">{label}</label>
        : <span id={labelId} className="pt-2.5 text-sm font-bold text-navy max-md:pt-0">{label}</span>}
      <div className="min-w-0">
        {children}
        {hint && !error && <div className="mt-1 text-xs text-muted">{hint}</div>}
        {error && <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-alert">{error}</p>}
      </div>
    </div>
  );
}

/** A count with − and +: *Jumlah leader*, *Jumlah agent*, the bulk discount. Targets 44px. */
function CountBox({ id, value, onChange, label, placeholder, step = 1, min = 0, suffix, invalid, money: isMoney }: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  step?: number;
  min?: number;
  suffix?: string;
  invalid?: boolean;
  money?: boolean;
}) {
  const T = useMessages(billingMessages).calc;
  const fig = useFigureLanguage();
  const read = () => wholeOf(value) ?? 0;
  const write = (n: number) => onChange(String(n));
  const BTN = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-base text-lg font-bold text-navy disabled:opacity-40';
  return (
    <div className={cn(
      'flex items-center gap-1 rounded-lg border bg-card p-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-focus-ring',
      invalid ? 'border-alert' : 'border-hairline',
    )}
    >
      <button type="button" className={BTN} aria-label={T.decrease({ label })} disabled={read() <= min} onClick={() => write(Math.max(min, read() - step))}>–</button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={isMoney && value ? groupDigits(Number(value), fig) : value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="min-w-0 flex-1 border-0 bg-transparent text-center text-md font-bold text-navy outline-none placeholder:font-semibold placeholder:text-muted"
      />
      {suffix && <span aria-hidden="true" className="text-sm font-bold text-navy">{suffix}</span>}
      <button type="button" className={BTN} aria-label={T.increase({ label })} onClick={() => write(read() + step)}>+</button>
    </div>
  );
}

/** Two choices side by side, one pressed: *Tahunan* / *6 bulan*, *%* / *Rp*. */
function Choice<V extends string>({ value, options, onChange, labelledBy, className }: {
  value: V;
  options: readonly { value: V; label: ReactNode; name?: string }[];
  onChange: (next: V) => void;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-base p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o.name}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative flex min-h-10 items-center justify-center rounded-md px-2 text-sm font-semibold',
            value === o.value ? 'bg-card text-navy shadow-sm' : 'text-muted hover:text-navy',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface FormProps {
  prices: BillingPrices;
  /** The *KPM* field: on the tab, and in a dialog opened for no KPM in particular. */
  showKpm: boolean;
  kpms: readonly BillingKpmRow[];
  kpmText: string;
  onKpmText: (text: string) => void;
  onPick: (row: BillingKpmRow) => void;
  kpmError: string | null;
  leadersText: string;
  onLeaders: (text: string) => void;
  leadersError: string | null;
  agentsText: string;
  onAgents: (text: string) => void;
  agentsError: string | null;
  plan: SubscriptionPlan;
  onPlan: (plan: SubscriptionPlan) => void;
  start: string;
  end: string;
  onStart: (day: string) => void;
  onEnd: (day: string) => void;
  datesError: string | null;
  mode: 'per_leader' | 'total';
  onSwitchMode: () => void;
  rateShown: string;
  rateChanged: boolean;
  onRate: (text: string) => void;
  totalText: string;
  onTotal: (text: string) => void;
  priceError: string | null;
  tierStandardMinor: number | null;
  customTier: boolean;
  derivedRateMinor: number | null;
  bulkType: 'percent' | 'amount';
  onBulkType: (type: 'percent' | 'amount') => void;
  bulkText: string;
  onBulk: (text: string) => void;
  bulkError: string | null;
  note: string;
  onNote: (text: string) => void;
}

/** The form: every field the client named, in their order. */
function CalculatorForm(p: FormProps) {
  const T = useMessages(billingMessages);
  const C = T.calc;
  const fig = useFigureLanguage();
  const ids = { kpm: useId(), leaders: useId(), agents: useId(), period: useId(), dates: useId(), price: useId(), bulk: useId(), note: useId() };
  const pct = formatPercent(p.prices.annualDiscountPct, {}, fig);
  /** Digits as they are drawn: grouped in the figures' marks. */
  const grouped = (digits: string) => (digits ? groupDigits(Number(digits), fig) : '');
  const digitsOf = (text: string) => text.replace(/\D/g, '');

  return (
    <div>
      {p.showKpm && (
        <Row label={C.kpm} htmlFor={ids.kpm} error={p.kpmError}>
          <KpmPicker id={ids.kpm} kpms={p.kpms} text={p.kpmText} onText={p.onKpmText} onPick={p.onPick} invalid={!!p.kpmError} />
        </Row>
      )}
      <Row label={C.leaders} htmlFor={ids.leaders} error={p.leadersError}>
        <CountBox id={ids.leaders} label={C.leaders} value={p.leadersText} onChange={p.onLeaders} min={1} invalid={!!p.leadersError} />
      </Row>
      <Row label={C.agents} htmlFor={ids.agents} error={p.agentsError}>
        <CountBox id={ids.agents} label={C.agents} value={p.agentsText} onChange={p.onAgents} placeholder={C.optional} invalid={!!p.agentsError} />
      </Row>
      <Row label={C.period} labelId={ids.period}>
        <Choice
          labelledBy={ids.period}
          value={p.plan}
          onChange={p.onPlan}
          className="mt-2"
          options={[
            {
              value: 'annual',
              label: (
                <>
                  {C.annual}
                  <span className="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-pill bg-success px-2 py-0.5 text-2xs font-bold text-secondary-contrast">
                    <NavIcon name="bolt" className="h-3 w-3" />
                    {C.saveBadge({ pct })}
                  </span>
                </>
              ),
            },
            { value: 'six_months', label: C.sixMonths },
          ]}
        />
      </Row>
      <Row label={C.dates} labelId={ids.dates} error={p.datesError}>
        <div className="flex items-center gap-2">
          <DateField value={p.start} onChange={p.onStart} aria-label={C.start} className="min-w-0 flex-1" />
          <span aria-hidden="true" className="text-muted">–</span>
          <DateField value={p.end} onChange={p.onEnd} aria-label={C.end} min={p.start || undefined} invalid={!!p.datesError} className="min-w-0 flex-1" />
        </div>
      </Row>
      <Row
        label={p.mode === 'per_leader' ? C.rate : (p.plan === 'annual' ? C.totalAnnual : C.totalSix)}
        htmlFor={ids.price}
        error={p.priceError}
        hint={p.mode === 'per_leader'
          ? (p.tierStandardMinor !== null
            ? (
              <>
                {C.standard} <s>{formatRupiah(p.tierStandardMinor, fig)}</s>
                {p.rateChanged && <> · <b className="text-primary-ink">{C.changed}</b></>}
              </>
            )
            : C.customRate)
          : (p.derivedRateMinor !== null ? C.fromTotal({ money: formatRupiah(p.derivedRateMinor, fig) }) : null)}
      >
        <div className="relative">
          <TextInput
            id={ids.price}
            inputMode="numeric"
            prefix={moneyPrefix(fig)}
            value={grouped(p.mode === 'per_leader' ? p.rateShown : p.totalText)}
            onChange={(e) => (p.mode === 'per_leader' ? p.onRate(digitsOf(e.target.value)) : p.onTotal(digitsOf(e.target.value)))}
            invalid={!!p.priceError}
            className="w-full pr-28"
          />
          <button
            type="button"
            onClick={p.onSwitchMode}
            className="absolute right-1 top-1/2 inline-flex min-h-10 -translate-y-1/2 items-center rounded-md px-2 text-sm font-bold text-primary-ink"
          >
            {p.mode === 'per_leader' ? C.typeTotal : C.typeRate}
          </button>
        </div>
      </Row>
      <Row label={C.bulk} htmlFor={ids.bulk} error={p.bulkError}>
        <div className="flex items-center gap-2">
          <Choice
            value={p.bulkType}
            onChange={p.onBulkType}
            className="w-[6.5rem] shrink-0"
            options={[
              { value: 'percent', label: '%', name: C.bulkPercent },
              { value: 'amount', label: moneyPrefix(fig), name: C.bulkRupiah },
            ]}
          />
          <div className="min-w-0 flex-1">
            <CountBox
              id={ids.bulk}
              label={C.bulk}
              value={p.bulkText}
              onChange={p.onBulk}
              step={p.bulkType === 'percent' ? 1 : 100_000}
              suffix={p.bulkType === 'percent' ? '%' : undefined}
              money={p.bulkType === 'amount'}
              invalid={!!p.bulkError}
            />
          </div>
        </div>
      </Row>
      <Row label={C.note} htmlFor={ids.note}>
        {/* The column's width, as every field above it (found 2026-11-20: a bare input kept its own, half the column). */}
        <TextInput id={ids.note} className="w-full" value={p.note} maxLength={p.prices.noteMax} placeholder={C.notePlaceholder} onChange={(e) => p.onNote(e.target.value)} />
      </Row>
    </div>
  );
}

/** *KPM*: a combobox — type to filter, pick one of the list, or keep the name typed for a KPM that does not exist yet. */
function KpmPicker({ id, kpms, text, onText, onPick, invalid }: {
  id: string;
  kpms: readonly BillingKpmRow[];
  text: string;
  onText: (text: string) => void;
  onPick: (row: BillingKpmRow) => void;
  invalid: boolean;
}) {
  const T = useMessages(billingMessages).calc;
  const fig = useFigureLanguage();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useId();
  const blur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = text.trim().toLowerCase();
  const options = kpms
    .filter((k) => !q || k.branch.toLowerCase().includes(q) || k.code.includes(q) || k.company.name.toLowerCase().includes(q))
    .slice(0, 8);
  const choose = (row: BillingKpmRow) => {
    onPick(row);
    setOpen(false);
  };
  return (
    <div className="relative">
      <TextInput
        id={id}
        className="w-full"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${list}-${active}` : undefined}
        placeholder={T.kpmPlaceholder}
        value={text}
        invalid={invalid}
        onChange={(e) => { onText(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blur.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && options.length > 0 && (
        <ul id={list} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-hairline bg-card py-1 shadow-lg">
          {options.map((row, i) => (
            <li
              key={row.kpmId}
              id={`${list}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); if (blur.current) clearTimeout(blur.current); choose(row); }}
              className={cn('cursor-pointer px-3 py-2', i === active && 'bg-primary-50')}
            >
              <b className="block text-sm text-navy">{row.branch}</b>
              <small className="block text-xs text-muted">{T.kpmOption({ company: row.company.name, leaders: formatNumber(row.leadersUsed, {}, fig) })}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The navy result card: *Harga normal*, the total, the tiles, *Hemat*, the breakdown. */
function ResultCard({ pricing: p, plan, hasError, customTier, annualPct, bulkPercent }: {
  pricing: OfferPricing | null;
  plan: SubscriptionPlan;
  hasError: boolean;
  customTier: boolean;
  /** The annual discount, as the server serves it. */
  annualPct: number;
  /** The bulk discount's percent, when it is typed as one. */
  bulkPercent: number | null;
}) {
  const T = useMessages(billingMessages);
  const R = T.result;
  const fig = useFigureLanguage();
  const money = (minor: number) => formatRupiah(minor, fig);
  const n = (value: number) => formatNumber(value, {}, fig);
  const months = n(planMonths(plan));
  const words = (line: BreakdownLine): string => {
    if (!p) return '';
    switch (line.kind) {
      case 'normal': return R.lineNormal({ n: n(p.leaders), money: money(p.tier.standardMinor ?? 0), months });
      case 'gross': return R.lineGross({ n: n(p.leaders), money: money(p.rateMinor), months });
      case 'priceDiscount': return R.linePriceDiscount({ money: money(p.rateMinor) });
      case 'annual': return R.lineAnnual({ pct: formatPercent(annualPct, {}, fig) });
      default: return R.lineBulk({ pct: bulkPercent ? formatPercent(bulkPercent, {}, fig) : null });
    }
  };
  return (
    <section aria-label={R.label} aria-live="polite" className="rounded-2xl bg-secondary p-4 text-secondary-contrast">
      <p className="text-sm font-bold">{plan === 'annual' ? T.calc.totalAnnual : T.calc.totalSix}</p>
      {!p ? (
        <p className="mt-2 text-sm text-secondary-muted">{hasError ? R.fixInputs : (customTier ? T.calc.customRate : R.enterPrice)}</p>
      ) : (
        <>
          {p.normalMinor !== null && p.normalMinor > p.totalMinor && (
            <p className="mt-1 text-sm text-secondary-muted">
              {R.normal} <s className="decoration-on-navy-red decoration-2">{money(p.normalMinor)}</s>
            </p>
          )}
          <p className="font-display text-[2rem] font-extrabold leading-tight text-primary">{money(p.totalMinor)}</p>
          <p className="text-sm text-secondary-muted">
            {R.heads({ leaders: n(p.leaders), agents: p.agents === null ? null : n(p.agents) })}
          </p>
          {p.savingMinor > 0 && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-on-navy-green px-3 py-2 text-sm text-navy">
              <NavIcon name="ti-check" className="h-4 w-4 shrink-0" />
              <span>{R.saving({ money: money(p.savingMinor), pct: formatPercent(p.savingPct, {}, fig), bold: (w) => <b>{w}</b> })}</span>
            </p>
          )}
          <dl className={cn('mt-3 grid gap-2', p.perAgentPerDayMinor !== null ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
            {([
              [money(p.perMonthMinor), R.perMonth],
              [money(p.perLeaderPerDayMinor), R.perLeaderDay],
              ...(p.perAgentPerDayMinor !== null ? [[money(p.perAgentPerDayMinor), R.perAgentDay]] : []),
            ] as [string, string][]).map(([value, label]) => (
              <div key={label} className="min-w-0 rounded-lg bg-secondary-contrast/[0.08] px-3 py-2">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <b className="block truncate text-md font-extrabold text-primary">{value}</b>
                  <span aria-hidden="true" className="block text-xs text-secondary-muted">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <dl className="mt-3 space-y-1.5 border-t border-on-navy-line pt-3 text-sm">
            {breakdownOf(p).map((line) => {
              const minus = line.kind !== 'normal' && line.kind !== 'gross';
              return (
                <div key={line.kind} className={cn('flex justify-between gap-3', minus && 'font-semibold text-on-navy-green')}>
                  <dt className="min-w-0">{words(line)}</dt>
                  <dd className="shrink-0 font-bold">{minus ? `− ${money(line.minor)}` : money(line.minor)}</dd>
                </div>
              );
            })}
            <div className="flex justify-between gap-3 border-t border-on-navy-line pt-2">
              <dt className="font-bold">{R.total}</dt>
              <dd className="font-bold text-primary">{money(p.totalMinor)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

/** *Balik modal jika 1 KPM jual tambahan*: policies per period and per month, and how one policy's income is made. */
function BreakEven({ pricing: p, prices }: { pricing: OfferPricing; prices: BillingPrices }) {
  const T = useMessages(billingMessages).breakEven;
  const fig = useFigureLanguage();
  const money = (minor: number) => formatRupiah(minor, fig);
  const pct = (value: number) => formatPercent(value, {}, fig);
  const b = prices.breakEven;
  return (
    <section aria-labelledby="break-even" className="rounded-2xl bg-primary-50 p-4">
      <h3 id="break-even" className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-[0.04em] text-primary-ink">
        <NavIcon name="spark" className="h-4 w-4 shrink-0" />
        {T.title}
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([
          [policiesText(p.breakEven.policiesPerPeriodTenths, fig), p.months === 12 ? T.perYear : T.perSix],
          [policiesText(p.breakEven.policiesPerMonthTenths, fig), T.perMonth],
        ] as [string, string][]).map(([value, label]) => (
          <p key={label} className="rounded-lg bg-card px-3 py-2 text-navy">
            <b className="text-xl font-extrabold">{value}</b> <span className="text-sm">{label}</span>
          </p>
        ))}
      </div>
      <p className="mt-2 text-xs text-navy">
        {T.explain({
          ape: money(b.policyApeMinor),
          kom: pct(b.commissionPct),
          komMoney: money(b.policyApeMinor * b.commissionPct / 100),
          ovr: pct(b.overridingPct),
          ovrMoney: money(b.policyApeMinor * b.overridingPct / 100),
          bon: pct(b.bonusPct),
          bonMoney: money(b.policyApeMinor * b.bonusPct / 100),
          income: money(b.incomePerPolicyMinor),
          bold: (w) => <b>{w}</b>,
        })}
      </p>
    </section>
  );
}
