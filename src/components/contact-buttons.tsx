'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import type { Channel } from '@/components/phone-number-sheet';
import { LineIcon } from '@/components/ui/line-icon';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import type { Lead } from '@/lib/leads';
import { callLink, saveLeadPhone, saveMemberPhone, whatsAppHref } from '@/lib/phone-number';
import { useOpenedOnce } from '@/lib/use-opened-once';

/** WhatsApp's chat link with a message typed in: `lib/phone-number.ts`' (P18.99-T16), re-exported for this module's importers. */
export { whatsAppHref } from '@/lib/phone-number';

/**
 * ***Isi nomor WhatsApp***, downloaded the first time a button without a number is pressed, and mounted from then on
 * (`useOpenedOnce`; P18.99-T16, the bundle): most rows have a number, and a tap on them opens WhatsApp, not the sheet.
 */
const PhoneNumberSheet = dynamic(() => import('@/components/phone-number-sheet').then((m) => m.PhoneNumberSheet), { ssr: false });


/**
 * **WhatsApp and Call, always enabled** (UI V1, UI-081; D-22) — the Coaching Session's leads, `/leads`, Home's *Aksi
 * hari ini* and *Laporan tim*, the person sheet and New hire detail.
 *
 * - **Round, solid, 36–40px** (`size`), with line icons: WhatsApp in its green, Call in navy. Never disabled, never
 *   the 📞 emoji. A 44px target on a phone and a tablet, the circle drawn inside it.
 * - **With a number** each is a plain link: one tap opens WhatsApp (`https://wa.me/62…`, with `whatsAppText` typed in
 *   where there is one) or the dialler (`tel:+62…`). No sheet, no confirmation.
 * - **Without one** a tap opens ***Isi nomor WhatsApp*** (`PhoneNumberSheet`): the number is saved through `onSave` —
 *   to the lead, or to the member's account — the toast says *Tersimpan*, and WhatsApp (or the dialler) opens. The next
 *   tap goes straight through, because the caller now holds the number (`onSaved`).
 *
 * `channels` leaves one out — Home's *Laporan tim* has WhatsApp only.
 */
export function ContactButtons({
  name,
  phone,
  onSave,
  onSaved,
  whatsAppText,
  channels = ['whatsapp', 'call'],
  size = 40,
  className,
}: {
  /** Whose number: the lead's or the person's name, in each button's name and under the sheet's title. */
  name: string;
  phone: string | null | undefined;
  /** Saves a number (already `+62…`) and answers it as stored. */
  onSave: (phone: string) => Promise<string>;
  /** The stored number, so the caller's row holds it and the next tap goes straight through. */
  onSaved?: (phone: string) => void;
  whatsAppText?: string;
  channels?: readonly Channel[];
  /** The circle, in px: 36 to 40. */
  size?: 36 | 40;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const { toast, show } = useToast();
  const [asking, setAsking] = useState<Channel | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const sheetOpened = useOpenedOnce(asking !== null);
  const number = saved ?? phone ?? null;
  const links: Record<Channel, string | null> = {
    whatsapp: whatsAppHref(number, whatsAppText),
    call: callLink(number),
  };

  const circle = cn(
    'flex shrink-0 items-center justify-center rounded-full text-white',
    size === 36 ? 'h-9 w-9' : 'h-10 w-10',
  );
  const tap = 'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full lg:h-auto lg:w-auto';

  const button = (channel: Channel) => {
    const label = channel === 'whatsapp' ? t.contact.whatsApp({ name }) : t.contact.call({ name });
    const face = (
      <span className={cn(circle, channel === 'whatsapp' ? 'bg-whatsapp' : 'bg-navy')}>
        <LineIcon name={channel === 'whatsapp' ? 'whatsapp' : 'phone'} className={size === 36 ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </span>
    );
    const href = links[channel];
    return href ? (
      <a
        key={channel}
        href={href}
        target={channel === 'whatsapp' ? '_blank' : undefined}
        rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}
        aria-label={label}
        data-channel={channel}
        className={tap}
      >
        {face}
      </a>
    ) : (
      <button key={channel} type="button" aria-label={label} data-channel={channel} className={tap} onClick={() => setAsking(channel)}>
        {face}
      </button>
    );
  };

  return (
    <span data-contact-buttons="" className={cn('relative z-[1] inline-flex items-center gap-1.5', className)}>
      {channels.map(button)}
      {sheetOpened && (
        <PhoneNumberSheet
          open={asking !== null}
          name={name}
          phone={number}
          onClose={() => setAsking(null)}
          onSave={onSave}
          then={asking ?? 'whatsapp'}
          whatsAppText={whatsAppText}
          onSaved={(stored) => {
            setSaved(stored);
            setAsking(null);
            show(t.contact.saved);
            onSaved?.(stored);
          }}
        />
      )}
      <Toast toast={toast} />
    </span>
  );
}

/**
 * **A lead's WhatsApp and Call** (UI-081): the number saves to the lead (`PATCH /leads/:id`, its `contact`, pinned by
 * its `version`), and `onSaved` hands back the lead as the server now has it.
 */
export function LeadContactButtons({
  lead,
  onSaved,
  channels,
  size,
  className,
}: {
  lead: Pick<Lead, 'id' | 'name' | 'contact' | 'version'>;
  onSaved?: (lead: Lead) => void;
  /** Which buttons: both by default; `/leads`' cards draw WhatsApp alone (UI-105). */
  channels?: readonly Channel[];
  size?: 36 | 40;
  className?: string;
}) {
  const latest = useRef<Lead | null>(null);
  return (
    <ContactButtons
      name={lead.name}
      phone={lead.contact?.phone ?? null}
      channels={channels}
      size={size}
      className={className}
      onSave={async (phone) => {
        const next = await saveLeadPhone(lead, phone);
        latest.current = next;
        return next.contact.phone ?? phone;
      }}
      onSaved={() => { if (latest.current) onSaved?.(latest.current); }}
    />
  );
}

/**
 * **A member's WhatsApp** (UI-101's reminder; the person sheet; New hire detail): the number saves to their account
 * (`PUT /members/:membershipId/phone`, a leader for somebody they coach — D-22). Call too, unless `channels` says not.
 */
export function MemberContactButtons({
  membershipId,
  name,
  phone,
  whatsAppText,
  channels,
  onSaved,
  size,
  className,
}: {
  membershipId: string;
  name: string;
  phone: string | null | undefined;
  whatsAppText?: string;
  channels?: readonly Channel[];
  onSaved?: (phone: string) => void;
  size?: 36 | 40;
  className?: string;
}) {
  return (
    <ContactButtons
      name={name}
      phone={phone}
      whatsAppText={whatsAppText}
      channels={channels}
      size={size}
      className={className}
      onSave={async (typed) => (await saveMemberPhone(membershipId, typed)).phone}
      onSaved={onSaved}
    />
  );
}
