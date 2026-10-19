import { describe, expect, it } from 'vitest';
import { leadActionsStale } from './coaching-session';

const actions = [
  { leadId: 'l-desi', leadName: 'Desi Pratama', dueDate: '2026-10-05', text: 'Confirm submission paperwork' },
  { leadId: 'l-hana', leadName: 'Hana Permata', dueDate: '2026-10-07', text: 'Follow up with Hana Permata' },
];
const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l-desi', name: 'Desi Pratama', nextActionDate: '2026-10-05', nextActionNote: 'Confirm submission paperwork', ...over,
});

/**
 * *From leads (automatic)* is derived on every read of an open session (`functional/coaching.md`, *The
 * draft*), and every read is audited: the workspace reads it again only after a lead write that leaves
 * it saying something the lead no longer does (P11-T8 AC-9).
 */
describe('leadActionsStale (P11-T8 AC-9)', () => {
  it('is fresh while the lead says what the list says', () => {
    expect(leadActionsStale(actions, lead())).toBe(false);
    // A lead with no note reads *Follow up with {name}*, which the lead does not hold: still fresh.
    expect(leadActionsStale(actions, lead({ id: 'l-hana', name: 'Hana Permata', nextActionDate: '2026-10-07', nextActionNote: null }))).toBe(false);
    // A lead with no date, and none on the list, is not on it.
    expect(leadActionsStale(actions, lead({ id: 'l-budi', name: 'Budi Santoso', nextActionDate: null }))).toBe(false);
  });

  it('is stale once a date moves, appears or goes, or the note or the name changes', () => {
    expect(leadActionsStale(actions, lead({ nextActionDate: '2026-10-09' }))).toBe(true);
    expect(leadActionsStale(actions, lead({ nextActionDate: null }))).toBe(true);
    expect(leadActionsStale(actions, lead({ id: 'l-budi', name: 'Budi Santoso', nextActionDate: '2026-10-03' }))).toBe(true);
    expect(leadActionsStale(actions, lead({ nextActionNote: 'Call at nine' }))).toBe(true);
    expect(leadActionsStale(actions, lead({ name: 'Desi P.' }))).toBe(true);
  });
});
