'use client';

import { Fragment } from 'react';
import { pillClass, TD as TRACKER_TD, TrackerHeaders } from '@/components/leader-forum/action-items';
import { Chips, rowClasses, ScorecardHead, SectionRow } from '@/components/leader-forum/scorecard';
import { cn } from '@/lib/cn';
import { cellText, printLeftOutLine, SECTION_BEFORE, TABS_COPY } from '@/lib/leader-meeting-tabs';
import { AGENDA_SECTIONS, COLUMN_KEYS, FORUM_COPY, type MeetingView } from '@/lib/leader-meetings';

/**
 * **The print layout** (`KPM_Owner.html:2662-2695`, `renderPrintMom`; `functional/leader-forum.md`, *Printing*):
 * what *Save as PDF* prints in place of the tab — *Overview & Stats* (the chips and the table, *pending data* in
 * plain type, the blocked cells navy), *Agenda* (the three columns side by side, each item's text and *"PIC:
 * {name}"*, no boxes) and *Action Items* (the six named columns, the status as its pill). No footnotes, as there.
 *
 * **A figure over part of its period carries *†*, and one line under the table names the months** (P18.1-T3, data
 * honesty): the screen's tooltip does not print.
 *
 * Off the screen and on the paper (`hidden print:block`, `:744`, `:762-764`); the page around it hides its own
 * chrome. **It draws what the page holds**, so it is never stale (the prototype's can be, flow doc §2.9), and a
 * past meeting prints its frozen scorecard. It writes nothing.
 */
export function PrintLayout({ meeting }: { meeting: MeetingView }) {
  const { scorecard } = meeting;
  const h3 = 'mb-3 mt-6 text-lg font-extrabold text-navy first:mt-0';
  const leftOut = printLeftOutLine(scorecard);
  return (
    <section className="hidden font-body text-navy print:block">
      <h3 className={h3}>{FORUM_COPY.tabs.overview}</h3>
      <Chips chips={scorecard.chips} />
      <div className="mb-2 overflow-hidden rounded-lg border border-hairline bg-card">
        <table className="w-full border-collapse text-left text-base">
          <ScorecardHead periods={scorecard.periods} />
          <tbody>
            {scorecard.rows.map((row) => {
              const classes = rowClasses(row);
              return (
                <Fragment key={row.key}>
                  {SECTION_BEFORE[row.key] && <SectionRow name={SECTION_BEFORE[row.key]!} />}
                  <tr className={cn('break-inside-avoid', classes.tr)}>
                    <th scope="row" className={cn(CELL, 'text-left', classes.name)}>{TABS_COPY.rows[row.key]}</th>
                    {COLUMN_KEYS.map((column) => {
                      const cell = row.cells[column];
                      return cell.kind === 'blocked'
                        ? <td key={column} className={cn(CELL, 'bg-navy')} />
                        : (
                          <td key={column} className={CELL}>
                            {cellText(row, cell)}
                            {/* A figure over part of its period, marked for the line under the table. */}
                            {cell.kind === 'figure' && cell.leavesOut.length > 0 && '†'}
                          </td>
                        );
                    })}
                    {row.monthlyTarget === null
                      ? <td className={cn(CELL, 'bg-navy')} />
                      : <td className={CELL}>{row.monthlyTarget.value}</td>}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {leftOut && <p className="mb-2 text-xs text-muted">{leftOut}</p>}

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
        <table className="w-full border-collapse text-left text-base">
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

const CELL = 'border-b border-hairline px-3 py-2.5 text-navy';
