import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The leader limit, in plain words** (P18.98-T4, people and forum; ADR-0113 §2, ADR-0157; `functional/org-hierarchy.md`,
 * *The office's leader limit*): the refusal as every screen that can meet it says it (`components/leader-limit-notice.tsx`
 * — a role change, an approval, an Owner's assignment, a roster import), the ask of AgencyBoost, the line a request
 * waits on, and what it asks for (`lib/leader-limit-requests.ts`'s `requestedChange`).
 *
 * **English is the source.** Each refusal is one whole sentence per language, built in its own order from what was being
 * done and what may be done next. *AgencyBoost*, the roles and *leader* are kept (§A.5, §A.6), with *leaders* in a count
 * (§B.0 rule 8); *office* is *KPM* (§B.9). *Edit subscription* is the Super Admin's control, named as its screen names
 * it. No code reaches these words.
 *
 * @moved components/leader-limit-notice.tsx
 * @moved lib/leader-limit-requests.ts
 */

/** What was being done when the limit was met, and what the reader may do next: the sentence's two halves. */
interface Refusal {
  /** The office's `maxLeaders`, `null` when the refusal does not say it. */
  max: number | null;
  action: 'role' | 'owner' | 'roster';
  /** `platform`: the Super Admin's, who raises it below; `roster`, `ask` and `raise`: the office's way on. */
  next: 'platform' | 'roster' | 'ask' | 'raise';
}

/** A run of words drawn bold, or as the link to the offices list. */
type Wrap = (words: string) => ReactNode;

const en = {
  refused: ({ max, action, next }: Refusal): string => {
    const limit = max === null
      ? 'This office has reached its leader limit'
      : `This office has reached its limit of ${max} ${max === 1 ? 'leader' : 'leaders'}`;
    const what = action === 'owner'
      ? ', so its new Owner cannot be added as an AB.'
      : action === 'roster'
        ? ', so the ABs and AABs in this file cannot be added.'
        : ', so nobody else can be made an AB or an AAB.';
    const then = next === 'roster'
      ? ' Import them as Agents, then promote them on their page: past the limit, that asks AgencyBoost to approve it.'
      : next === 'ask'
        ? ' Ask AgencyBoost to approve this one past the limit, or to raise it.'
        : next === 'raise' ? ' AgencyBoost can raise it.' : '';
    return `${limit}${what} Leaders are ABs and AABs together, the Owner included.${then}`;
  },
  /** The Super Admin's way on (`audience="platform"`): raise it on the offices list. */
  platformAdvice: ({ strong, link, roster }: { strong: Wrap; link: Wrap; roster: boolean }) => (
    <>
      Raise it with {strong('Edit subscription')} on the {link('offices list')}
      {roster ? ' first, or import them as Agents.' : ' first, then try again.'}
    </>
  ),
  /** The ask (ADR-0157 §1). */
  ask: 'Ask AgencyBoost to approve',
  asking: 'Asking…',
  /** A request waiting (ADR-0157 §2), and its withdrawal. */
  waiting: "Waiting for AgencyBoost's approval",
  cancelRequest: 'Cancel request',
  cancelling: 'Cancelling…',
  /** What a request to let a pending leader in asks for: *Let in as AAB*. A promotion is *Agent → AAB*, no words. */
  letInAs: ({ rung }: { rung: string }) => `Let in as ${rung}`,
};

const id: MessagesOf<typeof en> = {
  refused: ({ max, action, next }) => {
    const limit = max === null
      ? `${kept('KPM')} ini sudah mencapai batas ${kept('leader')}-nya`
      : `${kept('KPM')} ini sudah mencapai batas ${max} ${max === 1 ? kept('leader') : kept('leaders')}`;
    const what = action === 'owner'
      ? `, sehingga ${kept('Owner')} barunya tidak dapat ditambahkan sebagai ${kept('AB')}.`
      : action === 'roster'
        ? `, sehingga ${kept('AB')} dan ${kept('AAB')} di file ini tidak dapat ditambahkan.`
        : `, sehingga tidak ada lagi yang dapat dijadikan ${kept('AB')} atau ${kept('AAB')}.`;
    const then = next === 'roster'
      ? ` Impor mereka sebagai ${kept('Agent')}, lalu naikkan perannya di halaman masing-masing: jika melewati batas, itu akan meminta persetujuan ${kept('AgencyBoost')}.`
      : next === 'ask'
        ? ` Minta ${kept('AgencyBoost')} menyetujui yang satu ini melewati batas, atau menaikkan batasnya.`
        : next === 'raise' ? ` ${kept('AgencyBoost')} dapat menaikkannya.` : '';
    return `${limit}${what} Yang dihitung sebagai ${kept('leader')} adalah ${kept('AB')} dan ${kept('AAB')}, termasuk ${kept('Owner')}.${then}`;
  },
  platformAdvice: ({ strong, link, roster }) => (
    <>
      Naikkan batasnya dengan {strong('Ubah langganan')} di {link(`daftar ${kept('KPM')}`)}
      {roster ? ` terlebih dahulu, atau impor mereka sebagai ${kept('Agent')}.` : ' terlebih dahulu, lalu coba lagi.'}
    </>
  ),
  ask: `Minta persetujuan ${kept('AgencyBoost')}`,
  asking: 'Meminta…',
  waiting: `Menunggu persetujuan ${kept('AgencyBoost')}`,
  cancelRequest: 'Batalkan permintaan',
  cancelling: 'Membatalkan…',
  letInAs: ({ rung }) => `Diterima sebagai ${rung}`,
};

export const leaderLimitMessages = defineMessages({ en, id });
