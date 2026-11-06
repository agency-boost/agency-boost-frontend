import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth } from '@test/harness';
import { TrainingEditor, type TrainingTaxonomyPayload } from '@/components/template-editor';

const TRAINING: TrainingTaxonomyPayload = {
  categories: [{ code: 'SALES', label: 'Sales', description: null }],
  skills: [
    { code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' },
    { code: 'CLOSING', categoryCode: 'SALES', label: 'Closing' },
  ],
  modules: [
    { code: 'COLD_CALL', skillCode: 'PROSPECTING', title: 'Cold calls', publishState: 'published' },
    { code: 'ASK', skillCode: 'CLOSING', title: 'Asking for the decision', publishState: 'published' },
    { code: 'REFERRALS', skillCode: 'PROSPECTING', title: 'Referrals', publishState: 'published' },
    { code: 'FOLLOW_UP', skillCode: 'PROSPECTING', title: 'Follow-up', publishState: 'draft' },
  ],
};

function Editor({ sent }: { sent: TrainingTaxonomyPayload[] }) {
  const [payload, setPayload] = useState(TRAINING);
  return (
    <TrainingEditor payload={payload} section="modules" onChange={(next) => { sent.push(next); setPayload(next); }} />
  );
}

const titles = (payload: TrainingTaxonomyPayload, skill: string) =>
  payload.modules.filter((m) => m.skillCode === skill).map((m) => m.title);
const rowTitles = () => screen.getAllByRole('listitem').map((li) => within(li).getAllByText(/./)[1]?.textContent);

/**
 * **Modules in order, in the template's Training section** (the 11-03 handover's B1-9, *"There is no module reorder in
 * Training"*; P19.4-T4 AC-14's second half, built with P19.4-T5): a module moves by its handle — dragged, or ↑/↓ on the
 * focused handle — and on a phone by its ↑ and ↓, among its own skill's modules only, and the order is the payload's,
 * saved with the draft (an office's modules are numbered from it when it is provisioned).
 */
describe('B1-9 a template’s training modules put in order', () => {
  afterEach(() => atWidth(1280));

  it('P19.4-T4 AC-14 ↓ on a module’s handle moves it below the next module of its skill, saved as the draft’s order', async () => {
    const sent: TrainingTaxonomyPayload[] = [];
    render(<Editor sent={sent} />);
    const handle = screen.getByRole('button', { name: 'Reorder Cold calls. Press the up or down arrow to move it.' });
    handle.focus();
    await userEvent.keyboard('{ArrowDown}');
    // Past *Referrals*, its own skill's next — never past *Asking for the decision*, which is another skill's.
    expect(titles(sent.at(-1)!, 'PROSPECTING')).toEqual(['Referrals', 'Cold calls', 'Follow-up']);
    expect(titles(sent.at(-1)!, 'CLOSING')).toEqual(['Asking for the decision']);
    // The material and every other field travel with the module.
    expect(sent.at(-1)!.modules.find((m) => m.code === 'COLD_CALL')).toEqual(TRAINING.modules[0]);
  });

  it('P19.4-T4 AC-14 ↑ on the first of its skill does nothing; a skill’s list shows its own order', async () => {
    const sent: TrainingTaxonomyPayload[] = [];
    render(<Editor sent={sent} />);
    screen.getByRole('button', { name: 'Reorder Cold calls. Press the up or down arrow to move it.' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(sent).toEqual([]);
    await userEvent.selectOptions(screen.getByLabelText('Skill'), 'PROSPECTING');
    screen.getByRole('button', { name: 'Reorder Follow-up. Press the up or down arrow to move it.' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(titles(sent.at(-1)!, 'PROSPECTING')).toEqual(['Cold calls', 'Follow-up', 'Referrals']);
    expect(rowTitles()).toEqual(['Cold calls', 'Follow-up', 'Referrals']);
  });

  it('P19.4-T4 AC-14 on a phone, where a drag never starts: ↑ and ↓ beside each module', async () => {
    atWidth(375);
    const sent: TrainingTaxonomyPayload[] = [];
    render(<Editor sent={sent} />);
    expect(screen.getByRole('button', { name: 'Move Cold calls up' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Move Cold calls down' }));
    expect(titles(sent.at(-1)!, 'PROSPECTING')).toEqual(['Referrals', 'Cold calls', 'Follow-up']);
  });

  it('P19.4-T4 AC-14 at 1280px the handle alone, no arrows', () => {
    atWidth(1280);
    render(<Editor sent={[]} />);
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /^Move .* (up|down)$/ })).not.toBeInTheDocument();
  });

  it('draws nothing to drag in a template that is read only', () => {
    render(<TrainingEditor payload={TRAINING} section="modules" disabled onChange={vi.fn()} />);
    for (const handle of screen.getAllByRole('button', { name: /^Reorder / })) expect(handle).toBeDisabled();
  });
});
