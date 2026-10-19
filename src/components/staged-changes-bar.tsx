'use client';

import { Button, Card } from '@/components/ui/field';

/**
 * What is held but not sent (P4-T19).
 *
 * One component because the settings screens must answer *"what does Save mean here?"*
 * the same way. Two implementations would be two answers, and the one that mattered would
 * be whichever screen the Owner happened to learn first.
 *
 * **Three states, named in order**, because they are three different places a change can
 * be and readers conflate the last two: held in this browser, saved to the office, and
 * published to agents. Saving is not publishing, and the sentence says so rather than
 * leaving the publish bar below to imply it.
 */
export function StagedChangesBar({
  count,
  busy,
  onSave,
  onDiscard,
}: {
  count: number;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (count === 0) return null;

  return (
    <Card className="mb-4 border-amber">
      <p className="text-md text-navy">
        <strong>{count} {count === 1 ? 'change' : 'changes'} not saved yet.</strong>{' '}
        <span className="text-muted">
          Nothing has reached your office — and publishing to agents is a separate step
          after that.
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={onSave}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onDiscard}>
          Discard them
        </Button>
      </div>
    </Card>
  );
}
