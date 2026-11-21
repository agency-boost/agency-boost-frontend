'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { groupsMessages } from '@/i18n/messages/groups';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  createInformalGroup, groupOfAb, readInformalGroups, setAbGroup, type InformalGroupsView,
} from '@/lib/informal-groups';

/** The AB whose group is chosen. Only an AB carries a group; the whole team moves with them. */
export interface GroupDialogAb {
  membershipId: string;
  name: string;
  /** The label before the name: *AB*. */
  role?: string;
  /** Their AB group's size, them included: *9 orang ikut pindah bersama Agus*. Absent: *seluruh tim ikut pindah*. */
  people?: number;
}

/** *Tanpa group*: no group, as a radio's value. */
const NONE = '';

/**
 * ***Group untuk {AB}*** — the Group dialog (P19.17-T4; ADR-0270 §1, §2; the approved `kpm-overview-v2-tablet` frames 11–12
 * and `people-tablet` frames 5–6): the KPM's informal groups as radio options, the AB's own chosen, *Tanpa group*, **+
 * Group baru**, the link *Kelola semua group di All members ›*, and *Batal* / *Simpan*. Shared by KPM Overview ›
 * *Performa vs target*, All members' group chip and Advanced analytics › *Informal group*.
 *
 * - **Only an AB's group changes** (`PUT /members/:ab/group`); their AABs and agents follow, so *Simpan* moves the whole
 *   team, and `onSaved` gets the groups as they now stand so the page regroups at once.
 * - ***Group baru*** turns the dialog into the name-only form — *Nama group*, *"{AB} dan timnya masuk ke group ini · group
 *   leader ditunjuk nanti"*, *Batal* / *Buat group* — which makes the group with the AB in it (`POST /members/groups`).
 *   Group Leaders are appointed later.
 * - **A centred dialog, a bottom sheet on a phone** (`ResponsiveSheet`), the list scrolling under a pinned foot.
 * - Its states (L-01): the list waits as a skeleton; *Simpan* with the group already chosen only closes; a refusal stays in
 *   the dialog. The server refuses anybody who is not a steward of the KPM, and a group on anybody but an AB.
 */
export function GroupDialog({
  ab, manageHref = '/people/members', onClose, onSaved,
}: {
  ab: GroupDialogAb;
  /** *Kelola semua group di All members ›*: where it goes; `null` leaves it out — All members itself. */
  manageHref?: string | null;
  onClose: () => void;
  onSaved: (view: InformalGroupsView) => void;
}) {
  const t = useMessages(groupsMessages);
  const formId = useId();
  const nameId = useId();
  const [view, setView] = useState<InformalGroupsView | null>(null);
  const [current, setCurrent] = useState<string>(NONE);
  const [picked, setPicked] = useState<string>(NONE);
  const [step, setStep] = useState<'pick' | 'new'>('pick');
  const [name, setName] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readInformalGroups()
      .then((answer) => {
        if (!live) return;
        const mine = groupOfAb(answer, ab.membershipId)?.groupId ?? NONE;
        setView(answer);
        setCurrent(mine);
        setPicked(mine);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [ab.membershipId]);

  const focusName = () => document.getElementById(nameId)?.focus();
  useEffect(() => {
    if (step === 'new') focusName();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the field's id is stable for the dialog's life.
  }, [step]);

  const role = ab.role ?? 'AB';
  const first = ab.name.split(' ')[0] ?? ab.name;
  const line = ab.people !== undefined ? t.group.moves({ role, n: ab.people, first }) : t.group.movesAll({ role });

  const run = async (write: () => Promise<InformalGroupsView>) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await write());
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !view) return;
    if (step === 'new') {
      const typed = name.trim();
      if (!typed) {
        setMissing(true);
        focusName();
        return;
      }
      await run(async () => (await createInformalGroup(typed, ab.membershipId)).view);
      return;
    }
    if (picked === current) {
      onClose();
      return;
    }
    await run(() => setAbGroup(ab.membershipId, picked === NONE ? null : picked));
  };

  const options = view ? [...view.groups.map((g) => ({ value: g.groupId, label: g.name })), { value: NONE, label: t.noGroup }] : [];
  const footer = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="secondary"
        className="min-h-12 w-full rounded-pill"
        onClick={() => (step === 'new' ? setStep('pick') : onClose())}
      >
        {t.cancel}
      </Button>
      <Button type="submit" form={formId} className="min-h-12 w-full rounded-pill" disabled={!view || busy}>
        {step === 'new' ? (busy ? t.group.creating : t.group.create) : busy ? t.saving : t.save}
      </Button>
    </div>
  );

  return (
    <ResponsiveSheet
      open
      title={step === 'new' ? t.group.newTitle : t.group.title({ name: ab.name })}
      description={step === 'new' ? undefined : line}
      onClose={onClose}
      footer={footer}
    >
      <form id={formId} onSubmit={submit} noValidate data-group-dialog="" className="pb-2">
        {step === 'new' ? (
          <div data-new-group="">
            <label htmlFor={nameId} className="mb-1.5 block text-base font-semibold text-navy">{t.group.name}</label>
            <TextInput
              id={nameId}
              value={name}
              maxLength={80}
              invalid={missing}
              aria-describedby={missing ? `${nameId}-missing` : `${nameId}-line`}
              onChange={(e) => {
                setName(e.target.value);
                if (missing && e.target.value.trim()) setMissing(false);
              }}
            />
            {missing && <p id={`${nameId}-missing`} className="mt-1 text-sm text-alert">{t.group.nameMissing}</p>}
            <p id={`${nameId}-line`} className="mt-2 text-sm text-muted">{t.group.newLine({ name: ab.name })}</p>
          </div>
        ) : view ? (
          <>
            <fieldset>
              <legend className="sr-only">{t.group.options}</legend>
              <ul className="space-y-2">
                {options.map((o) => (
                  <li key={o.value || 'none'}>
                    <label
                      className={cn(
                        'flex min-h-12 cursor-pointer items-center gap-3 rounded-row border px-3 text-md text-navy',
                        picked === o.value ? 'border-secondary font-semibold' : 'border-hairline',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${formId}-group`}
                        value={o.value}
                        checked={picked === o.value}
                        onChange={() => setPicked(o.value)}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-secondary"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
                    </label>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => { setStep('new'); setError(null); }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-row border border-hairline px-3 text-md font-semibold text-primary-ink"
                  >
                    <LineIcon name="plus" />
                    {t.group.newGroup}
                  </button>
                </li>
              </ul>
            </fieldset>
            {manageHref !== null && (
              <p className="mt-3 text-sm">
                <Link href={manageHref} className="text-muted underline-offset-2 hover:text-navy hover:underline">{t.group.manage}</Link>
              </p>
            )}
          </>
        ) : !error && (
          <Skeleton label={t.loading}>
            <div className="space-y-2">
              <SkeletonBar className="h-12 w-full" />
              <SkeletonBar className="h-12 w-full" />
              <SkeletonBar className="h-12 w-full" />
            </div>
          </Skeleton>
        )}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}

export default GroupDialog;
