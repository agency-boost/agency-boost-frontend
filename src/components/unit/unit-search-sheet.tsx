'use client';

import { AgentSearch } from '@/components/agent-search';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';

/**
 * ***Search agent* on a phone and a tablet** (UI V1, UI-012; D-14, O-13): the title row's search pill opens the shared
 * picker (`AgentSearch`) in the shared sheet, focused. Picking somebody opens their agent dashboard; ✕, a swipe, the
 * backdrop and Escape close it. Loaded on demand by the screen (`next/dynamic`).
 */
export default function UnitSearchSheet({ onClose }: { onClose: () => void }) {
  const t = useMessages(uiV1Messages);
  return (
    <ResponsiveSheet open title={t.search.label} onClose={onClose} className="min-h-[60dvh]">
      <AgentSearch autoFocus />
    </ResponsiveSheet>
  );
}
