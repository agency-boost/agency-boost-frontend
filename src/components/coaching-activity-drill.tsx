'use client';

import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import type { ActivitySection, SubPeriodTarget } from '@/lib/activity';

/*
 * **The Activity drill, in a module of its own** (P18.99-T16, the bundle): the session's tiles and the record's panel load
 * it with `next/dynamic` on the first *7 hari terakhir ›*, so neither carries it in its first load.
 */

/**
 * The drill, a dialog in the page — *{name} — Activity Dashboard* · *Last 7 days · category breakdown* — where the
 * prototype opened a browser pop-up (`:10923-10953`): the three targets and every section row.
 */
export function ActivityDrill({
  open, name, targets, sections, onClose,
}: {
  open: boolean;
  name: string;
  targets: readonly SubPeriodTarget[];
  sections: readonly ActivitySection[];
  onClose: () => void;
}) {
  const t = useMessages(coachingSessionMessages).activity;
  return (
      <Modal
        open={open}
        title={t.dialog({ name })}
        description={t.dialogLine}
        onClose={onClose}
        focusDialog
        className="max-w-[40rem]"
      >
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="relative w-full border-collapse text-left text-base">
            <caption className="sr-only">{t.caption({ name })}</caption>
            <thead>
              <tr className="bg-navy/[0.04] text-2xs uppercase text-muted">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.category}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.logged}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.target}</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row) => (
                <tr key={row.key} className="border-t border-hairline">
                  <th scope="row" className="px-4 py-2.5 font-normal text-navy">{t.targets[row.key]}</th>
                  <td className="px-4 py-2.5 font-bold text-navy">{row.logged}</td>
                  <td className="px-4 py-2.5 text-navy">{row.target ?? '–'}</td>
                </tr>
              ))}
              {sections.flatMap((section) => section.rows).map((row) => (
                <tr key={row.code} className="border-t border-hairline">
                  <th scope="row" className="px-4 py-2.5 font-normal text-navy">{row.label}</th>
                  <td className="px-4 py-2.5 font-bold text-navy">{row.count}</td>
                  <td className="px-4 py-2.5 text-muted">–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t.close}</Button>
        </div>
      </Modal>
  );
}
