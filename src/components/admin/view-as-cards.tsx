'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import type { ConsoleKpmPeople, ConsolePerson } from '@/lib/admin-console';
import { toDisplayError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { usePhone } from '@/lib/use-phone';
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
 *
 * *Changed 2026-11-22 (P19.29-T4 AC-1, AC-3; UI-211, UI-213 (21 Nov); ADR-0287 §3):* **on a phone, one card**
 * (`ViewAsOneCard`). From 768px the four cards and the sentence under them are as they were.
 */
export function ViewAsCards({ people, kpmName }: { people: ConsoleKpmPeople['viewAs']; kpmName: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const phone = usePhone();
  const roles: Role[] = ['owner', 'admin', 'ab', 'agent'];
  if (phone) return <ViewAsOneCard people={people} kpmName={kpmName} />;
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

/**
 * *Buka jendela baru* for one person, as a card's role names them: busy while the window opens, the browser's refusal
 * in words. Called inside the click, so the window is opened before anything is awaited (`openViewAsWindow`).
 */
function useOpenWindow(kpmName: string) {
  const t = useMessages(adminConsoleMessages).inside;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function open(person: ConsolePerson | null, label: string) {
    if (!person) return;
    setBusy(true);
    setError(null);
    openViewAsWindow({ userId: person.userId, fullName: person.fullName }, t.viewAsReason({ role: label, kpm: kpmName }))
      .catch((err) => setError(err instanceof ViewAsBlocked ? t.blocked : toDisplayError(err).message))
      .finally(() => setBusy(false));
  }
  return { busy, error, open };
}

/**
 * ***Lihat sebagai* on a phone: one card** (P19.29-T4 AC-1, AC-3; UI-211, UI-213 (21 Nov); the stop motion's `newLihat`,
 * section D frame 12): the heading and its ⓘ — what the four cards' sentence said, *"Jendela baru menampilkan persis…"*,
 * behind it — four role chips *Owner · Admin · AB · Agent* (13/600, 44px), one person picker for the role chosen, and one
 * *Buka jendela baru*. It opens on the first role with somebody in it; a role with nobody says *Belum ada*, and the button
 * is not live. The window, its reason and its log are the four cards' (`useOpenWindow`).
 */
function ViewAsOneCard({ people, kpmName }: { people: ConsoleKpmPeople['viewAs']; kpmName: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const roles: Role[] = ['owner', 'admin', 'ab', 'agent'];
  const [role, setRole] = useState<Role>(roles.find((r) => people[r].length > 0) ?? 'owner');
  const [chosen, setChosen] = useState<Record<Role, string>>({
    owner: people.owner[0]?.userId ?? '',
    admin: people.admin[0]?.userId ?? '',
    ab: people.ab[0]?.userId ?? '',
    agent: people.agent[0]?.userId ?? '',
  });
  const { busy, error, open } = useOpenWindow(kpmName);
  const list = people[role];
  const person = list.find((p) => p.userId === chosen[role]) ?? null;
  const label = t.roles[role];
  return (
    <section aria-labelledby="view-as-heading" className="flex flex-col gap-2.5 rounded-xl bg-card p-3.5" data-view-as="" data-view-as-card="">
      <div className="flex items-center justify-between gap-2">
        <h2 id="view-as-heading" className="text-row font-bold text-navy">{t.viewAsShort}</h2>
        <TippedGlyph glyph={<LineIcon name="info" className="h-[18px] w-[18px]" />} name={t.viewAsTipName} tip={t.viewAsTip} align="fit" />
      </div>
      <div role="group" aria-label={t.viewAsRole} className="grid grid-cols-4 gap-1.5" data-view-as-roles="">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === role}
            onClick={() => setRole(r)}
            className={cn(
              'min-h-11 min-w-0 truncate rounded-pill border px-1 text-base font-semibold',
              r === role ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-navy hover:bg-hover-row',
            )}
          >
            {t.rolesShort[r]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="flex min-h-11 items-center text-base text-muted">{t.noneYet}</p>
      ) : (
        <PickerMenu
          key={role}
          label={t.pickPerson({ role: label })}
          value={chosen[role]}
          options={list.map((p) => ({ value: p.userId, label: personLabel(p) }))}
          onChange={(userId) => setChosen((was) => ({ ...was, [role]: userId }))}
          className="w-full"
        />
      )}
      <Button onClick={() => open(person, label)} disabled={busy || !person} aria-busy={busy || undefined} className="w-full gap-1.5">
        <NavIcon name="ti-external-link" className="h-[18px] w-[18px]" />
        {busy ? t.opening : t.openWindow}
      </Button>
      {error && <p role="alert" className="text-sm text-alert">{error}</p>}
    </section>
  );
}

function ViewAsCard({ role, label, people, kpmName }: { role: Role; label: string; people: ConsolePerson[]; kpmName: string }) {
  const t = useMessages(adminConsoleMessages).inside;
  const [chosen, setChosen] = useState(people[0]?.userId ?? '');
  const { busy, error, open: openFor } = useOpenWindow(kpmName);
  const person = people.find((p) => p.userId === chosen) ?? null;

  function open() {
    openFor(person, label);
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
