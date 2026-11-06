'use client';

import { StatTile } from '@/components/ui/stat-tile';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { formatNumber, percentOf } from '@/lib/format';
import type { HomeLeader } from '@/lib/home';
import { SectionHeading } from './home-actions';

/**
 * ***Tim saya*** on Home (P19-T4 AC-2; UI-159 item 2; ADR-0189 §4): **every leader's**, with or without a team, so Home
 * alone says the reader has team tools — four of the Unit Dashboard's tiles (`StatTile`), each the whole of one link:
 *
 * | Tile | Number | At zero, its one call to action | Opens |
 * |---|---|---|---|
 * | *Anggota tim* | everybody in the Group but the reader | *Belum ada anggota · Tambah agent pertama →* | `/new-hires` (*+ Tambah agent*), else `/group-tree` |
 * | *Coaching minggu ini* | coached in the last 7 days, *dari* manpower (`COACHED_7D`) | *Mulai coaching →* | `/coaching` |
 * | *Recruitment pipeline* | `RECRUITMENT_PIPELINE_NOW` over the Group | *Rencanakan recruitment →* | `/recruitment/attack-plan`, else `/leads` |
 * | *New hires* | the Group's new hires before a first sale | *Tambah agent baru →* | `/new-hires` |
 *
 * Every figure is the server's (`GET /home`'s `leader`). Two by two on a phone and from 1024px, four in a row on a
 * tablet. The call to action is the tile's grey line, in the accent's ink; at zero the tile goes where it says.
 */
export function HomeTimSaya({ leader, className }: { leader: HomeLeader; className?: string }) {
  const t = useMessages(homeMessages).timSaya;
  const unit = useMessages(unitDashboardMessages).v1;
  const figures = useFigureLanguage();
  const number = (n: number) => formatNumber(n, {}, figures);
  const cta = (text: string) => <span data-tim-saya-cta="" className="font-semibold text-primary-ink">{text}</span>;
  const { members, coached7d, recruitmentPipeline, newHires } = leader;

  return (
    <section data-home-tim-saya="" aria-labelledby="home-tim-saya" className={className}>
      <SectionHeading id="home-tim-saya" title={t.heading} />
      <div className="grid grid-cols-2 gap-2 md:max-lg:grid-cols-4 lg:gap-2.5">
        <StatTile
          href={members > 0 ? '/group-tree' : '/new-hires'}
          label={t.members}
          value={number(members)}
          sub={members > 0 ? undefined : cta(t.cta.members)}
        />
        <StatTile
          href="/coaching"
          label={t.coached}
          value={number(coached7d.count)}
          unit={coached7d.of > 0 ? unit.of({ of: number(coached7d.of) }) : undefined}
          ring={coached7d.of > 0 ? { percent: percentOf(coached7d.count, coached7d.of) } : undefined}
          sub={coached7d.count > 0 ? undefined : cta(t.cta.coached)}
        />
        <StatTile
          href={recruitmentPipeline > 0 ? '/leads' : '/recruitment/attack-plan'}
          label={t.recruitment}
          value={number(recruitmentPipeline)}
          sub={recruitmentPipeline > 0 ? undefined : cta(t.cta.recruitment)}
        />
        <StatTile
          href="/new-hires"
          label={t.newHires}
          value={number(newHires)}
          sub={newHires > 0 ? undefined : cta(t.cta.newHires)}
        />
      </div>
    </section>
  );
}
