'use client';

import { useRouter } from 'next/navigation';
import { AgentSearch } from '@/components/agent-search';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { agentHref } from '@/lib/agent-search';

/**
 * **The desktop sidebar's *Search agent*** (UI V1, UI-004, UI-012; D-14): the field shell's first section opens the
 * shared agent search picker (`components/agent-search.tsx`) over the page, focused, so a leader types a name or an
 * agent code at once. Picking somebody opens their agent dashboard and closes this; Escape, the backdrop and leaving
 * close it too (`Modal`).
 *
 * The box is tall enough for the picker's list to open inside it without scrolling the box.
 */
export function AgentSearchDialog({ onClose }: { onClose: () => void }) {
  const t = useMessages(uiV1Messages);
  const router = useRouter();
  return (
    <Modal open title={t.search.label} onClose={onClose} className="min-h-[24rem]">
      <AgentSearch
        autoFocus
        onPick={(hit) => {
          onClose();
          router.push(agentHref(hit.membershipId));
        }}
      />
    </Modal>
  );
}
