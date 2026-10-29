import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Billing & subscription*** — the quote tool at `/admin/billing` (P18.98-T6; ADR-0111; `functional/billing.md`, *The
 * strings*): the tier cards, *Estimate your price*, the *Send quote* dialog, the quote and its paper, and the states.
 *
 * **English is the source**, byte for byte: `prototype` the prototype's own strings, verbatim
 * (`AgencyBoost_Billing_Subscription.html`; ADR-0062), and `own` ours, each for a registered Fix or Fill. The Indonesian
 * is the approved glossary's — *Batal · Coba lagi · Kembali* (§B.1), *Memuat…* (§B.2), *Periode · Tanggal* (§B.4),
 * *PIC* (§B.10, spelled alike) — with what it lacked proposed in the glossary for approval's §B.10: *tingkat* for a
 * price tier (the API's *tier*), *paket* for a plan, *penawaran* for a quote, `/bln` for *per month*, *HH/BB/TTTT* for the
 * typed date's pattern. **Kept** (§A): the title, *KPM*, *leader* / *leaders* (§B.0 rule 8), *Agents*, *unit*,
 * *AgencyBoost*. **Typed content stays as typed**: the client's KPM name, the PIC's and the seller's names. **A figure
 * is never a message's**: every sum, percentage and date is written by its caller in the figures' language — the
 * money's mark included (*Rp/leader*, *IDR/leader*) — and passed in. The fine print's *IDR* is the currency's code.
 *
 * @moved app/(admin)/admin/billing/
 * @moved lib/billing.ts
 */

/** A run of words drawn bold. */
type Bold = (words: string) => ReactNode;

const en = {
  /** **The prototype's own strings, verbatim.** */
  prototype: {
    title: kept('Billing & subscription'),
    launch: 'Launch pricing — locked in for signups before Mar 2027.',
    /** A tier's name: *1–10 leaders*. */
    tierLeaders: ({ range }: { range: string }) => `${range} leaders`,
    perLeaderMonth: ' /leader/mo',
    perMonth: '/mo',
    customPricing: "Custom pricing based on your unit's structure.",
    talkToUs: 'Talk to us',
    yourTier: 'Your tier',
    estimate: 'Estimate your price',
    leaderCount: 'Number of leaders',
    billingPeriod: 'Billing period',
    sixMonth: '6-month',
    annual: 'Annual',
    /** The tier hint (`:503-506`), `n` and the range drawn bold. */
    fallsIn: ({ n, range, bold }: { n: number; range: string; bold: Bold }) => (
      <>{bold(String(n))} {n === 1 ? 'leader' : 'leaders'} falls in the {bold(range)} tier.</>
    ),
    fallsInCustom: ({ n, range }: { n: number; range: string }) =>
      `${n} leaders falls in the ${range} tier — shown as "custom pricing" publicly, real rate calculated below for your own quoting.`,
    standardRow: 'Standard price / leader / mo',
    offerRow: 'Offering price / leader / mo',
    offerAfterRow: 'Offering price after discount / leader / mo',
    monthlyRow: 'Monthly total (all leaders)',
    sixMonthTotal: '6-month total (all leaders)',
    annualTotal: 'Annual total (all leaders)',
    discountsApplied: 'Discounts applied',
    annualDiscount: 'Annual discount',
    annualDiscountOn: 'Annual discount (extra 5% off 6-month rate)',
    manualOverride: 'Manual override',
    arbitraryDiscount: 'Arbitrary discount (internal, per leader)',
    /** The amount's option, by the money's mark in the figures' language: *Rp/leader*, *IDR/leader*. */
    flatOption: ({ mark }: { mark: string }) => `${mark}/leader`,
    /** A per-leader discount, `money` written: *-Rp 20.000/leader/mo*. */
    perLeaderDiscount: ({ money }: { money: string }) => `-${money}/leader/mo`,
    /** The card's saving, `pct` written whole. */
    save: ({ pct }: { pct: string }) => `Save ${pct}`,
    confirmPlan: 'Confirm plan',
    sendCustomQuote: 'Send custom quote',
    sendQuote: 'Send quote',
    finePrint: 'Prices shown in IDR, per leader. Agents under each leader are included at no extra cost.',
    // The dialog (`:374-415`).
    dialogLine: 'Fill in the client details to generate a quote page you can send.',
    kpmName: 'Name of KPM',
    kpmPlaceholder: 'e.g. Jakarta Selatan',
    kpmError: 'Enter the KPM name.',
    picName: 'Name of PIC',
    picPlaceholder: 'e.g. Andi Wijaya',
    picError: 'Enter the PIC name.',
    salesBy: 'Sales input by',
    salesPlaceholder: 'e.g. your name or teammate',
    salesError: "Enter who's submitting this quote.",
    startDate: 'Start date',
    endDate: 'End date',
    /** What the two date fields hold: the pattern a date is typed in. */
    datePlaceholder: 'DD/MM/YYYY',
    generate: 'Generate quote',
    cancel: 'Cancel',
    // The quote (`:308-372`).
    quoteTitle: 'Subscription quote',
    generated: ({ day }: { day: string }) => `Generated ${day}`,
    kpm: kept('KPM'),
    pic: 'Person in charge (PIC)',
    planStart: 'Plan start date',
    planEnd: 'Plan end date',
    planDetails: 'Plan details',
    tier: 'Tier',
    leadersOnPlan: 'Leaders on plan',
    sixMonthPlan: '6-month plan',
    annualPlan: 'Annual plan',
    custom: ' (custom)',
    discounts: 'Discounts',
    manualDiscount: 'Manual discount',
    finalRow: 'Final price / leader / mo',
    total: 'Total',
    footer:
      'This quote is valid for the plan period shown above. Rate is locked for the duration of the '
      + "subscription under AgencyBoost's launch pricing, valid for signups before Mar 2027.",
    print: 'Print / save as PDF',
    back: 'Back to editor',
  },

  /** **Ours**: the sentences the prototype has no words for, each a registered Fix or Fill. */
  own: {
    notApplied: 'Not applied — switch to Annual above',
    percentError: 'Enter a percent from 0 to 100.',
    /** `from` and `to` the bounds, written. */
    flatError: ({ from, to }: { from: string; to: string }) => `Enter an amount from ${from} to ${to}.`,
    startError: 'Enter a valid start date, as DD/MM/YYYY.',
    endError: 'Enter a valid end date, as DD/MM/YYYY.',
    endBeforeStart: 'Enter an end date on or after the start date.',
    discountType: 'Discount type',
    loading: 'Loading prices…',
    failed: "The prices couldn't be loaded, so nothing can be priced.",
    retry: 'Try again',
    printTitle: ({ kpm }: { kpm: string }) => `Subscription quote – ${kpm}`,
  },
};

const id: MessagesOf<typeof en> = {
  prototype: {
    title: kept('Billing & subscription'),
    launch: 'Harga peluncuran — terkunci untuk pendaftaran sebelum Mar 2027.',
    tierLeaders: ({ range }) => `${range} ${kept('leaders')}`,
    perLeaderMonth: ` /${kept('leader')}/bln`,
    perMonth: '/bln',
    customPricing: `Harga khusus berdasarkan struktur ${kept('unit')} Anda.`,
    talkToUs: 'Hubungi kami',
    yourTier: 'Tingkat Anda',
    estimate: 'Perkirakan harga Anda',
    leaderCount: `Jumlah ${kept('leader')}`,
    billingPeriod: 'Periode tagihan',
    sixMonth: '6 bulan',
    annual: 'Tahunan',
    fallsIn: ({ n, range, bold }) => (
      <>{bold(String(n))} {n === 1 ? kept('leader') : kept('leaders')} masuk tingkat {bold(range)}.</>
    ),
    fallsInCustom: ({ n, range }) =>
      `${n} ${kept('leaders')} masuk tingkat ${range} — ditampilkan sebagai "harga khusus" untuk publik, tarif sebenarnya dihitung di bawah untuk penawaran Anda sendiri.`,
    standardRow: `Harga standar / ${kept('leader')} / bln`,
    offerRow: `Harga penawaran / ${kept('leader')} / bln`,
    offerAfterRow: `Harga penawaran setelah diskon / ${kept('leader')} / bln`,
    monthlyRow: `Total bulanan (semua ${kept('leader')})`,
    sixMonthTotal: `Total 6 bulan (semua ${kept('leader')})`,
    annualTotal: `Total tahunan (semua ${kept('leader')})`,
    discountsApplied: 'Diskon yang berlaku',
    annualDiscount: 'Diskon tahunan',
    annualDiscountOn: 'Diskon tahunan (tambahan 5% dari tarif 6 bulan)',
    manualOverride: 'Penyesuaian manual',
    arbitraryDiscount: `Diskon bebas (internal, per ${kept('leader')})`,
    flatOption: ({ mark }) => `${mark}/${kept('leader')}`,
    perLeaderDiscount: ({ money }) => `-${money}/${kept('leader')}/bln`,
    save: ({ pct }) => `Hemat ${pct}`,
    confirmPlan: 'Konfirmasi paket',
    sendCustomQuote: 'Kirim penawaran khusus',
    sendQuote: 'Kirim penawaran',
    finePrint: `Harga dalam IDR, per ${kept('leader')}. ${kept('Agents')} di bawah setiap ${kept('leader')} sudah termasuk tanpa biaya tambahan.`,
    dialogLine: 'Isi detail klien untuk membuat halaman penawaran yang dapat Anda kirim.',
    kpmName: `Nama ${kept('KPM')}`,
    kpmPlaceholder: 'mis. Jakarta Selatan',
    kpmError: `Isi nama ${kept('KPM')}.`,
    picName: 'Nama PIC',
    picPlaceholder: 'mis. Andi Wijaya',
    picError: 'Isi nama PIC.',
    salesBy: 'Diisi oleh sales',
    salesPlaceholder: 'mis. nama Anda atau rekan tim',
    salesError: 'Isi siapa yang mengajukan penawaran ini.',
    startDate: 'Tanggal mulai',
    endDate: 'Tanggal berakhir',
    datePlaceholder: 'HH/BB/TTTT',
    generate: 'Buat penawaran',
    cancel: 'Batal',
    quoteTitle: 'Penawaran langganan',
    generated: ({ day }) => `Dibuat ${day}`,
    kpm: kept('KPM'),
    pic: 'Penanggung jawab (PIC)',
    planStart: 'Tanggal mulai paket',
    planEnd: 'Tanggal berakhir paket',
    planDetails: 'Detail paket',
    tier: 'Tingkat',
    leadersOnPlan: `Jumlah ${kept('leader')} dalam paket`,
    sixMonthPlan: 'Paket 6 bulan',
    annualPlan: 'Paket tahunan',
    custom: ' (khusus)',
    discounts: 'Diskon',
    manualDiscount: 'Diskon manual',
    finalRow: `Harga akhir / ${kept('leader')} / bln`,
    total: 'Total',
    footer:
      'Penawaran ini berlaku untuk periode paket yang tercantum di atas. Tarif terkunci selama masa langganan dengan '
      + `harga peluncuran ${kept('AgencyBoost')}, berlaku untuk pendaftaran sebelum Mar 2027.`,
    print: 'Cetak / simpan sebagai PDF',
    back: 'Kembali ke editor',
  },

  own: {
    notApplied: 'Tidak berlaku — pilih Tahunan di atas',
    percentError: 'Masukkan persentase dari 0 sampai 100.',
    flatError: ({ from, to }) => `Masukkan jumlah dari ${from} sampai ${to}.`,
    startError: 'Masukkan tanggal mulai yang valid, dengan format HH/BB/TTTT.',
    endError: 'Masukkan tanggal berakhir yang valid, dengan format HH/BB/TTTT.',
    endBeforeStart: 'Masukkan tanggal berakhir yang sama dengan atau setelah tanggal mulai.',
    discountType: 'Jenis diskon',
    loading: 'Memuat harga…',
    failed: 'Harga tidak dapat dimuat, jadi belum ada yang dapat dihitung.',
    retry: 'Coba lagi',
    printTitle: ({ kpm }) => `Penawaran langganan – ${kpm}`,
  },
};

export const billingMessages = defineMessages({ en, id });
