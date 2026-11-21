import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Lihat sebagai*'s new window** (P19.23-T2 AC-7; ADR-0277; `app/view-as/page.tsx`): the few words the window shows
 * while it takes up its session, and when it cannot. Its reader is the Super Admin, in their own language — the person
 * they are about to see as has no say in it (`LanguageProvider`'s `follow`).
 *
 * **English is the source.** The Indonesian follows the approved glossary: *Lihat sebagai* (§A.2's view-as), *Hanya
 * melihat* (UI-151). **Kept**: *Super Admin*, *KPM*.
 *
 * @moved app/view-as/
 */
const en = {
  title: 'View as',
  opening: 'Opening their view…',
  line: 'This window shows exactly what they see. You can only look, and every page you open is recorded.',
  noCode: 'This window opened without its one-time code. Close it and open it again from the KPM page.',
  signedOut: `Sign in as a ${kept('Super Admin')} in this browser first, then open the window again from the ${kept('KPM')} page.`,
  close: 'Close this window',
  back: `Back to the ${kept('KPM')} list`,
};

const id: MessagesOf<typeof en> = {
  title: 'Lihat sebagai',
  opening: 'Membuka tampilannya…',
  line: 'Jendela ini menampilkan persis yang dilihat orang itu. Anda hanya bisa melihat, dan setiap halaman tercatat.',
  noCode: 'Jendela ini terbuka tanpa kode sekali pakainya. Tutup, lalu buka lagi dari halaman KPM.',
  signedOut: `Masuk dulu sebagai ${kept('Super Admin')} di browser ini, lalu buka lagi jendelanya dari halaman ${kept('KPM')}.`,
  close: 'Tutup jendela ini',
  back: `Kembali ke daftar ${kept('KPM')}`,
};

export const viewAsMessages = defineMessages({ en, id });
