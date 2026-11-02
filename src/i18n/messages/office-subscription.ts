import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **An office's status and subscription, in words** (P18.98-T6, the Super Admin's console; `functional/tenant-provisioning.md`,
 * *The subscription*, *The module's own strings*): what `lib/admin.ts` writes — the *Status* column's word (*Active*,
 * *Ended — kept active* …), the *Lifecycle* card's subscription line, the *Leaders* cell as a screen reader hears it —
 * and the *Edit subscription* dialog's cost lines that cannot be worked out (`lib/billing.ts`' `costMissingWords`).
 * Apart from the console's pages, so every importer of `lib/admin.ts` carries these words only.
 *
 * **English is the source**, byte for byte what the console wrote before. The Indonesian is the approved glossary's —
 * *Aktif · Diarsipkan* (§B.3), *Berakhir* (§B.3 *Ended*), *ditangguhkan* (§B.6), *batas leader* and *harga per leader*
 * (§B.10, the API's) — with *leader* kept and counted in its English plural (§B.0 rule 8). **A figure is never a
 * message's**: a date is written by the caller in the figures' language and passed in.
 *
 * @moved lib/admin.ts
 */
const en = {
  /** A tenant's lifecycle, its own words (it is not a health signal). */
  status: { active: 'Active', suspended: 'Suspended', archived: 'Archived' },
  /** *Status* once the subscription's end has passed (ADR-0112 §2). */
  ended: 'Ended',
  endedKeptActive: 'Ended — kept active',
  /** The *Lifecycle* card's subscription line; `day` written in the figures' language. */
  noEndDate: 'No end date',
  endedOn: ({ day }: { day: string }) => `Ended ${day}`,
  endedOnKeptActive: ({ day }: { day: string }) => `Ended ${day} — kept active`,
  activeUntil: ({ day }: { day: string }) => `Active until ${day}`,
  /** The *Leaders* cell, said whole: *13 leaders of a limit of 10, 3 over*. */
  leadersSaid: ({ used, max, over }: { used: number; max: number | null; over: number }) => {
    const count = `${used} ${used === 1 ? 'leader' : 'leaders'}`;
    if (max === null) return `${count}, no limit`;
    return `${count} of a limit of ${max}${over > 0 ? `, ${over} over` : ''}`;
  },
  /** A cost line that cannot be worked out, and what it lacks (ADR-0157 §6). */
  costMissing: {
    price: 'no price per leader',
    limit: 'no maximum leaders',
    dates: 'no start and end dates',
    joined: ({ parts }: { parts: string[] }) => `— ${parts.join(' and ')}`,
  },
};

const id: MessagesOf<typeof en> = {
  status: { active: 'Aktif', suspended: 'Ditangguhkan', archived: 'Diarsipkan' },
  ended: 'Berakhir',
  endedKeptActive: 'Berakhir — tetap aktif',
  noEndDate: 'Tanpa tanggal berakhir',
  endedOn: ({ day }) => `Berakhir ${day}`,
  endedOnKeptActive: ({ day }) => `Berakhir ${day} — tetap aktif`,
  activeUntil: ({ day }) => `Aktif hingga ${day}`,
  leadersSaid: ({ used, max, over }) => {
    const count = `${used} ${used === 1 ? kept('leader') : kept('leaders')}`;
    if (max === null) return `${count}, tanpa batas`;
    return `${count} dari batas ${max}${over > 0 ? `, lebih ${over}` : ''}`;
  },
  costMissing: {
    price: `tanpa harga per ${kept('leader')}`,
    limit: `tanpa jumlah maksimal ${kept('leader')}`,
    dates: 'tanpa tanggal mulai dan tanggal berakhir',
    joined: ({ parts }) => `— ${parts.join(' dan ')}`,
  },
};

export const officeSubscriptionMessages = defineMessages({ en, id });
