'use client';

import { PageHeader } from '@/components/page-header';
import { HomeChart } from '@/components/home/home-chart';
import { HomeTiles } from '@/components/home/home-tiles';
import { NoDataLine, SamplePreview, useSampleName } from '@/components/sample-preview';
import { ActivityPill } from '@/components/ui/activity-pill';
import { ButtonLink, Card } from '@/components/ui/field';
import { PersonRow } from '@/components/ui/person-row';
import { useMessages } from '@/i18n/language-provider';
import { samplePreviewMessages } from '@/i18n/messages/sample-preview';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { isUnder } from '@/lib/field-nav';
import { SAMPLE_ID_PREFIX, SAMPLE_PEOPLE, sampleHomeView } from '@/lib/sample-data';

/**
 * ***Daftar ke KPM atau minta leader Anda menerima Anda dulu*** (P19-T4 AC-4; UI-166 items 1–2; ADR-0189 §5): what a
 * page that needs a KPM shows somebody who has joined none — its title, *Belum ada data*, a greyed *Contoh* of the
 * page, the owner's line, and **Cari / Daftar KPM** and **Cari leader**. Never *PERM_DENIED*, never *Tidak tersedia*.
 *
 * The sample is the page's own where it has one in reach (Home's tiles and chart); elsewhere a sample list of people,
 * the shape most field pages share. Nothing is read for it.
 */
export function NoKpmYet({ title, pathname }: { title?: string; pathname: string }) {
  const t = useMessages(samplePreviewMessages);
  return (
    <div data-no-kpm="" className="min-w-0">
      {title && <PageHeader title={title} />}
      <NoDataLine className="mt-0" />
      <SamplePreview
        sample={isUnder(pathname, '/home') ? <HomeSample /> : <ListSample />}
        message={t.noKpm.line}
        action={(
          <>
            <ButtonLink href="/user-management/kpm">{t.noKpm.findKpm}</ButtonLink>
            <ButtonLink href="/user-management/leader" variant="secondary">{t.noKpm.findLeader}</ButtonLink>
          </>
        )}
      />
    </div>
  );
}

/** Home's own tiles and chart, at sample figures (`sampleHomeView`). */
function HomeSample() {
  const view = sampleHomeView(dayInZone(OFFICE_TIME_ZONE, new Date()), { index: 0, text: '', person: '', pose: 'thinking' });
  return (
    <div className="flex flex-col gap-3">
      <HomeTiles view={view} />
      <HomeChart activity={view.activity} />
    </div>
  );
}

/** A list of sample people, each with a day's count: the shape of the field pages' lists. */
function ListSample() {
  const { person } = useSampleName();
  return (
    <Card className="p-0">
      <ul>
        {Array.from({ length: SAMPLE_PEOPLE }, (_, i) => (
          <li key={i} className="border-t border-divider first:border-t-0">
            <PersonRow
              name={person(i + 1)}
              seed={`${SAMPLE_ID_PREFIX}${i + 1}`}
              height={56}
              className="rounded-none bg-transparent"
              trailing={<ActivityPill count={[5, 2, 0][i]} />}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
