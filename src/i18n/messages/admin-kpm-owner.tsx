import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Ganti pemilik* to a named person** (P19.4-T3 AC-6; ADR-0212 §3; the setup spec's A-R1): the owner page's words.
 * *Retired 2026-11-20 (P19.23-T2; ADR-0277):* *KPM baru*'s three steps (now a sheet on the KPM list, `admin-console.ts`)
 * and the Owner's card on the old KPM page.
 *
 * **The Indonesian is the setup spec's and the flow report's, verbatim where they give it** (*Pemilik KPM*, *No.
 * WhatsApp*, *Kode agen pemilik*, *"Lewati, nanti saja"*, *"KPM dibuat. Undangan dikirim."*, *Kirim ulang undangan*,
 * *Ganti pemilik*, *"2 bagian punya perubahan yang belum terbit. KPM baru memakai versi terakhir yang terbit."*, *Buka
 * template*). **Where the mockup says the invitation goes by WhatsApp, it does not** (ADR-0212 §4, ADR-0010): the
 * hint under the number says it is kept to call, and the email's says the invitation goes there — parity row I-755.
 */

const en = {
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

};

const id: MessagesOf<typeof en> = {
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

  newPerson: {
    heading: 'Jadikan pemilik dan undang',
    line: 'Akun dibuat untuk alamat ini, dan pemilik dikirimi tautan lewat email untuk membuat kata sandi.',
    send: 'Kirim undangan lewat email',
    submit: 'Jadikan pemilik dan undang',
    invited: 'Pemilik ditetapkan. Undangan dikirim.',
    set: 'Pemilik ditetapkan.',
    pending: ({ name }) => `${name} tercatat sebagai pemilik ${kept('KPM')} ini tetapi belum punya email. Ketik emailnya untuk mengundang.`,
  },

};

export const adminKpmOwnerMessages = defineMessages({ en, id });
