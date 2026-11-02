'use client';

import type { ReactNode, RefObject } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { Modal } from './modal';

/**
 * **The bottom sheet on a phone and a tablet, the centred modal on a desktop** (UI V1, the report's *Shared
 * components*: UI-011, UI-035; D-01). One component for the person sheet, the capability ladder, the invitations, the
 * phone number, the role sheet (UI-083) and the invite QR (UI-084).
 *
 * - **Below 1024px**: rises from the foot, the full width, a drag handle, the title, a ✕ of 44px; a swipe down from
 *   the head, a tap on the backdrop, the ✕ and Escape close it. At most 90% of the dynamic viewport (`dvh`), so a
 *   browser bar coming and going never covers its foot.
 * - **From 1024px**: a centred modal, ~560px wide; the ✕ and Escape close it, and the backdrop.
 * - **The main action is pinned** (D-01): `footer` stays at the foot, clear of the home indicator
 *   (`env(safe-area-inset-bottom)`), while the content above it scrolls.
 *
 * It is `Modal` (`placement="responsive"`), so it is drawn at the end of `<body>`, holds the focus in and gives it back,
 * holds the page still behind it, and counts as inside a modal for a popover that opened it (`inModal`).
 */
export function ResponsiveSheet({
  open,
  title,
  description,
  onClose,
  initialFocus,
  footer,
  className,
  children,
}: {
  open: boolean;
  title: string;
  /** A line under the title, read with it — a lead's name under *Isi nomor WhatsApp*. */
  description?: string;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  /** The main action, pinned at the foot (D-01). A form's submit names its form (`form={id}`). */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = useMessages(uiV1Messages);
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      initialFocus={initialFocus}
      placement="responsive"
      handle
      closeLabel={t.close}
      footer={footer}
      className={className}
    >
      {children}
    </Modal>
  );
}

/**
 * **A small popup in the middle of the screen, at every width** (UI-104's *Tugas* popup: *not a bottom sheet*). White,
 * 16px corners, 16px from the screen's edges, the page dimmed; the title with a ✕ of 44px; as tall as its content up
 * to 60% of the screen, then scrolling inside. A tap outside, the ✕ and Escape close it.
 */
export function CenterPopup({
  open,
  title,
  onClose,
  footer,
  className,
  children,
}: {
  open: boolean;
  /** *Tugas · Jum, 31 Okt (3)*. */
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = useMessages(uiV1Messages);
  return (
    <Modal open={open} title={title} onClose={onClose} placement="popup" closeLabel={t.close} footer={footer} className={className}>
      {children}
    </Modal>
  );
}
