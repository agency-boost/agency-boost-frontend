'use client';

import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { formatCalendarDay, formatMonthLong, formatNumber, formatRupiahCompact } from '@/lib/format';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import type { UnitTileSheetKind } from './unit-tiles';

/** Where *Lihat di New Hires* goes (P19.18-T1 AC-4): the full list, the reader's reach. */
export const NEW_HIRES_HREF = '/new-hires';

/**
 * **Who is behind a navy tile's number** (P19.18-T1 AC-4; ADR-0271 §3; `unit-overview-*` frames 5 and 7): a bottom sheet
 * on a phone, a centred card from 1024px (`ResponsiveSheet`). Downloaded the first time a tile is tapped (the bundle).
 *
 * - ***Active Agent · November*** — *2 dari 30 · dari data produksi yang diunggah* — each active person: photo (initials
 *   without one), NAME, *Unit X · APE Rp 12 Jt · 1 polis* that month, APE first then policies (the server's order).
 *   With the month not uploaded the line says so and nobody is listed: never a 0 that was not counted.
 * - ***Recruitment · November*** — *2 agent baru bergabung bulan ini* — each new hire who joined: photo, NAME, *Direkrut
 *   oleh AGUS PRASETYO · Bergabung 3 Nov 2026*, then an orange ***Lihat di New Hires***.
 *
 * The people are the server's (`tiles.activeAgent.people`, `tiles.recruitment.people`); names in capitals (the naming
 * rule), set by the stylesheet so a screen reader reads them as words. Nobody: one line in the sheet (L-01).
 */
export default function UnitTileSheet({
  kind, view, onClose,
}: { kind: UnitTileSheetKind; view: UnitDashboardView; onClose: () => void }) {
  const t = useMessages(unitDashboardMessages);
  const o = t.overview;
  const figures = useFigureLanguage();
  const month = formatMonthLong(view.month, figures);
  const number = (n: number) => formatNumber(n, {}, figures);

  if (kind === 'activeAgent') {
    const tile = view.tiles.activeAgent;
    const line = tile.count === null
      ? o.activeAgentNotUploaded
      : o.activeAgentLine({ count: number(tile.count), of: number(view.tiles.team.total) });
    return (
      <ResponsiveSheet open title={o.activeAgentTitle({ month })} description={line} onClose={onClose}>
        {tile.count !== null && tile.people.length === 0 && <p className="pb-4 text-md text-muted">{o.activeAgentNone}</p>}
        {tile.people.length > 0 && (
          <ul data-sheet-people="activeAgent" className="-mx-6 border-t border-divider pb-2">
            {tile.people.map((p) => (
              <SheetRow key={p.membershipId} id={p.membershipId} name={p.name} photoUrl={p.photoUrl}>
                {p.unit && (
                  <>
                    {p.unit.isReader ? t.prototype.yourUnitGroup : t.unitOf({ name: upper(p.unit.name) })}
                    {' · '}
                  </>
                )}
                {p.apeMinor !== null && <>{o.ape({ sum: formatRupiahCompact(p.apeMinor, {}, figures) })} · </>}
                {o.policies({ n: p.policies ?? 0 })}
              </SheetRow>
            ))}
          </ul>
        )}
      </ResponsiveSheet>
    );
  }

  const tile = view.tiles.recruitment;
  return (
    <ResponsiveSheet
      open
      title={o.recruitmentTitle({ month })}
      description={o.recruitmentLine({ n: tile.count })}
      onClose={onClose}
      footer={<ButtonLink href={NEW_HIRES_HREF} className="w-full rounded-pill">{o.seeInNewHires}</ButtonLink>}
    >
      {tile.people.length === 0 ? (
        <p className="pb-2 text-md text-muted">{o.recruitmentNone}</p>
      ) : (
        <ul data-sheet-people="recruitment" className="-mx-6 border-t border-divider">
          {tile.people.map((p) => (
            <SheetRow key={p.membershipId} id={p.membershipId} name={p.name} photoUrl={p.photoUrl}>
              {p.recruitedBy && <>{o.recruitedBy} <span className="uppercase">{p.recruitedBy.name}</span> · </>}
              {o.joined({ day: formatCalendarDay(p.joinDate, figures) })}
            </SheetRow>
          ))}
        </ul>
      )}
    </ResponsiveSheet>
  );
}

/** A name inside a sentence, in capitals (the naming rule): *Unit AGUS PRASETYO*. */
export const upper = (name: string) => name.toLocaleUpperCase('id-ID');

/** One person on a sheet: a 40px avatar, the NAME, and one grey line. */
function SheetRow({
  id, name, photoUrl, children,
}: { id: string; name: string; photoUrl: string | null; children: React.ReactNode }) {
  return (
    <li data-sheet-person={id} className="flex min-h-[3.75rem] items-center gap-2.5 border-b border-divider px-6 py-2">
      <Avatar name={name} photoUrl={photoUrl} seed={id} size={40} />
      <span className="min-w-0">
        <span className="block text-base font-bold uppercase text-ink">{name}</span>
        <span className="mt-0.5 block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
