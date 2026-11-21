import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Tampilan KPM*** (`/kpm/settings/branding`, P19.6-T1; ADR-0218; *redrawn 2026-11-20 by P19.21-T4, ADR-0274*) and the
 * template's *Tampilan* section. **The words are the 19 November mockup's** (`data-upload-pengaturan-*-stopmotion`,
 * frame 24), verbatim: *Nama sistem*, *Logo*, *Logo persegi*, *Maskot*, *Warna utama*, *Warna kedua*, each with its
 * line, *Pilih file*, *Pratinjau langsung* and its phone, *Simpan*. §B7's *Kembalikan ke default* stays.
 *
 * **Read as written** (`useMessagesAsWritten`): this is the page that names the app, so the word *AgencyBoost* in it is
 * the default being replaced, never the KPM's name. **Kept English** (§A): *KPM*, *AgencyBoost*, *Boost* and
 * *Coaching*.
 *
 * @moved app/(tenant)/kpm/settings/branding/
 */
const en = {
  title: 'KPM branding',
  systemName: 'System name',
  systemNameHint: `Replaces the word “${kept('AgencyBoost')}” in this KPM’s app`,
  logo: 'Logo',
  logoHint: 'PNG/JPG/SVG ≤ 1 MB · 32 px high in the navbar',
  logoSquare: 'Square logo',
  logoSquareHint: 'PNG 512 × 512 · icon & favicon',
  /** Said under *Logo persegi* once it changes: a phone's home screen keeps the icon it was added with. */
  homeIcon: 'An icon already on a home screen keeps its picture until it is added again.',
  primary: 'Primary colour',
  primaryHint: 'Buttons, the active tab, progress bars',
  secondary: 'Secondary colour',
  secondaryHint: 'Header cards, chips, badges',
  hex: (o: { field: string }) => `${o.field}, hex`,
  mascot: 'Mascot',
  mascotHint: 'Transparent PNG ≥ 512 px · replaces Boost',
  poses: 'A picture per pose (optional)',
  pose: { thinking: 'Thinking', celebrating: 'Celebrating', pointing: 'Pointing', phone: 'On the phone' },
  choose: 'Choose file',
  replace: 'Replace',
  remove: 'Remove',
  uploading: 'Uploading…',
  contrast: (o: { ratio: string; side: 'light' | 'dark' }) =>
    `Text ${o.side === 'light' ? 'white' : 'dark'} reads ${o.ratio}:1 on it.`,
  adjusted: (o: { fill: string; ratio: string; side: 'light' | 'dark' }) =>
    `Adjusted to ${o.fill} so ${o.side === 'light' ? 'white' : 'dark'} text reads ${o.ratio}:1.`,
  preview: 'Live preview',
  previewNote: 'Colours and name change as you type',
  /** Data honesty: the phone's figures are a picture of the app, not this office's. */
  previewExample: 'Example figures',
  previewGreeting: 'Good morning,',
  previewTarget: 'Target this month',
  previewOfTarget: (o: { pct: string }) => `${o.pct} of target`,
  previewActive: 'Active',
  previewRecruit: 'Recruits',
  previewCoaching: kept('Coaching'),
  previewButton: 'Log activity',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved. Your members see it after a refresh.',
  reset: 'Reset to default',
  resetTitle: 'Reset to default?',
  resetToTemplate: 'Your KPM will show its template’s branding again.',
  resetToAgencyBoost: `Your KPM will show ${kept('AgencyBoost')}’s name, logo, colours and Boost again.`,
  resetConfirm: 'Reset',
  cancel: 'Cancel',
  conflict: 'Someone else saved this page. It has been read again.',
  viewOnly: 'You are viewing this office’s branding. Nothing here can be changed in this session.',
};

const id: MessagesOf<typeof en> = {
  title: 'Tampilan KPM',
  systemName: 'Nama sistem',
  systemNameHint: `Menggantikan tulisan "${kept('AgencyBoost')}" di aplikasi KPM ini`,
  logo: 'Logo',
  logoHint: 'PNG/JPG/SVG ≤ 1 MB · tinggi 32 px di navbar',
  logoSquare: 'Logo persegi',
  logoSquareHint: 'PNG 512 × 512 · ikon & favicon',
  homeIcon: 'Ikon yang sudah ada di layar utama tetap memakai gambar lamanya sampai ditambahkan lagi.',
  primary: 'Warna utama',
  primaryHint: 'Tombol, tab aktif, progress bar',
  secondary: 'Warna kedua',
  secondaryHint: 'Kartu header, chip, badge',
  hex: (o) => `${o.field}, hex`,
  mascot: 'Maskot',
  mascotHint: 'PNG transparan ≥ 512 px · menggantikan Boost',
  poses: 'Gambar per pose (opsional)',
  pose: { thinking: 'Berpikir', celebrating: 'Merayakan', pointing: 'Menunjuk', phone: 'Menelepon' },
  choose: 'Pilih file',
  replace: 'Ganti',
  remove: 'Hapus',
  uploading: 'Mengunggah…',
  contrast: (o) => `Teks ${o.side === 'light' ? 'putih' : 'gelap'} terbaca ${o.ratio}:1 di atasnya.`,
  adjusted: (o) => `Disesuaikan ke ${o.fill} agar teks ${o.side === 'light' ? 'putih' : 'gelap'} terbaca ${o.ratio}:1.`,
  preview: 'Pratinjau langsung',
  previewNote: 'Warna dan nama berubah langsung saat Anda mengetik',
  previewExample: 'Angka contoh',
  previewGreeting: 'Selamat pagi,',
  previewTarget: 'Target bulan ini',
  previewOfTarget: (o) => `${o.pct} dari target`,
  previewActive: 'Aktif',
  previewRecruit: 'Rekrut',
  previewCoaching: kept('Coaching'),
  previewButton: 'Catat aktivitas',
  save: 'Simpan',
  saving: 'Menyimpan…',
  saved: 'Tersimpan. Anggota Anda melihatnya setelah memuat ulang.',
  reset: 'Kembalikan ke default',
  resetTitle: 'Kembalikan ke default?',
  resetToTemplate: 'KPM Anda akan kembali menampilkan tampilan dari template-nya.',
  resetToAgencyBoost: `KPM Anda akan kembali menampilkan nama, logo, warna, dan Boost dari ${kept('AgencyBoost')}.`,
  resetConfirm: 'Kembalikan',
  cancel: 'Batal',
  conflict: 'Orang lain sudah menyimpan halaman ini. Halaman sudah dimuat ulang.',
  viewOnly: 'Anda sedang melihat tampilan kantor ini. Tidak ada yang bisa diubah di sesi ini.',
};

export const brandingMessages = defineMessages({ en, id });
