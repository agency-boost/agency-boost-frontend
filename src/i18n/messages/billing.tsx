import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Langganan & akses*** — `/admin/billing` (P19.23-T5; ADR-0279; the Super Admin mockups' frames f43–f51): the three
 * tabs, the plan cards, the calculator (on its tab and in a KPM's *Atur* dialog), *Paket & harga*, *Langganan per KPM*,
 * and the states.
 *
 * **The Indonesian is the mockups' copy, verbatim** (*Kalkulator harga*, *Pilih atau tulis KPM baru*, *HEMAT 5%*, *isi
 * total*, *Harga normal*, *Hemat … dari harga standar*, *Balik modal jika 1 KPM jual tambahan*, *Pakai untuk KPM*,
 * *Konfirmasi paket*, *Kirim penawaran*, *Buat PDF*, *PAKET INI*, *Harga khusus*, *Melewati batas*, *Berakhir ≤ 30
 * hari*, *Ditangguhkan*, *Atur*); the English is the source the catalogue keeps. **Kept** (§A): *KPM*, *leader*,
 * *AgencyBoost*; *Total* and *Trial* are spelled alike. **A figure is never a message's**: every sum, percentage, count and date
 * is written by its caller in the figures' language and passed in.
 *
 * @moved app/(admin)/admin/billing/
 * @moved components/admin/billing/
 */

/** A run of words drawn bold. */
type Bold = (words: string) => ReactNode;

const en = {
  title: 'Subscriptions & access',
  loading: 'Loading…',
  failed: 'This could not be loaded.',
  retry: 'Try again',
  close: 'Close',

  /** The three tabs (AC-1); on a phone the third is *Langganan*. */
  tabs: {
    label: 'Subscriptions & access sections',
    calculator: 'Calculator',
    prices: 'Plans & prices',
    kpms: `Subscriptions per ${kept('KPM')}`,
    kpmsShort: 'Subscriptions',
  },

  /** The plan cards above the calculator (below it on a phone). */
  cards: {
    label: 'Plans',
    range: ({ range }: { range: string }) => `${range} ${kept('leader')}`,
    perLeaderMonth: `/${kept('leader')}/month`,
    save: ({ pct }: { pct: string }) => `Save ${pct}`,
    thisPlan: 'THIS PLAN',
    custom: 'Custom price',
    customFor: 'for large teams',
  },

  calc: {
    title: 'Price calculator',
    kpm: kept('KPM'),
    kpmPlaceholder: `Pick or type a new ${kept('KPM')}`,
    kpmOption: ({ company, leaders }: { company: string; leaders: string }) => `${company} · ${leaders} ${kept('leader')}`,
    kpmNew: ({ name }: { name: string }) => `New ${kept('KPM')}: ${name}`,
    leaders: `Number of ${kept('leader')}s`,
    agents: 'Number of agents',
    optional: 'Optional',
    period: 'Period',
    annual: 'Annual',
    sixMonths: '6 months',
    saveBadge: ({ pct }: { pct: string }) => `SAVE ${pct}`,
    dates: 'Start – end',
    start: 'Start',
    end: 'End',
    rate: `Price / ${kept('leader')} / month`,
    totalAnnual: 'Total 1 year',
    totalSix: 'Total 6 months',
    typeTotal: 'enter total',
    typeRate: `enter per ${kept('leader')}`,
    standard: 'Standard price',
    changed: 'price changed',
    fromTotal: ({ money }: { money: string }) => `= ${money} per ${kept('leader')} / month`,
    customRate: 'Custom price: type the price for this team',
    bulk: 'Bulk order discount',
    bulkPercent: 'Discount in percent',
    bulkRupiah: 'Discount in rupiah',
    decrease: ({ label }: { label: string }) => `Fewer: ${label}`,
    increase: ({ label }: { label: string }) => `More: ${label}`,
    note: 'Note',
    notePlaceholder: 'Write a note (Optional)',
    errors: {
      leaders: ({ max }: { max: string }) => `Enter a whole number from 1 to ${max}.`,
      agents: ({ max }: { max: string }) => `Enter a whole number up to ${max}, or leave it empty.`,
      rate: ({ max }: { max: string }) => `Enter a price from Rp 0 to ${max}, in whole rupiah.`,
      total: 'Enter a total in whole rupiah.',
      percent: ({ max }: { max: string }) => `Enter a whole percent from 0 to ${max}.`,
      amount: 'Enter a discount up to the total, in whole rupiah.',
      dates: 'Enter an end date on or after the start date.',
      pickKpm: `Pick an existing ${kept('KPM')} to use this plan for it.`,
      nameKpm: `Pick a ${kept('KPM')} or type the new ${kept('KPM')}’s name.`,
    },
  },

  result: {
    label: 'The price',
    normal: 'Normal price',
    heads: ({ leaders, agents }: { leaders: string; agents: string | null }) =>
      (agents === null ? `${leaders} ${kept('leader')}` : `${leaders} ${kept('leader')} · ${agents} agents`),
    saving: ({ money, pct, bold }: { money: string; pct: string; bold: Bold }) => (
      <>Save {bold(money)} ({pct}) on the standard price</>
    ),
    perMonth: 'per month',
    perLeaderDay: `per ${kept('leader')} / day`,
    perAgentDay: 'per agent / day',
    lineNormal: ({ n, money, months }: { n: string; money: string; months: string }) =>
      `Normal price (${n} × ${money} × ${months})`,
    lineGross: ({ n, money, months }: { n: string; money: string; months: string }) =>
      `${n} ${kept('leader')} × ${money} × ${months} mo`,
    linePriceDiscount: ({ money }: { money: string }) => `Price discount → ${money}`,
    lineAnnual: ({ pct }: { pct: string }) => `Annual saving ${pct}`,
    lineBulk: ({ pct }: { pct: string | null }) => (pct === null ? 'Bulk order discount' : `Bulk order discount ${pct}`),
    total: 'Total',
    enterPrice: 'Enter a price to see the total.',
    fixInputs: 'Fix the field marked above to see the total.',
  },

  breakEven: {
    title: `Payback if 1 ${kept('KPM')} sells more`,
    perYear: 'policies / year',
    perSix: 'policies / 6 months',
    perMonth: 'policies / month',
    explain: ({ ape, kom, komMoney, ovr, ovrMoney, bon, bonMoney, income, bold }: {
      ape: string; kom: string; komMoney: string; ovr: string; ovrMoney: string; bon: string; bonMoney: string;
      income: string; bold: Bold;
    }) => (
      <>1 policy APE {ape}: commission {kom} {komMoney} + overriding {ovr} {ovrMoney} + bonus {bon} {bonMoney} = {bold(income)}</>
    ),
  },

  actions: {
    use: `Use for ${kept('KPM')}`,
    confirm: 'Confirm plan',
    whatsapp: 'Send offer',
    pdf: 'Create PDF',
    saving: 'Saving…',
    making: 'Making the PDF…',
    confirmed: ({ branch }: { branch: string }) => `Plan confirmed for ${branch}`,
    saveFailed: 'The plan could not be saved.',
    pdfFailed: 'The PDF could not be made.',
  },

  /** *Kirim penawaran*'s message, as WhatsApp opens it: every figure written by the caller. */
  offer: {
    greeting: ({ name }: { name: string | null }) => (name ? `Hello ${name},` : 'Hello,'),
    intro: ({ kpm }: { kpm: string }) => `here is the ${kept('AgencyBoost')} subscription offer for ${kpm}:`,
    period: ({ period, start, end }: { period: string; start: string; end: string }) => `Period: ${period} (${start} – ${end})`,
    leaders: ({ n }: { n: string }) => `${kept('Leader')}s: ${n}`,
    rate: ({ money }: { money: string }) => `Price: ${money} / ${kept('leader')} / month`,
    total: ({ money }: { money: string }) => `Total: ${money}`,
    saving: ({ money, pct }: { money: string; pct: string }) => `Save ${money} (${pct}) on the standard price`,
    perMonth: ({ money }: { money: string }) => `That is ${money} a month.`,
  },

  dialog: {
    title: ({ branch }: { branch: string }) => `Subscription ${branch}`,
    sub: ({ company, n }: { company: string; n: string }) => `${company} · ${n} active ${kept('leader')}s`,
  },

  prices: {
    launch: 'Launch price — locked for sign-ups before Mar 2027',
    caption: 'Plans and prices',
    plan: 'Plan',
    standard: 'Standard price',
    offer: 'Offer price',
    save: 'Saving',
    perLeaderMonth: ({ money }: { money: string }) => `${money} /${kept('leader')}/mo`,
    custom: 'Custom price',
    perKpm: `set per ${kept('KPM')}`,
    period: 'Billing period',
    periodValue: '6 months · Annual',
    annualDiscount: ({ pct, bold }: { pct: string; bold: Bold }) => <>Annual discount {bold(pct)}</>,
    trial: 'Trial',
    trialValue: ({ days }: { days: string }) => `Free for ${days} days for new ${kept('KPM')}s`,
    note: `Price per ${kept('leader')}; agents under a ${kept('leader')} are not billed · new prices apply from the next period`,
  },

  kpms: {
    summaryLabel: 'At a glance',
    revenue: 'Income per month',
    revenueSub: ({ n }: { n: string }) => `from ${n} paying ${kept('KPM')}s`,
    billed: `${kept('Leader')}s billed`,
    billedSub: `across every ${kept('KPM')}`,
    soon: 'Ending ≤ 30 days',
    soonSub: 'to renew',
    action: 'Needs action',
    actionSub: 'over the limit · ended',
    filterLabel: 'Which KPMs',
    all: ({ n }: { n: string }) => `All ${n}`,
    needsAction: ({ n }: { n: string }) => `Needs action ${n}`,
    caption: `Subscriptions per ${kept('KPM')}`,
    columns: {
      kpm: kept('KPM'),
      used: `${kept('Leader')} seats used`,
      rate: `Price / ${kept('leader')}`,
      perMonth: 'Per month',
      perPeriod: 'Bill per period',
      until: 'Valid until',
      manage: 'Action',
    },
    total: ({ n }: { n: string }) => `Total · ${n} ${kept('KPM')}`,
    leaders: ({ n }: { n: string }) => `${n} ${kept('leader')}`,
    weighted: 'weighted average',
    perMonthSub: 'per month',
    running: 'every running period',
    totalAction: ({ n }: { n: string }) => `${n} need action`,
    usedOf: ({ used, max }: { used: string; max: string }) => `${used} of ${max} ${kept('leader')}s used`,
    noLimit: 'no limit',
    plan: ({ range }: { range: string }) => `plan ${range} ${kept('leader')}`,
    customPrice: 'custom price',
    billedAnnual: ({ pct }: { pct: string }) => `annual · ${pct} off`,
    billedSix: '6 months',
    pills: {
      over: 'Over the limit',
      ending_soon: 'Ending ≤ 30 days',
      trial: 'Trial',
      ended: 'Ended',
      suspended: 'Suspended',
    },
    manage: 'Manage',
    manageOf: ({ branch }: { branch: string }) => `Manage ${branch}’s subscription`,
    ownersNote: `Who is owner, admin and core leader: inside the ${kept('KPM')} › ${kept('KPM admins')}`,
    lapseNote: ({ days }: { days: string }) => `Not renewed ${days} days after it ends = ${kept('KPM')} suspended automatically`,
    empty: `No ${kept('KPM')} yet.`,
    emptyAction: 'Nothing needs action.',
  },
};

const id: MessagesOf<typeof en> = {
  title: 'Langganan & akses',
  loading: 'Memuat…',
  failed: 'Data ini tidak dapat dimuat.',
  retry: 'Coba lagi',
  close: 'Tutup',

  tabs: {
    label: 'Bagian Langganan & akses',
    calculator: 'Kalkulator',
    prices: 'Paket & harga',
    kpms: `Langganan per ${kept('KPM')}`,
    kpmsShort: 'Langganan',
  },

  cards: {
    label: 'Paket',
    range: ({ range }) => `${range} ${kept('leader')}`,
    perLeaderMonth: `/${kept('leader')}/bulan`,
    save: ({ pct }) => `Hemat ${pct}`,
    thisPlan: 'PAKET INI',
    custom: 'Harga khusus',
    customFor: 'untuk tim besar',
  },

  calc: {
    title: 'Kalkulator harga',
    kpm: kept('KPM'),
    kpmPlaceholder: `Pilih atau tulis ${kept('KPM')} baru`,
    kpmOption: ({ company, leaders }) => `${company} · ${leaders} ${kept('leader')}`,
    kpmNew: ({ name }) => `${kept('KPM')} baru: ${name}`,
    leaders: `Jumlah ${kept('leader')}`,
    agents: 'Jumlah agent',
    optional: 'Opsional',
    period: 'Periode',
    annual: 'Tahunan',
    sixMonths: '6 bulan',
    saveBadge: ({ pct }) => `HEMAT ${pct}`,
    dates: 'Mulai – berakhir',
    start: 'Mulai',
    end: 'Berakhir',
    rate: `Harga / ${kept('leader')} / bulan`,
    totalAnnual: 'Total 1 tahun',
    totalSix: 'Total 6 bulan',
    typeTotal: 'isi total',
    typeRate: `isi per ${kept('leader')}`,
    standard: 'Harga standar',
    changed: 'harga diubah',
    fromTotal: ({ money }) => `= ${money} per ${kept('leader')} / bulan`,
    customRate: 'Harga khusus: isi harga untuk tim ini',
    bulk: 'Diskon bulk order',
    bulkPercent: 'Diskon dalam persen',
    bulkRupiah: 'Diskon dalam rupiah',
    decrease: ({ label }) => `Kurangi: ${label}`,
    increase: ({ label }) => `Tambah: ${label}`,
    note: 'Catatan',
    notePlaceholder: 'Tulis catatan (Opsional)',
    errors: {
      leaders: ({ max }) => `Isi bilangan bulat dari 1 sampai ${max}.`,
      agents: ({ max }) => `Isi bilangan bulat sampai ${max}, atau kosongkan.`,
      rate: ({ max }) => `Isi harga dari Rp 0 sampai ${max}, dalam rupiah penuh.`,
      total: 'Isi total dalam rupiah penuh.',
      percent: ({ max }) => `Isi persen bulat dari 0 sampai ${max}.`,
      amount: 'Isi diskon sampai sebesar totalnya, dalam rupiah penuh.',
      dates: 'Isi tanggal berakhir yang sama dengan atau setelah tanggal mulai.',
      pickKpm: `Pilih ${kept('KPM')} yang sudah ada untuk memakai paket ini.`,
      nameKpm: `Pilih ${kept('KPM')} atau tulis nama ${kept('KPM')} baru.`,
    },
  },

  result: {
    label: 'Harga',
    normal: 'Harga normal',
    heads: ({ leaders, agents }) =>
      (agents === null ? `${leaders} ${kept('leader')}` : `${leaders} ${kept('leader')} · ${agents} agent`),
    saving: ({ money, pct, bold }) => <>Hemat {bold(money)} ({pct}) dari harga standar</>,
    perMonth: 'per bulan',
    perLeaderDay: `per ${kept('leader')} / hari`,
    perAgentDay: 'per agent / hari',
    lineNormal: ({ n, money, months }) => `Harga normal (${n} × ${money} × ${months})`,
    lineGross: ({ n, money, months }) => `${n} ${kept('leader')} × ${money} × ${months} bln`,
    linePriceDiscount: ({ money }) => `Diskon harga → ${money}`,
    lineAnnual: ({ pct }) => `Hemat tahunan ${pct}`,
    lineBulk: ({ pct }) => (pct === null ? 'Diskon bulk order' : `Diskon bulk order ${pct}`),
    total: 'Total',
    enterPrice: 'Isi harga untuk melihat totalnya.',
    fixInputs: 'Perbaiki isian yang ditandai di atas untuk melihat totalnya.',
  },

  breakEven: {
    title: `Balik modal jika 1 ${kept('KPM')} jual tambahan`,
    perYear: 'polis / tahun',
    perSix: 'polis / 6 bulan',
    perMonth: 'polis / bulan',
    explain: ({ ape, kom, komMoney, ovr, ovrMoney, bon, bonMoney, income, bold }) => (
      <>1 polis APE {ape}: komisi {kom} {komMoney} + overriding {ovr} {ovrMoney} + bonus {bon} {bonMoney} = {bold(income)}</>
    ),
  },

  actions: {
    use: `Pakai untuk ${kept('KPM')}`,
    confirm: 'Konfirmasi paket',
    whatsapp: 'Kirim penawaran',
    pdf: 'Buat PDF',
    saving: 'Menyimpan…',
    making: 'Membuat PDF…',
    confirmed: ({ branch }) => `Paket ${branch} dikonfirmasi`,
    saveFailed: 'Paket tidak dapat disimpan.',
    pdfFailed: 'PDF tidak dapat dibuat.',
  },

  offer: {
    greeting: ({ name }) => (name ? `Halo ${name},` : 'Halo,'),
    intro: ({ kpm }) => `berikut penawaran langganan ${kept('AgencyBoost')} untuk ${kpm}:`,
    period: ({ period, start, end }) => `Periode: ${period} (${start} – ${end})`,
    leaders: ({ n }) => `Jumlah ${kept('leader')}: ${n}`,
    rate: ({ money }) => `Harga: ${money} / ${kept('leader')} / bulan`,
    total: ({ money }) => `Total: ${money}`,
    saving: ({ money, pct }) => `Hemat ${money} (${pct}) dari harga standar`,
    perMonth: ({ money }) => `Atau ${money} per bulan.`,
  },

  dialog: {
    title: ({ branch }) => `Langganan ${branch}`,
    sub: ({ company, n }) => `${company} · ${n} ${kept('leader')} aktif`,
  },

  prices: {
    launch: 'Harga peluncuran — terkunci untuk pendaftaran sebelum Mar 2027',
    caption: 'Paket dan harga',
    plan: 'Paket',
    standard: 'Harga standar',
    offer: 'Harga penawaran',
    save: 'Hemat',
    perLeaderMonth: ({ money }) => `${money} /${kept('leader')}/bln`,
    custom: 'Harga khusus',
    perKpm: `diatur per ${kept('KPM')}`,
    period: 'Periode tagihan',
    periodValue: '6 bulan · Tahunan',
    annualDiscount: ({ pct, bold }) => <>Diskon tahunan {bold(pct)}</>,
    trial: 'Trial',
    trialValue: ({ days }) => `Gratis ${days} hari untuk ${kept('KPM')} baru`,
    note: `Harga per ${kept('leader')}; agent di bawah ${kept('leader')} tidak ditagih · harga baru berlaku di periode berikutnya`,
  },

  kpms: {
    summaryLabel: 'Ringkasan',
    revenue: 'Pendapatan per bulan',
    revenueSub: ({ n }) => `dari ${n} ${kept('KPM')} berbayar`,
    billed: `${kept('Leader')} ditagih`,
    billedSub: `di semua ${kept('KPM')}`,
    soon: 'Berakhir ≤ 30 hari',
    soonSub: 'perlu diperpanjang',
    action: 'Perlu tindakan',
    actionSub: 'lewat batas · berakhir',
    filterLabel: 'KPM yang ditampilkan',
    all: ({ n }) => `Semua ${n}`,
    needsAction: ({ n }) => `Perlu tindakan ${n}`,
    caption: `Langganan per ${kept('KPM')}`,
    columns: {
      kpm: kept('KPM'),
      used: `${kept('Leader')} dipakai`,
      rate: `Harga / ${kept('leader')}`,
      perMonth: 'Per bulan',
      perPeriod: 'Tagihan per periode',
      until: 'Berlaku hingga',
      manage: 'Tindakan',
    },
    total: ({ n }) => `Total · ${n} ${kept('KPM')}`,
    leaders: ({ n }) => `${n} ${kept('leader')}`,
    weighted: 'rata-rata tertimbang',
    perMonthSub: 'per bulan',
    running: 'semua periode berjalan',
    totalAction: ({ n }) => `${n} perlu tindakan`,
    usedOf: ({ used, max }) => `${used} dari ${max} ${kept('leader')} dipakai`,
    noLimit: 'tanpa batas',
    plan: ({ range }) => `paket ${range} ${kept('leader')}`,
    customPrice: 'harga khusus',
    billedAnnual: ({ pct }) => `tahunan · diskon ${pct}`,
    billedSix: '6 bulan',
    pills: {
      over: 'Melewati batas',
      ending_soon: 'Berakhir ≤ 30 hari',
      trial: 'Trial',
      ended: 'Berakhir',
      suspended: 'Ditangguhkan',
    },
    manage: 'Atur',
    manageOf: ({ branch }) => `Atur langganan ${branch}`,
    ownersNote: `Siapa owner, admin, dan core leader: di dalam ${kept('KPM')} › ${kept('KPM admins')}`,
    lapseNote: ({ days }) => `Tidak diperpanjang ${days} hari setelah berakhir = ${kept('KPM')} otomatis ditangguhkan`,
    empty: `Belum ada ${kept('KPM')}.`,
    emptyAction: 'Tidak ada yang perlu tindakan.',
  },
};

export const billingMessages = defineMessages({ en, id });
