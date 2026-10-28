'use client';

import { pillClass, TD as TRACKER_TD, TrackerHeaders } from '@/components/leader-forum/action-items';
import { Chips, ScorecardNotes, ScorecardTable, StatsTitle } from '@/components/leader-forum/scorecard';
import { TABS_COPY } from '@/lib/leader-meeting-tabs';
import { AGENDA_SECTIONS, FORUM_COPY, type MeetingView } from '@/lib/leader-meetings';

/**
 * **A4, landscape** (P18.97-T1 AC-18, I-494): the slide's seven columns fit across without clipping. While a meeting's
 * page is open, its print is this layout alone, so the page size is the meeting's.
 */
const LANDSCAPE = '@media print { @page { size: A4 landscape; margin: 10mm; } }';

/**
 * **The print layout** (`KPM_Owner.html:2662-2695`, `renderPrintMom`; `functional/leader-forum.md`, *Printing*):
 * what *Save as PDF* prints in place of the tab — *Overview & Stats*, *Agenda* (the three columns side by side, each
 * item's text and *"PIC: {name}"*, no boxes) and *Action Items* (the six named columns, the status as its pill).
 *
 * ***Overview & Stats* prints the screen's own table** since P18.97-T1 (AC-18; the client's *Save as PDF* against the
 * reference slide): the title and *AS OF*, the strip, the seven columns with their two-line headers and the two groups,
 * the hatch, the outline, every target as its text, and the numbered footnotes and *(\*)* notes — which take the place
 * of the print's *†* and its line (P18.1-T3). A past meeting prints its frozen figures.
 *
 * Off the screen and on the paper (`hidden print:block`, `:744`, `:762-764`); the page around it hides its own
 * chrome. **It draws what the page holds**, so it is never stale (the prototype's can be, flow doc §2.9). It writes
 * nothing.
 */
export function PrintLayout({ meeting }: { meeting: MeetingView }) {
  const { scorecard } = meeting;
  const h3 = 'mb-3 mt-6 text-lg font-extrabold text-navy first:mt-0';
  return (
    <section className="hidden font-body text-navy print:block">
      <style>{LANDSCAPE}</style>
      <h3 className={h3}>{FORUM_COPY.tabs.overview}</h3>
      <StatsTitle meeting={meeting} print />
      <Chips chips={scorecard.chips} />
      <ScorecardTable meeting={meeting} print />
      <ScorecardNotes scorecard={scorecard} />

      <h3 className={h3}>{FORUM_COPY.tabs.agenda}</h3>
      {/* `.agenda-cols` in print (`:765`): the three side by side. */}
      <div className="grid grid-cols-3 items-start gap-4">
        {AGENDA_SECTIONS.map((section) => (
          <div key={section} className="break-inside-avoid rounded-lg border border-hairline bg-card px-4 pb-3 pt-4">
            <h4 className="mb-3 text-md font-extrabold text-navy">{TABS_COPY.sections[section]}</h4>
            {meeting.agenda[section].map((item) => (
              <div key={item.id} className="mb-3">
                <div className="text-base leading-[1.4] text-navy">{item.text}</div>
                <div className="mt-0.5 text-xs text-muted">{`${TABS_COPY.pic} ${item.pic || '—'}`}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h3 className={h3}>{FORUM_COPY.tabs.actions}</h3>
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        <table className="relative w-full border-collapse text-left text-base">
          <thead>
            <tr><TrackerHeaders /></tr>
          </thead>
          <tbody>
            {meeting.actionItems.map((a) => (
              <tr key={a.id} className="break-inside-avoid [&:last-child>td]:border-b-0">
                <td className={TRACKER_TD}>{a.initiative}</td>
                <td className={TRACKER_TD}>{a.metric}</td>
                <td className={TRACKER_TD}>{a.action}</td>
                <td className={TRACKER_TD}>{a.pic}</td>
                <td className={TRACKER_TD}><span className={pillClass(a.status)}>{TABS_COPY.statuses[a.status]}</span></td>
                <td className={TRACKER_TD}>{a.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
