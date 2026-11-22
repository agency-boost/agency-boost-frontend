'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import type { ConsoleKpmPeople, ConsolePerson } from '@/lib/admin-console';
import { toDisplayError } from '@/lib/api-client';
import { openViewAsWindow, ViewAsBlocked } from '@/lib/view-as';

type Role = keyof ConsoleKpmPeople['viewAs'];

const ICONS: Record<Role, NavIconName> = { owner: 'ti-crown', admin: 'ti-user-shield', ab: 'ti-users-group', agent: 'ti-user' };

/** A person as the picker writes them: the orange-label class first, then the NAME in capitals (spec §6). */
const personLabel = (p: ConsolePerson) => `${p.class === 'agent' ? '' : `${p.class.toUpperCase()} `}${p.fullName.toUpperCase()}`;

/**
 * ***Lihat sebagai*** (P19.23-T2 AC-7; the Super Admin spec §5; `superadmin-tablet` f12–f13): four cards — *KPM Owner ·
 * KPM Admin · AB · Agent* — each a picker of the real people of this KPM in that role (test accounts never), and *Buka
 * jendela baru*, which opens a new window showing what that person sees, view only and logged (`openViewAsWindow`, the
 * one-time handoff; ADR-0277 §4). A role with nobody in it says *Belum ada* and offers no button.
 */
export function ViewAsCards({ people, kpmName }: { people: ConsoleKpmPeople['viewAs']; kpmName: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const roles: Role[] = ['owner', 'admin', 'ab', 'agent'];
  return (
    <section aria-labelledby="view-as-heading">
      <h2 id="view-as-heading" className="mb-2 text-md font-bold text-navy">{t.viewAs}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-view-as="">
        {roles.map((role) => (
          <li key={role}>
            <ViewAsCard role={role} label={t.roles[role]} people={people[role]} kpmName={kpmName} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">{t.viewAsNote}</p>
    </section>
  );
}

function ViewAsCard({ role, label, people, kpmName }: { role: Role; label: string; people: ConsolePerson[]; kpmName: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const [chosen, setChosen] = useState(people[0]?.userId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = people.find((p) => p.userId === chosen) ?? null;

  function open() {
    if (!person) return;
    setBusy(true);
    setError(null);
    // Called inside the click: the window is opened before anything is awaited (`openViewAsWindow`).
    openViewAsWindow({ userId: person.userId, fullName: person.fullName }, t.viewAsReason({ role: label, kpm: kpmName }))
      .catch((err) => setError(err instanceof ViewAsBlocked ? t.blocked : toDisplayError(err).message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex h-full flex-col gap-2.5 rounded-xl bg-card p-3.5" data-view-as-role={role}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-pill-grey text-secondary-ink">
          <NavIcon name={ICONS[role]} className="h-5 w-5" />
        </span>
        <b className="text-md text-navy">{label}</b>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted">{t.noneYet}</p>
      ) : (
        <>
          <PickerMenu
            label={t.pickPerson({ role: label })}
            value={chosen}
            options={people.map((p) => ({ value: p.userId, label: personLabel(p) }))}
            onChange={setChosen}
            className="w-full"
          />
          <Button onClick={open} disabled={busy || !person} aria-busy={busy || undefined} className="mt-auto w-full gap-1.5">
            <NavIcon name="ti-external-link" className="h-[18px] w-[18px]" />
            {busy ? t.opening : t.openWindow}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-alert">{error}</p>}
    </div>
  );
}
