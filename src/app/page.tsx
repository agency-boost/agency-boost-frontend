import { AppShell, type NavSection } from '@/components/app-shell';
import { StatusPill } from '@/components/ui/status-pill';
import { RoleBadge } from '@/components/ui/role-badge';

/**
 * Phase 1 ships the shell and the primitives, not a feature. This page exists to prove
 * the layout, tokens and components render — the real screens arrive from Phase 6.
 */
const SECTIONS: readonly NavSection[] = [
  {
    label: 'Personal tools',
    items: [
      { label: 'Activity management', href: '/activity', active: true },
      { label: 'Leads management', href: '/leads' },
      { label: 'Goal settings', href: '/goals' },
      { label: 'Personal summary', href: '/summary' },
    ],
  },
  {
    label: 'Reporting',
    items: [{ label: 'Advanced analytics', href: '#', upcoming: true }],
  },
];

export default function Home() {
  return (
    <AppShell
      sections={SECTIONS}
      user={{ name: 'Not signed in', role: 'Phase 1 · foundation', initials: 'AB' }}
      title="AgencyBoost"
      subtitle="Engineering foundation. Product screens begin at Phase 6."
    >
      <div className="rounded-lg border border-hairline bg-card p-6">
        <h2 className="font-display text-xl font-bold">Design system check</h2>
        <p className="mt-1 text-md text-muted">
          Tokens, the three-valued status pill, and the single role vocabulary.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill status="success" />
          <StatusPill status="alert" />
          <StatusPill status="neutral" />
          <RoleBadge role="ab" />
          <RoleBadge role="aab" />
          <RoleBadge role="agent" />
        </div>
      </div>
    </AppShell>
  );
}
