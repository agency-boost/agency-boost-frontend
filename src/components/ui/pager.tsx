'use client';

import { Button } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { uiMessages } from '@/i18n/messages/ui';

/**
 * *Previous*, *Page {n} of {m}*, *Next* — for a list the server pages by number (P12.1-T4 AC-4).
 *
 * The members directory pages by cursor and has no page count to say, so it keeps its own pair of
 * buttons; this is for a read that answers `page` and `total`, where *of {m}* is known. The same
 * `secondary` buttons and muted line that pair has, so the two read as one pattern.
 *
 * **Nothing when one page holds everything**: two dead buttons and *Page 1 of 1* say nothing a reader
 * can act on. *Previous* is disabled on the first page and *Next* on the last. The line is a polite live
 * region, so a reader who pressed *Next* hears which page they are on without leaving the button.
 */
export function Pager({
  page,
  pages,
  label,
  onPage,
}: {
  page: number;
  pages: number;
  /** The landmark's name: which list these are the pages of. */
  label: string;
  onPage: (page: number) => void;
}) {
  const t = useMessages(uiMessages).pager;
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t.previous}
      </Button>
      <span className="text-sm text-muted" aria-live="polite">
        {t.page({ page: String(page), pages: String(pages) })}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t.next}
      </Button>
    </nav>
  );
}
