'use client';

import type { ReactNode } from 'react';
import { PlatformTabs } from '@/components/admin/platform/platform-tabs';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformMessages } from '@/i18n/messages/admin-platform';

/**
 * ***Platform*** (`/admin/platform/*`; P19.23-T6; ADR-0279; frames f52–f55): the title and the four sections' tabs —
 * *Audit log · Tim Super Admin · Pengaturan platform · Pengumuman* — shared by the four pages; a phone's dropdown in their
 * place (spec §12). Inside the console's own gate; each section's page gates itself by its own permission.
 */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  const t = useMessages(adminPlatformMessages);
  return (
    <Page title={t.title}>
      <PlatformTabs />
      {children}
    </Page>
  );
}
