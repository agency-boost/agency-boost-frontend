import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Unit Dashboard's *Potensi* tab's own words** (P19.1-T6; UI-155, UI-159 item 4; `functional/unit-dashboard.md`,
 * *November 2026*): the month picker, the two tiles, the cards' headers, the rows' pills, the empty states, an earlier
 * month's rows, and the two read-only sheets.
 *
 * **The Indonesian is the owner's**, verbatim from the 6 Nov handover (*Chat Agent Rina*, *Tambahkan ke unit ›*, *New
 * Hires ›*, *Rekrut ✓ 18 Nov*) and the 7 Nov mobile review (*Active Agent*, *potensi X*, the legend; MOB UI-186); the words
 * are always ***potensi*** and ***rekrut***, **never *calon* and never *kode*** (UI-155; a spec reads every view). *AA*,
 * *Potensi* and *Rekrut* are the named metrics' names (ADR-0193), the same in both languages. A role is the company's
 * rung, handed in short (*AB*, *AAB*, *Agent*, *BP*), and comes before a name wherever an agent sits beside a client or a
 * kandidat (*Agent Rina*). A day and a month are written by the caller in the figures' language.
 */
const en = {
  /** The month picker (UI-155: *November 2026 ⌄*, this month on open). */
  month: 'Month',
  /** The two tiles, which are the switch: their group's name. */
  tiles: 'Active Agent or Rekrut',
  /**
   * The first tile's label, ***Active Agent*** since the owner's review of 7 November (MOB UI-186, ADR-0229 §8: *"AA →
   * Active Agent"*); the figure is still `AA_THIS_MONTH`, and a card's header still says *AA*.
   */
  aa: kept('Active Agent'),
  rekrut: kept('Rekrut'),
  /** Under each tile's number (MOB UI-186): *potensi x*, the people with a lead of that type switched on. */
  tilePotensi: ({ n }: { n: number }) => `potensi ${n}`,
  /**
   * The legend under the tiles: the ✓'s words, and the number's — *potensi* on *Active Agent*, *potensi rekrut* on
   * *Rekrut*. *potensi* and *rekrut* are the tab's own words in both languages (ADR-0193), written as `potensi` is.
   */
  legend: 'What the marks mean',
  legendDone: kept('Active Agent'),
  legendNumber: ({ rekrut }: { rekrut: boolean }) => (rekrut ? 'potensi rekrut' : 'potensi'),
  /** A person's ✓, as a screen reader hears it: *Active Agent* on the first tile, *rekrut ✓* on the second. */
  done: ({ rekrut }: { rekrut: boolean }) => (rekrut ? 'rekrut ✓' : 'Active Agent'),
  /** A row's pills, left to right: *n potensi*, then the ✓ — *AA ✓*, *n rekrut ✓* — or ✕. */
  potensi: ({ n }: { n: number }) => `${n} potensi`,
  /** ✕'s name: a person with neither. */
  neither: 'No potensi and no ✓ yet',
  /**
   * A sheet's unit line: `role` the rung short, `name` as given. *The cards' titles are the Overview's own since P19.8-T4*
   * (*Unit Anda*, *Unit Sari Puspita*; MOB UI-179), where they read *UNIT AAB SARI PUSPITA* and *LANGSUNG KE AB AGUS*.
   */
  unit: ({ role, name }: { role: string; name: string }) => `Unit ${role} ${name}`,
  aaCounts: ({ potensi, aa }: { potensi: number; aa: number }) => `${potensi} potensi · ${aa} AA`,
  rekrutCounts: ({ potensi, rekrut }: { potensi: number; rekrut: number }) => `${potensi} potensi · ${rekrut} rekrut`,
  /** An earlier month's row (AC-9): *x* of the *y* people with a potensi got the ✓. */
  aaPast: ({ x, y, n }: { x: number; y: number; n: number }) => (y > 0 ? `potensi ${x}/${y} · ${n} AA` : `${n} AA`),
  rekrutPast: ({ x, y, n }: { x: number; y: number; n: number }) => (y > 0 ? `potensi ${x}/${y} rekrut` : `${n} rekrut`),
  /** A row's button: the person's sheet. */
  open: ({ name }: { name: string }) => `Open ${name}`,
  /** The sheets' titles (AC-6, AC-7): the role first. */
  aaSheet: ({ role, name, n }: { role: string; name: string; n: number }) => `${role} ${name} · ${n} potensi`,
  rekrutSheet: ({ role, name, n, r }: { role: string; name: string; n: number; r: number }) =>
    `${role} ${name} · ${n} potensi · ${r} rekrut`,
  /** A kandidat's pills: switched on, or joined on a day the caller writes. */
  kandidatPotensi: kept('Potensi'),
  rekrutOn: ({ day }: { day: string }) => `Rekrut ✓ ${day}`,
  newHires: kept('New Hires'),
  addToUnit: 'Add to unit',
  /** The sheet's one button: WhatsApp to the agent. */
  chat: ({ role, name }: { role: string; name: string }) => `Chat ${role} ${name}`,
  noSales: 'No potential closing switched on this month.',
  noKandidat: 'No kandidat switched on or joined this month.',
  loading: 'Loading the potensi…',
  loadingSheet: 'Loading…',
  tryAgain: 'Try again',
  close: 'Close',
};

const id: MessagesOf<typeof en> = {
  month: 'Bulan',
  tiles: `${kept('Active Agent')} atau ${kept('Rekrut')}`,
  aa: kept('Active Agent'),
  rekrut: kept('Rekrut'),
  // MOB UI-186, verbatim: *potensi X*, the legend's *✓ Active Agent · ① potensi* and *① potensi rekrut*.
  tilePotensi: ({ n }) => `potensi ${n}`,
  legend: 'Arti tanda',
  legendDone: kept('Active Agent'),
  legendNumber: ({ rekrut }) => (rekrut ? 'potensi rekrut' : 'potensi'),
  done: ({ rekrut }) => (rekrut ? 'rekrut ✓' : 'Active Agent'),
  potensi: ({ n }) => `${n} potensi`,
  neither: 'Belum ada potensi dan belum ada ✓',
  unit: ({ role, name }) => `Unit ${role} ${name}`,
  aaCounts: ({ potensi, aa }) => `${potensi} potensi · ${aa} ${kept('AA')}`,
  rekrutCounts: ({ potensi, rekrut }) => `${potensi} potensi · ${rekrut} rekrut`,
  aaPast: ({ x, y, n }) => (y > 0 ? `potensi ${x}/${y} · ${n} ${kept('AA')}` : `${n} ${kept('AA')}`),
  rekrutPast: ({ x, y, n }) => (y > 0 ? `potensi ${x}/${y} rekrut` : `${n} rekrut`),
  open: ({ name }) => `Buka ${name}`,
  aaSheet: ({ role, name, n }) => `${role} ${name} · ${n} potensi`,
  rekrutSheet: ({ role, name, n, r }) => `${role} ${name} · ${n} potensi · ${r} rekrut`,
  kandidatPotensi: kept('Potensi'),
  rekrutOn: ({ day }) => `Rekrut ✓ ${day}`,
  newHires: kept('New Hires'),
  addToUnit: 'Tambahkan ke unit',
  chat: ({ role, name }) => `Chat ${role} ${name}`,
  noSales: `Belum ada potensi ${kept('closing')} bulan ini.`,
  noKandidat: 'Belum ada kandidat potensi atau rekrut bulan ini.',
  loading: 'Memuat potensi…',
  loadingSheet: 'Memuat…',
  tryAgain: 'Coba lagi',
  close: 'Tutup',
};

export const unitPotensiMessages = defineMessages({ en, id });
