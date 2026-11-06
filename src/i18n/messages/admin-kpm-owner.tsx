import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A KPM made with its Owner, and the Owner's invitation** (P19.4-T3 AC-6, AC-9, AC-14; ADR-0212; the setup spec's
 * A-R1, A2, A5-1; SA UI-014, SA UI-019): *KPM baru*'s three steps — the KPM, ***Pemilik KPM***, *"Kirim undangan …
 * sekarang"* — and the draft warning below *Mulai dari*; *Ganti pemilik* to a named person; and the Owner's card on the
 * KPM's *Ringkasan* (`components/admin/kpm-owner-card.tsx`), with *Aktif · Diundang · Belum diundang* and *Kirim ulang
 * undangan*.
 *
 * **The Indonesian is the setup spec's and the flow report's, verbatim where they give it** (*Pemilik KPM*, *No.
 * WhatsApp*, *Kode agen pemilik*, *"Lewati, nanti saja"*, *"KPM dibuat. Undangan dikirim."*, *Kirim ulang undangan*,
 * *Ganti pemilik*, *"2 bagian punya perubahan yang belum terbit. KPM baru memakai versi terakhir yang terbit."*, *Buka
 * template*). **Where the mockup says the invitation goes by WhatsApp, it does not** (ADR-0212 §4, ADR-0010): the
 * hint under the number says it is kept to call, and the email's says the invitation goes there — parity row I-755.
 *
 * @moved components/admin/kpm-owner-card.tsx
 */

const en = {
  /** *KPM baru*'s steps (A2; SA UI-014). */
  steps: {
    details: 'KPM details',
    owner: 'KPM owner',
    invitation: 'Invitation',
    /** `n` of `of`, said before each step's heading to a screen reader. */
    stepOf: ({ n, of }: { n: number; of: number }) => `Step ${n} of ${of}`,
  },
  owner: {
    name: 'Name',
    phone: 'WhatsApp number',
    phoneHint: 'Kept on the KPM and shown on its page, to call. Nothing is sent to it.',
    phoneError: 'Type a full WhatsApp number, e.g. 0812 3456 7890.',
    nameError: 'Type the owner’s name.',
    email: 'Email',
    emailHint: 'The invitation goes here. Without one, the owner waits until you add it with “Ganti pemilik”.',
    emailError: 'Type a whole email address.',
    agentCode: 'Owner’s agent code',
    agentCodeHint: 'Their code at the insurer. Needed when they have no AgencyBoost account yet: they become this KPM’s AB.',
    required: 'Required.',
    optional: 'Optional.',
    skip: 'Skip, do it later',
    skipped: 'No owner yet: set one later from the KPM’s page. It stays under “Needs your attention” until then.',
    undoSkip: 'Add the owner now',
  },
  invitation: {
    send: 'Send the owner an invitation now. If not, send it later from the KPM’s page.',
    noEmail: 'With no email the owner cannot be invited yet: the KPM is made and they wait, named.',
    importLine: 'Members are imported by the KPM’s Owner or an Admin, on People.',
  },
  /** SA UI-019, AC-14: below *Mulai dari*, when the chosen template has drafts. */
  drafts: ({ n }: { n: number }) => n === 1
    ? '1 section has changes that are not published. A new KPM uses the latest published version.'
    : `${n} sections have changes that are not published. A new KPM uses the latest published version.`,
  openTemplate: 'Open template',
  /** The toast on the KPM's page (A2). */
  created: 'KPM created. Invitation sent.',
  createdNoInvitation: 'KPM created.',

  /** *Ganti pemilik* to somebody with no account yet (ADR-0212 §3), where `mailto:` stood. */
  newPerson: {
    heading: 'Make them the owner and invite them',
    line: 'An account is made for this address, and the owner is emailed a link to choose a password.',
    send: 'Send the invitation by email',
    submit: 'Make owner and invite',
    invited: 'Owner set. Invitation sent.',
    set: 'Owner set.',
    pending: ({ name }: { name: string }) =>
      `${name} is named as this KPM’s owner but has no email yet. Type their email to invite them.`,
  },

  /** The Owner's card on *Ringkasan* (AC-9; A2). */
  card: {
    title: kept('Owner'),
    noOwner: 'No owner yet. Nobody can run this KPM until one is set.',
    state: {
      active: 'Active',
      invited: 'Invited',
      not_invited: 'Not invited',
    },
    invitedOn: ({ date }: { date: string }) => `Invitation sent ${date}`,
    whatsapp: ({ name }: { name: string }) => `Open WhatsApp to ${name}`,
    resend: 'Send the invitation again',
    resending: 'Sending…',
    resent: 'Invitation sent again.',
    change: 'Change owner',
    assign: 'Set owner',
    openAsOwner: 'Open as Owner',
  },
};

const id: MessagesOf<typeof en> = {
  steps: {
    details: `Detail ${kept('KPM')}`,
    owner: `Pemilik ${kept('KPM')}`,
    invitation: 'Undangan',
    stepOf: ({ n, of }) => `Langkah ${n} dari ${of}`,
  },
  owner: {
    name: 'Nama',
    phone: 'No. WhatsApp',
    phoneHint: `Disimpan di ${kept('KPM')} dan tampil di halamannya, untuk dihubungi. Tidak ada yang dikirim ke nomor ini.`,
    phoneError: 'Isi nomor WhatsApp yang lengkap, mis. 0812 3456 7890.',
    nameError: 'Isi nama pemilik.',
    email: 'Email',
    emailHint: 'Undangan dikirim ke sini. Tanpa email, pemilik menunggu sampai Anda mengisinya lewat “Ganti pemilik”.',
    emailError: 'Isi alamat email yang lengkap.',
    agentCode: 'Kode agen pemilik',
    agentCodeHint: `Kodenya di perusahaan asuransi. Wajib bila belum punya akun ${kept('AgencyBoost')}: dia menjadi ${kept('AB')} di ${kept('KPM')} ini.`,
    required: 'Wajib.',
    optional: 'Opsional.',
    skip: 'Lewati, nanti saja',
    skipped: `Belum ada pemilik: tetapkan nanti dari halaman ${kept('KPM')}. Sampai saat itu tercatat di “Perlu perhatian Anda”.`,
    undoSkip: 'Isi pemilik sekarang',
  },
  invitation: {
    send: `Kirim undangan ke pemilik sekarang. Jika tidak, kirim nanti dari halaman ${kept('KPM')}.`,
    noEmail: `Tanpa email, pemilik belum bisa diundang: ${kept('KPM')} dibuat dan pemiliknya menunggu, tercatat namanya.`,
    importLine: `Anggota diimpor oleh ${kept('Owner')} atau ${kept('Admin')} ${kept('KPM')}, di menu ${kept('People')}.`,
  },
  drafts: ({ n }) => `${n} bagian punya perubahan yang belum terbit. ${kept('KPM')} baru memakai versi terakhir yang terbit.`,
  openTemplate: 'Buka template',
  created: `${kept('KPM')} dibuat. Undangan dikirim.`,
  createdNoInvitation: `${kept('KPM')} dibuat.`,

  newPerson: {
    heading: 'Jadikan pemilik dan undang',
    line: 'Akun dibuat untuk alamat ini, dan pemilik dikirimi tautan lewat email untuk membuat kata sandi.',
    send: 'Kirim undangan lewat email',
    submit: 'Jadikan pemilik dan undang',
    invited: 'Pemilik ditetapkan. Undangan dikirim.',
    set: 'Pemilik ditetapkan.',
    pending: ({ name }) => `${name} tercatat sebagai pemilik ${kept('KPM')} ini tetapi belum punya email. Ketik emailnya untuk mengundang.`,
  },

  card: {
    title: kept('Owner'),
    noOwner: `Belum ada pemilik. Tidak ada yang bisa menjalankan ${kept('KPM')} ini sampai pemilik ditetapkan.`,
    state: {
      active: 'Aktif',
      invited: 'Diundang',
      not_invited: 'Belum diundang',
    },
    invitedOn: ({ date }) => `Undangan dikirim ${date}`,
    whatsapp: ({ name }) => `Buka WhatsApp ke ${name}`,
    resend: 'Kirim ulang undangan',
    resending: 'Mengirim…',
    resent: 'Undangan dikirim ulang.',
    change: 'Ganti pemilik',
    assign: 'Tetapkan pemilik',
    openAsOwner: `Buka sebagai ${kept('Owner')}`,
  },
};

export const adminKpmOwnerMessages = defineMessages({ en, id });
