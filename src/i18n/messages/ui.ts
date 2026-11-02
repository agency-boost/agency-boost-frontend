import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The shared primitives' own words** (`components/ui/`; P18.98-T4, the shared pieces; `components-and-patterns.md`,
 * *Words*): what a primitive says by itself, whatever screen draws it — the code field's label, the error banner's
 * client-side outcomes, a confirmation's *Cancel*, the date field's *Choose a date*, a copy button, the invite's QR,
 * the reorder controls' names, the stepper's, the pager, the password's *Show*, the progress bar, the status pill, the
 * cascade's spoken sentence, the skeletons' labels, and why a form's button is held (`lib/disabled-reason.ts`).
 *
 * **English is the source**, byte for byte what the primitives wrote before; the Indonesian is the approved glossary's
 * (§B.1–§B.5: *Batal*, *Kode*, *Memuat…*, *Sesuai target*, *Data belum cukup*, *Naikkan · Turunkan*, *Sebelumnya*,
 * *Berikutnya*, *Target belum diatur*; *tautan*, *kata sandi*, §B.0 rule 6), with what it lacked proposed in the
 * glossary for approval's §B.10 (*P18.98-T4, the shared pieces*). **Kept** (§A): *benchmark*. A label a caller hands a
 * primitive — a row's name, a field's, a table's caption — is the caller's, in the caller's language, or content as
 * typed. **A figure is never a message's**: a caller writes it and passes it in.
 *
 * Read by a component with `useMessages(uiMessages)`; by a function outside React with `messagesIn(uiMessages,
 * language)`, its language its last parameter (`heldBecause`). `field.tsx` and `skeleton.tsx` read no hook — the first
 * is reached from the server's graph, the second is drawn by `loading.tsx` — so their words are drawn by small client
 * components (`ui-words.tsx`, `loading-words.tsx`).
 *
 * @moved components/ui/
 * @moved lib/disabled-reason.ts
 * @moved lib/api-client.ts
 * @moved lib/browser-errors.ts
 */

/** `a`, `a and b`, `a, b and c` — each language its own *and*. */
const listedWith = (and: string) => (items: readonly string[]) =>
  (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`);

/**
 * A caption as the middle of a sentence. English lower-cases it whole, as it always has; Indonesian lower-cases its
 * first letter only, and only where it begins a lower-case word, so *Anda*, *KPM* and a kept term keep their capitals.
 */
const lowerFirst = (text: string) => (/^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLowerCase() + text.slice(1) : text);

const en = {
  /** `CodeField`'s label (§B.4). */
  code: 'Code',
  /** A confirmation's other button (`Dialog`, §B.1). */
  cancel: 'Cancel',
  /**
   * **The outcomes the browser composes itself**, which no server answered (`toDisplayError`, `api()`): the request
   * never arrived, the screen broke, the app is misconfigured, and a server answer with no body. `ErrorBanner` draws
   * them in the reader's language from their English (`error-words.tsx`), so no caller of `toDisplayError` changes.
   */
  errors: {
    network: 'Could not reach the server. Check your connection and try again.',
    unexpected: 'Something went wrong on this screen. Reload the page — if it keeps happening, tell '
      + 'your administrator, and quote this screen’s address.',
    /** A server answer that carried no error of its own: a proxy's page, an empty body. */
    noAnswer: 'Something went wrong. Please try again.',
    /**
     * The app is misconfigured: `detail` is `ApiConfigError`'s sentence for whoever deploys it — a variable's name and
     * how to set it — which English shows as it is, and Indonesian after a sentence of its own.
     */
    config: ({ detail }: { detail: string }) => detail,
  },
  /** `DateField`'s face with nothing chosen (P18.96-T2). */
  chooseDate: 'Choose a date',
  /** `CopyableValue`. */
  copy: {
    action: 'Copy',
    copied: 'Copied.',
    failed: 'Could not copy — select the text above and copy it yourself.',
  },
  /** `InviteQr`. */
  qr: {
    alt: 'QR code for this invite link',
    drawing: 'Drawing…',
    failed: 'Could not draw the QR — use the link or the code.',
  },
  /** `DragHandle`, named for what it moves. */
  reorder: ({ label }: { label: string }) => `Reorder ${label}. Press the up or down arrow to move it.`,
  /** `ReorderArrows` (§B.1 *Move up · Move down*). */
  moveUp: ({ label }: { label: string }) => `Move ${label} up`,
  moveDown: ({ label }: { label: string }) => `Move ${label} down`,
  /** `Stepper`, named for the activity it counts. */
  stepper: {
    decrease: ({ label }: { label: string }) => `Decrease ${label}`,
    count: ({ label }: { label: string }) => `Count for ${label}`,
    increase: ({ label }: { label: string }) => `Increase ${label}`,
  },
  /** `Pager`: `page` and `pages` written by the caller. */
  pager: {
    previous: 'Previous',
    next: 'Next',
    page: ({ page, pages }: { page: string; pages: string }) => `Page ${page} of ${pages}`,
  },
  /** `PasswordInput`: the word drawn, and the name a screen reader hears. */
  password: {
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  /** `ProgressBar`: `value` and `target` written by the caller. */
  progress: {
    noTarget: 'No target set',
    of: ({ value, target }: { value: string; target: string }) => `${value} of ${target}`,
  },
  /** `StatusPill`'s three states (§B.3). */
  status: {
    success: 'On track',
    alert: 'Below benchmark',
    neutral: 'Not enough data',
  },
  /** `CascadeRow`'s rate between two stages, as a screen reader hears it: `rate` written by the caller. */
  cascadeLink: ({ rate, from, to }: { rate: string; from: string; to: string }) =>
    `${rate} from ${from.toLowerCase()} to ${to.toLowerCase()}`,
  /** The skeletons' labels, said once to a screen reader (§B.2 *Loading…*, *Loading {the thing}…*). */
  loading: {
    any: 'Loading…',
    people: 'Loading people…',
    tree: 'Loading the tree…',
    table: ({ caption }: { caption: string }) => `Loading ${caption.toLowerCase()}…`,
  },
  /** Why a form's one button is held (`heldBecause`): the fields still empty, in their own labels. */
  stillNeeded: ({ fields }: { fields: readonly string[] }) => `Still needed: ${listedWith('and')(fields)}.`,
};

const id: MessagesOf<typeof en> = {
  code: 'Kode',
  cancel: 'Batal',
  errors: {
    network: 'Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.',
    unexpected: 'Terjadi kesalahan di layar ini. Muat ulang halaman. Jika terus terjadi, beri tahu administrator Anda '
      + 'dan sebutkan alamat layar ini.',
    noAnswer: 'Terjadi kesalahan. Silakan coba lagi.',
    config: ({ detail }) => `Aplikasi ini belum dikonfigurasi dengan benar. Untuk pengembang: ${detail}`,
  },
  chooseDate: 'Pilih tanggal',
  copy: {
    action: 'Salin',
    copied: 'Disalin.',
    failed: 'Tidak dapat menyalin — pilih teks di atas, lalu salin sendiri.',
  },
  qr: {
    alt: 'Kode QR untuk tautan undangan ini',
    drawing: 'Membuat kode QR…',
    failed: 'Tidak dapat membuat kode QR — gunakan tautan atau kodenya.',
  },
  reorder: ({ label }) => `Ubah urutan ${label}. Tekan panah atas atau bawah untuk memindahkannya.`,
  moveUp: ({ label }) => `Naikkan ${label}`,
  moveDown: ({ label }) => `Turunkan ${label}`,
  stepper: {
    decrease: ({ label }) => `Kurangi ${label}`,
    count: ({ label }) => `Jumlah ${label}`,
    increase: ({ label }) => `Tambah ${label}`,
  },
  pager: {
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    page: ({ page, pages }) => `Halaman ${page} dari ${pages}`,
  },
  password: {
    show: 'Tampilkan',
    hide: 'Sembunyikan',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
  },
  progress: {
    noTarget: `${kept('Target')} belum diatur`,
    of: ({ value, target }) => `${value} dari ${target}`,
  },
  status: {
    success: 'Sesuai target',
    alert: `Di bawah ${kept('benchmark')}`,
    neutral: 'Data belum cukup',
  },
  // The stages are kept terms (§A.6), written as the column names them.
  cascadeLink: ({ rate, from, to }) => `${rate} dari ${from} ke ${to}`,
  loading: {
    any: 'Memuat…',
    people: 'Memuat daftar orang…',
    tree: 'Memuat bagan…',
    table: ({ caption }) => `Memuat ${lowerFirst(caption)}…`,
  },
  stillNeeded: ({ fields }) => `Masih diperlukan: ${listedWith('dan')(fields)}.`,
};

export const uiMessages = defineMessages({ en, id });
