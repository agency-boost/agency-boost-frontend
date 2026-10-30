import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The shared components' own words** (UI V1, Phase 18.99 T2 — the report's *Shared components*; `components-and-
 * patterns.md`, *UI V1*). Built once and imported by every page that draws one: a sheet's ✕, a tree's ⌄, the daily
 * activity pill, the ratio card's header, the save state, the ⚡ marker, WhatsApp and Call and the number sheet behind
 * them, the agent search, the mascot. Words a caller owns — a pill's verdict, a tile's label, a confirmation — are the
 * caller's and come in as props.
 *
 * The report's own Indonesian wherever it gives it (Appendix A; UI-005, UI-019, UI-039, UI-059, UI-081, UI-101); the
 * rest proposed in §B.10 of the glossary for approval (O-8).
 *
 * @moved components/ui/responsive-sheet.tsx
 * @moved components/ui/person-row.tsx
 * @moved components/ui/activity-pill.tsx
 * @moved components/ratio-card.tsx
 * @moved components/ui/save-state.tsx
 * @moved components/ui/auto-marker.tsx
 * @moved components/contact-buttons.tsx
 * @moved components/agent-search.tsx
 * @moved components/ui/slider-with-value.tsx
 * @moved components/ui/stepper-row.tsx
 * @moved components/ui/action-row.tsx
 * @moved components/ui/stat-tile.tsx
 * @moved components/goal-hero-card.tsx
 * @moved components/boost.tsx
 */
const en = {
  /** A sheet's, a modal's and a popup's ✕ (UI-011, UI-035, UI-104). */
  close: 'Close',
  /** A tree's ⌄ at the right of a leader's row (UI-073): what it does, with whose team. */
  showTeam: ({ name }: { name: string }) => `Show ${name}’s team`,
  hideTeam: ({ name }: { name: string }) => `Hide ${name}’s team`,
  /** The daily activity pill (UI-059, UI-101; D-22): today's count, or nothing reported. */
  activities: ({ count }: { count: number }) => (count === 1 ? '1 activity' : `${count} activities`),
  notReported: 'Not reported',
  /** The ratio card (UI-053): its header inside the card, and a ratio's benchmark under its name. */
  ratio: {
    title: ({ days }: { days: number }) => `${kept('Ratio')} · last ${days} days`,
    target: ({ value }: { value: string }) => `${kept('Target')} ${value}`,
    /** A ratio with too little data: the card shows *–*, and a screen reader hears this. */
    noData: 'Not enough data',
    /** The split bar, read whole: *Selling 58% · Recruitment 42%*. */
    split: ({ first, firstShare, second, secondShare }: {
      first: string; firstShare: string; second: string; secondShare: string;
    }) => `${first} ${firstShare} · ${second} ${secondShare}`,
    none: 'No ratio applies here yet.',
    working: 'Working out the ratios…',
  },
  /** The save state beside an explicit save (UI-019, UI-039, UI-015). */
  save: {
    unsaved: 'Not saved yet',
    saving: 'Saving…',
    saved: 'Saved ✓',
    /** The browser's own question before leaving with unsaved text (UI-039); most browsers show their own words. */
    leave: 'You have changes that are not saved yet. Leave anyway?',
    leaveConfirm: 'Leave',
    stay: 'Stay',
  },
  /** The ⚡ beside an item that completes itself (UI-027, UI-061; D-25). */
  auto: {
    marker: 'Automatic',
    why: ({ name }: { name: string }) => `Why ${name} is automatic`,
  },
  /** WhatsApp and Call (UI-081, D-22), and the sheet that asks for a number first. */
  contact: {
    whatsApp: ({ name }: { name: string }) => `Send a WhatsApp message to ${name}`,
    call: ({ name }: { name: string }) => `Call ${name}`,
    sheetTitle: 'Enter WhatsApp number',
    field: 'WhatsApp number',
    save: 'Save',
    saving: 'Saving…',
    invalid: ({ min, max }: { min: number; max: number }) => `Enter ${min} to ${max} digits after +62.`,
    saved: 'Saved',
  },
  /** The agent search picker (UI-012, D-14). */
  search: {
    label: kept('Search agent'),
    searching: 'Searching…',
    none: 'Nobody found',
    /** The list's name, for a screen reader. */
    results: 'Agents found',
  },
  /** The slider's value, tapped to type an exact amount (UI-016). */
  slider: {
    typeExact: ({ label }: { label: string }) => `Type an exact amount for ${label}`,
    done: 'Done',
  },
  /** The action row's date and its controls (UI-061). */
  action: {
    changeDate: ({ text }: { text: string }) => `Change the date: ${text}`,
    remove: ({ text }: { text: string }) => `Remove: ${text}`,
    openLead: ({ name }: { name: string }) => `Open ${name}’s ${kept('lead')}`,
    done: ({ text }: { text: string }) => `Done: ${text}`,
  },
  /** A stat tile's ring, read as words (UI-003). */
  tile: {
    ring: ({ value }: { value: string }) => `${value} of the whole`,
  },
  /** The goal hero card's progress, read as words (UI-054). */
  goal: {
    progress: ({ value }: { value: string }) => `${value} of the ${kept('target')}`,
  },
};

const id: MessagesOf<typeof en> = {
  close: 'Tutup',
  showTeam: ({ name }) => `Tampilkan tim ${name}`,
  hideTeam: ({ name }) => `Sembunyikan tim ${name}`,
  activities: ({ count }) => `${count} aktivitas`,
  notReported: 'Belum lapor',
  ratio: {
    title: ({ days }) => `${kept('Ratio')} · ${days} hari terakhir`,
    target: ({ value }) => `${kept('Target')} ${value}`,
    noData: 'Data belum cukup',
    split: ({ first, firstShare, second, secondShare }) => `${first} ${firstShare} · ${second} ${secondShare}`,
    none: 'Belum ada ratio yang berlaku di sini.',
    working: 'Menghitung ratio…',
  },
  save: {
    unsaved: 'Belum disimpan',
    saving: 'Menyimpan…',
    saved: 'Tersimpan ✓',
    leave: 'Ada perubahan yang belum disimpan. Tetap tinggalkan halaman ini?',
    leaveConfirm: 'Tinggalkan',
    stay: 'Tetap di sini',
  },
  auto: {
    marker: 'Otomatis',
    why: ({ name }) => `Kenapa ${name} otomatis`,
  },
  contact: {
    whatsApp: ({ name }) => `Kirim pesan WhatsApp ke ${name}`,
    call: ({ name }) => `Telepon ${name}`,
    sheetTitle: 'Isi nomor WhatsApp',
    field: 'Nomor WhatsApp',
    save: 'Simpan',
    saving: 'Menyimpan…',
    invalid: ({ min, max }) => `Isi ${min} sampai ${max} digit setelah +62.`,
    saved: 'Tersimpan',
  },
  search: {
    label: kept('Search agent'),
    searching: 'Mencari…',
    none: 'Tidak ada yang ditemukan',
    results: 'Agen yang ditemukan',
  },
  slider: {
    typeExact: ({ label }) => `Ketik jumlah tepat untuk ${label}`,
    done: 'Selesai',
  },
  action: {
    changeDate: ({ text }) => `Ubah tanggal: ${text}`,
    remove: ({ text }) => `Hapus: ${text}`,
    openLead: ({ name }) => `Buka ${kept('lead')} ${name}`,
    done: ({ text }) => `Selesai: ${text}`,
  },
  tile: {
    ring: ({ value }) => `${value} dari keseluruhan`,
  },
  goal: {
    progress: ({ value }) => `${value} dari ${kept('target')}`,
  },
};

export const uiV1Messages = defineMessages({ en, id });
