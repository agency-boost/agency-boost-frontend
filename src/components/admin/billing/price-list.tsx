'use client';

import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { tierRange, tierSavePct, type BillingPrices } from '@/lib/billing';
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Paket & harga*** (P19.23-T5 AC-3; ADR-0279 §1; frame f47): the five tiers — standard and offer price per leader
 * per month, *Hemat*, 101+ *Harga khusus · diatur per KPM* — then *Periode tagihan* (6 bulan · Tahunan, *Diskon tahunan
 * 5%*) and *Trial* (*Gratis 30 hari untuk KPM baru*), and the note: agents are not billed, new prices from the next
 * period. Every figure is the server's (`GET /admin/billing/prices`).
 *
 * **No *Ubah*** (parity I-1197): a price is a domain constant, changed by a release (invariant §7), so there is nothing
 * here to edit. On a phone each tier is a card, the column's name above each value (§12).
 */
export function PriceList({ prices }: { prices: BillingPrices }) {
  const { prices: T, cards: C } = useMessages(billingMessages);
  const fig = useFigureLanguage();
  const phone = useMediaQuery('phone');
  const money = (minor: number) => T.perLeaderMonth({ money: formatRupiah(minor, fig) });
  const pct = formatPercent(prices.annualDiscountPct, {}, fig);

  const rows = prices.tiers.map((tier) => {
    const save = tierSavePct(tier);
    return {
      code: tier.code,
      plan: C.range({ range: tierRange(tier) }),
      standard: tier.standardMinor === null ? T.custom : money(tier.standardMinor),
      offer: tier.offerMinor === null ? T.perKpm : money(tier.offerMinor),
      save: save === null ? null : formatPercent(save, {}, fig),
    };
  });

  return (
    <div>
      <p className="mb-2 text-sm text-muted">{T.launch}</p>
      {phone ? (
        <ul aria-label={T.caption} className="space-y-2">
          {rows.map((r) => (
            <li key={r.code} className="rounded-2xl bg-card p-3.5">
              <b className="block text-md text-navy">{r.plan}</b>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs font-bold text-muted">{T.standard}</dt><dd className="text-navy">{r.standard}</dd></div>
                <div><dt className="text-xs font-bold text-muted">{T.offer}</dt><dd className="font-bold text-navy">{r.offer}</dd></div>
                {r.save && <div><dt className="text-xs font-bold text-muted">{T.save}</dt><dd className="font-bold text-success">{r.save}</dd></div>}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <DataTable caption={T.caption} columns={[T.plan, T.standard, T.offer, T.save]}>
          {rows.map((r) => (
            <Row key={r.code}>
              <Cell className="font-bold">{r.plan}</Cell>
              <Cell>{r.standard}</Cell>
              <Cell className="font-bold">{r.offer}</Cell>
              <Cell>
                {r.save && <span className="rounded-pill bg-success/10 px-2 py-0.5 text-xs font-bold text-success">{r.save}</span>}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
      <dl className="mt-3 divide-y divide-hairline rounded-2xl bg-card text-sm">
        <div className="grid gap-1 px-4 py-3 md:grid-cols-[12rem_1fr_1fr]">
          <dt className="font-bold text-navy">{T.period}</dt>
          <dd className="text-navy">{T.periodValue}</dd>
          <dd className="text-navy">{T.annualDiscount({ pct, bold: (w) => <b>{w}</b> })}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 md:grid-cols-[12rem_1fr_1fr]">
          <dt className="font-bold text-navy">{T.trial}</dt>
          <dd className="text-navy">{T.trialValue({ days: formatNumber(prices.trialDays, {}, fig) })}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted">{T.note}</p>
    </div>
  );
}
