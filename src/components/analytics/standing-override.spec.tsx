import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import ts from 'typescript';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { parse, renderable, SRC } from '@test/copy-scan';
import { stubFetch } from '@test/harness';
import { OVERRIDE_COPY, OVERRIDE_REASON_MAX, type StandingOverride } from '@/lib/standing-override';
import { AchievedCell, type AchievedCellData } from './standing-override';

const CAMPAIGN = { code: 'PERSISTENCY_PUSH', title: 'Persistency Push' };
const PATH = '/kpm/settings/campaigns/PERSISTENCY_PUSH/standings/mem-budi/override';
const BUTTON = 'Override Budi Santoso’s result for Persistency Push';

/** Set by the Owner late on October 9 UTC — already October 10 in the office's calendar (Asia/Jakarta). */
const OVERRIDE: StandingOverride = {
  status: 'qualified',
  reason: 'Two policies were back-dated by the company after the lock.',
  by: { membershipId: 'mem-owner', name: 'Wilson Tanoto' },
  at: '2026-10-09T18:30:00.000Z',
};
const MARKER = `Overridden by Wilson Tanoto on Oct 10, 2026: ${OVERRIDE.reason}`;

function renderCell(cell: AchievedCellData, { canOverride = true, onChanged = vi.fn() } = {}) {
  render(
    <AchievedCell
      row={{ membershipId: 'mem-budi', name: 'Budi Santoso', cell }}
      campaign={CAMPAIGN}
      canOverride={canOverride}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

const refusal = (status: number, code: string, message: string, details?: Record<string, unknown>) => ({
  status,
  body: { error: { code, message, details, requestId: 'req-1' } },
});

async function openDialog(name: string | RegExp = new RegExp(BUTTON)) {
  await userEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog', { name: BUTTON });
}

/**
 * The campaigns' *Achieved* cell and the override's dialog (P18.6-T2 AC-8; ADR-0144 §4; D-override): the pill
 * as the tree draws it, the button a stored final standing's pill becomes, the dialog it opens, the marker an
 * overridden result carries, and the two writes with their bodies and refusals.
 */
describe('AchievedCell (P18.6-T2 AC-8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the pill', () => {
    it.each([
      ['qualified', 'Achieved'],
      ['not_met', 'Not achieved'],
      ['not_joined', 'Not achieved'],
      ['unknown', '—'],
      ['in_progress', '—'],
      [null, '—'],
    ])('P18.6-T2 AC-8 draws %s as the registry’s %s, and no control without the override', (second, label) => {
      renderCell({ second, overridable: true }, { canOverride: false });
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('P18.6-T2 AC-8 no control for a member with no stored standing (a non-chaser), whoever reads', () => {
      renderCell({ second: 'not_joined', overridable: false });
      expect(screen.getByText('Not achieved')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('P18.6-T2 AC-8 no control in a read-only session: the read answers canOverride false', () => {
      renderCell({ second: 'qualified', overridable: true }, { canOverride: false });
      expect(screen.queryByRole('button', { name: new RegExp(BUTTON) })).not.toBeInTheDocument();
    });
  });

  describe('the button', () => {
    it('P18.6-T2 AC-8 is named by the words on it, then what it opens (WCAG 2.5.3)', () => {
      renderCell({ second: 'not_met', overridable: true });
      const button = screen.getByRole('button', { name: `Not achieved — ${BUTTON}` });
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('P18.6-T2 AC-8 a final unknown draws — and is overridable, named by what it opens alone', () => {
      renderCell({ second: 'unknown', overridable: true });
      expect(screen.getByRole('button', { name: BUTTON })).toHaveTextContent('—');
    });
  });

  describe('the dialog', () => {
    it('P18.6-T2 AC-8 shows the result now, the choice without the result it already reads, a required reason, Save and Close', async () => {
      renderCell({ second: 'qualified', overridable: true });
      const dialog = await openDialog();

      expect(within(dialog).getByText('Result now')).toHaveTextContent('Result now');
      expect(within(dialog).getByText('Achieved', { selector: 'span' })).toBeInTheDocument();
      const group = within(dialog).getByRole('group', { name: 'New result' });
      expect(within(group).getByRole('radio', { name: 'Achieved' })).toBeDisabled();
      expect(within(group).getByRole('radio', { name: 'Not achieved' })).toBeChecked();
      const reason = within(dialog).getByRole('textbox', { name: 'Reason' });
      expect(reason).toBeRequired();
      expect(reason).toHaveAttribute('maxLength', String(OVERRIDE_REASON_MAX));
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled();
      // Not overridden: nothing to clear.
      expect(within(dialog).queryByRole('button', { name: 'Clear override' })).not.toBeInTheDocument();
      // The focus is in the dialog, on the one result that can be asked for.
      expect(within(group).getByRole('radio', { name: 'Not achieved' })).toHaveFocus();

      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);
    });

    it('P18.6-T2 AC-8 the radios are a selection, so navy (ADR-0137 §2), never the browser’s blue', async () => {
      renderCell({ second: 'unknown', overridable: true });
      const dialog = await openDialog(BUTTON);
      for (const radio of within(dialog).getAllByRole('radio')) expect(radio).toHaveClass('accent-navy');
    });

    it('P18.6-T2 AC-8 Close and Save are one group at the end, at every width; Clear override leads outside it', async () => {
      renderCell({ second: 'qualified', overridable: true, override: OVERRIDE });
      const dialog = await openDialog();
      const close = within(dialog).getByRole('button', { name: 'Close' });
      const save = within(dialog).getByRole('button', { name: 'Save' });
      const clear = within(dialog).getByRole('button', { name: 'Clear override' });
      // One group: it wraps as a whole, so Save never lands on a row of its own under Close.
      expect(close.parentElement).toBe(save.parentElement);
      expect(close.parentElement).toHaveClass('ml-auto', 'flex');
      expect(close.parentElement).not.toHaveClass('flex-wrap');
      expect(close.parentElement?.contains(clear)).toBe(false);
      // Clear override comes first, on the left, and the footer may wrap the pair beneath it.
      const footer = close.parentElement!.parentElement!;
      expect(footer).toHaveClass('flex-wrap');
      expect(footer.firstElementChild).toBe(clear);
    });

    it('P18.6-T2 AC-8 a final unknown offers both results and asks for one', async () => {
      renderCell({ second: 'unknown', overridable: true });
      const dialog = await openDialog(BUTTON);
      const achieved = within(dialog).getByRole('radio', { name: 'Achieved' });
      const notAchieved = within(dialog).getByRole('radio', { name: 'Not achieved' });
      expect(achieved).toBeEnabled();
      expect(notAchieved).toBeEnabled();
      expect(achieved).not.toBeChecked();
      expect(notAchieved).not.toBeChecked();

      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Checked against the company report.');
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
      await userEvent.click(achieved);
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('P18.6-T2 AC-8 the choice is re-checked when the result changes underneath: Save never sends the result it reads', async () => {
      const row = (cell: AchievedCellData) => ({ membershipId: 'mem-budi', name: 'Budi Santoso', cell });
      const { rerender } = render(
        <AchievedCell row={row({ second: 'unknown', overridable: true })} campaign={CAMPAIGN} canOverride onChanged={vi.fn()} />,
      );
      const dialog = await openDialog(BUTTON);
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Achieved' }));
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Typed reason');
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();

      // Read again: it now reads *Achieved* — the result chosen — so the other one is the choice.
      rerender(<AchievedCell row={row({ second: 'qualified', overridable: true })} campaign={CAMPAIGN} canOverride onChanged={vi.fn()} />);
      expect(within(dialog).getByRole('radio', { name: 'Achieved' })).toBeDisabled();
      expect(within(dialog).getByRole('radio', { name: 'Not achieved' })).toBeChecked();
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();

      // Read again: cleared to *—*, both offered — the choice made stays while it is still offered.
      rerender(<AchievedCell row={row({ second: 'unknown', overridable: true })} campaign={CAMPAIGN} canOverride onChanged={vi.fn()} />);
      expect(within(dialog).getByRole('radio', { name: 'Not achieved' })).toBeChecked();
      expect(within(dialog).getByRole('radio', { name: 'Achieved' })).toBeEnabled();
    });

    it('P18.6-T2 AC-8 Escape puts it away and the focus goes back to the cell', async () => {
      renderCell({ second: 'qualified', overridable: true });
      await openDialog();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(BUTTON) })).toHaveFocus();
    });

    it('P18.6-T2 AC-8 Close puts it away, writing nothing', async () => {
      const { calls } = stubFetch({});
      const { onChanged } = renderCell({ second: 'qualified', overridable: true });
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Not now');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(BUTTON) })).toHaveFocus();
      expect(calls).toHaveLength(0);
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('P18.6-T2 AC-8 the reason is required: blank or only spaces, nothing can be sent', async () => {
      const { calls } = stubFetch({});
      renderCell({ second: 'not_met', overridable: true });
      const dialog = await openDialog();
      const save = within(dialog).getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), '   ');
      expect(save).toBeDisabled();
      // Enter in the radio group submits the form; a blank reason still sends nothing.
      within(dialog).getByRole('radio', { name: 'Achieved' }).focus();
      await userEvent.keyboard('{Enter}');
      expect(calls).toHaveLength(0);
    });
  });

  describe('the writes', () => {
    it('P18.6-T2 AC-5, AC-8 Save sends PUT with the result and the reason trimmed, closes, toasts and asks for the tree again', async () => {
      const { calls } = stubFetch({
        [`PUT ${PATH}`]: { body: { campaignCode: 'PERSISTENCY_PUSH', membershipId: 'mem-budi', status: 'not_met', override: { ...OVERRIDE, status: 'not_met' } } },
      });
      const { onChanged } = renderCell({ second: 'qualified', overridable: true });
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), '  A policy lapsed before the lock.  ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain(`/api/v1${PATH}`);
      expect(calls[0].init.method).toBe('PUT');
      expect(JSON.parse(String(calls[0].init.body))).toEqual({ status: 'not_met', reason: 'A policy lapsed before the lock.' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(BUTTON) })).toHaveFocus();
      expect(await screen.findByRole('status')).toHaveTextContent('Result overridden');
    });

    it('P18.6-T2 AC-5, AC-8 Clear override sends DELETE with the reason in its body, and needs one too', async () => {
      const { calls } = stubFetch({
        [`DELETE ${PATH}`]: { body: { campaignCode: 'PERSISTENCY_PUSH', membershipId: 'mem-budi', status: 'not_met', override: null } },
      });
      const { onChanged } = renderCell({ second: 'qualified', overridable: true, override: OVERRIDE });
      const dialog = await openDialog();
      const clear = within(dialog).getByRole('button', { name: 'Clear override' });
      expect(clear).toBeDisabled();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'The company withdrew the correction.');
      await userEvent.click(clear);

      await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
      expect(calls).toHaveLength(1);
      expect(calls[0].init.method).toBe('DELETE');
      expect(calls[0].url).toContain(PATH);
      expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: 'The company withdrew the correction.' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('status')).toHaveTextContent('Override cleared');
    });

    it.each([
      [409, 'CAMPAIGN_STANDING_NOT_FINAL', 'This campaign’s result is not final yet.', false, { code: 'PERSISTENCY_PUSH' }],
      // A reason refused: nothing moved, so nothing is read again.
      [400, 'VALIDATION_FAILED', 'reason must be 500 characters or fewer.', false, { violations: ['reason must be 500 characters or fewer.'] }],
      // *Already reads*: the dialog never offers the current result, so this only means somebody else set it meanwhile.
      [400, 'VALIDATION_FAILED', 'The result already reads not_met.', true, { violations: ['status already reads not_met.'], status: 'not_met' }],
      // Nobody overrides their own result. The tree draws the reader's own row without the control; if it arrives anyway,
      // it is shown like any other refusal, and nothing is read again.
      [400, 'CAMPAIGN_OVERRIDE_SELF', 'You can’t override your own result.', false, { membershipId: 'mem-budi' }],
      [404, 'NOT_FOUND', 'Not found.', true, undefined],
      [409, 'VERSION_CONFLICT', 'Somebody changed this result a moment ago.', true, undefined],
    ] as const)('P18.6-T2 AC-8 a %i %s stays in the dialog with what was typed (“%s”; the tree read again behind it: %s)', async (status, code, message, reread, details) => {
      stubFetch({ [`PUT ${PATH}`]: refusal(status, code, message, details) });
      const { onChanged } = renderCell({ second: 'qualified', overridable: true });
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Typed reason');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).toHaveTextContent(code);
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).getByRole('textbox', { name: 'Reason' })).toHaveValue('Typed reason');
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
      expect(onChanged).toHaveBeenCalledTimes(reread ? 1 : 0);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('P18.6-T2 AC-8 already reads: the tree is read again, the dialog stays open, and its choice follows the result it now reads', async () => {
      stubFetch({
        [`PUT ${PATH}`]: refusal(400, 'VALIDATION_FAILED', 'The result already reads not_met.', { violations: ['status already reads not_met.'], status: 'not_met' }),
      });
      // The screen behind the dialog: a re-read answers the result somebody else set meanwhile.
      function Screen() {
        const [cell, setCell] = useState<AchievedCellData>({ second: 'qualified', overridable: true });
        return (
          <AchievedCell
            row={{ membershipId: 'mem-budi', name: 'Budi Santoso', cell }}
            campaign={CAMPAIGN}
            canOverride
            onChanged={() => setCell({ second: 'not_met', overridable: true, override: { ...OVERRIDE, status: 'not_met' } })}
          />
        );
      }
      render(<Screen />);
      const dialog = await openDialog();
      expect(within(dialog).getByRole('radio', { name: 'Not achieved' })).toBeChecked();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Typed reason');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('The result already reads not_met.');
      expect(screen.getByRole('dialog')).toBe(dialog);
      // The result now, and the choice: *Not achieved* is what it reads, so it is no longer offered.
      expect(within(dialog).getByText('Not achieved', { selector: 'span' })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: 'Not achieved' })).toBeDisabled();
      expect(within(dialog).getByRole('radio', { name: 'Achieved' })).toBeChecked();
      expect(within(dialog).getByRole('button', { name: 'Clear override' })).toBeInTheDocument();
      expect(within(dialog).getByRole('textbox', { name: 'Reason' })).toHaveValue('Typed reason');
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('P18.6-T2 AC-8 a clear refused (404: nothing to clear any more) is shown in the dialog, the tree read again', async () => {
      stubFetch({ [`DELETE ${PATH}`]: refusal(404, 'NOT_FOUND', 'Nothing to clear.') });
      const { onChanged } = renderCell({ second: 'qualified', overridable: true, override: OVERRIDE });
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Typed reason');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear override' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nothing to clear.');
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('P18.6-T2 AC-8 a request that never arrived says so, through toDisplayError', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
      renderCell({ second: 'qualified', overridable: true });
      const dialog = await openDialog();
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'Typed reason');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not reach the server');
    });
  });

  describe('the overridden result’s marker', () => {
    it('P18.6-T2 AC-8 an icon beside the pill names who, on the office’s day, and why — name and tooltip', async () => {
      renderCell({ second: 'qualified', overridable: true, override: OVERRIDE });
      const marker = screen.getByRole('button', { name: MARKER });
      const tip = screen.getByText(MARKER, { selector: '[role="tooltip"]' });
      expect(tip).not.toBeVisible();
      act(() => marker.focus());
      expect(tip).toBeVisible();
    });

    it('P18.6-T2 AC-8 shows to a reader who cannot override too, with no control beside it', () => {
      renderCell({ second: 'qualified', overridable: true, override: OVERRIDE }, { canOverride: false });
      expect(screen.getByRole('button', { name: MARKER })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: new RegExp(BUTTON) })).not.toBeInTheDocument();
    });

    it('P18.6-T2 AC-8 the dialog of an overridden result says who set it, and offers Clear override', async () => {
      renderCell({ second: 'qualified', overridable: true, override: OVERRIDE });
      const dialog = await openDialog();
      expect(within(dialog).getByText(MARKER)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Clear override' })).toBeInTheDocument();
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);
    });

    it('P18.6-T2 AC-8 an authored reason is drawn as text, never as markup', () => {
      const reason = '<b>bold</b> <img src=x onerror=alert(1)>';
      renderCell({ second: 'qualified', overridable: true, override: { ...OVERRIDE, reason } });
      expect(screen.getByRole('button', { name: `Overridden by Wilson Tanoto on Oct 10, 2026: ${reason}` })).toBeInTheDocument();
      expect(document.querySelector('b')).toBeNull();
      expect(document.querySelector('img')).toBeNull();
    });

    it('P18.6-T2 AC-8 no marker on a result nobody overrode', () => {
      renderCell({ second: 'qualified', overridable: true, override: null });
      expect(screen.queryByRole('button', { name: /^Overridden by/ })).not.toBeInTheDocument();
    });
  });
});

/**
 * The override's words are ours — the prototype draws no override (contradiction 11) — so they answer to the build
 * contract's *Module strings*: none of OD-39's six words (*office*, *KPM*, *reports to*, *tagged to*, *untagged*,
 * *unassigned*) and no phase. Read off the syntax tree, so a comment never counts. Permission codes are the
 * whole tree's scan's (`app/no-permission-code-in-copy.spec.ts`).
 */
describe('the override’s own copy (P18.6-T2)', () => {
  const FORBIDDEN = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned|\bphase\s*(\d|\{)/i;
  const FILES = ['components/analytics/standing-override.tsx', 'lib/standing-override.ts'];

  const strings = (file: string): string[] => {
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) return;
      const text = renderable(node);
      if (text !== null && /\s/.test(text.trim())) found.push(text.replace(/\s+/g, ' ').trim());
      ts.forEachChild(node, visit);
    };
    visit(parse(file, readFileSync(join(SRC, file), 'utf8')));
    return found;
  };

  it.each(FILES)('%s writes none of OD-39’s six words and no phase', (file) => {
    expect(strings(file).filter((text) => FORBIDDEN.test(text))).toEqual([]);
  });

  it('every sentence the cell and the dialog say, as rendered, is clear of them too', () => {
    const said = [
      ...Object.values(OVERRIDE_COPY).flatMap((v) => (typeof v === 'string' ? [v] : [])),
      OVERRIDE_COPY.overrideFor('Budi Santoso', 'Persistency Push'),
      OVERRIDE_COPY.overriddenBy('Wilson Tanoto', 'Oct 10, 2026', 'checked'),
    ];
    expect(said.filter((text) => FORBIDDEN.test(text))).toEqual([]);
  });
});
