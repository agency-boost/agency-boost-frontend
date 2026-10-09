import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import type { PitchSlot, PitchSummary } from '@/lib/recruitment-pitch';
import { PitchBanner } from './pitch-banner';
import { PitchCard, type PitchAudience } from './pitch-card';

const checklist = (ticked: string[] = []) =>
  ['career-path', 'income', 'support', 'commitment'].map((code) => ({ code, label: `Item ${code}`, ticked: ticked.includes(code) }));
const FILE = { name: 'deck.pdf', bytes: 1024 * 1024, uploadedOn: '2026-10-01' };
const slot = (over: Partial<PitchSlot> = {}): PitchSlot => ({
  slot: 'opportunity', title: 'Opportunity Overview', line: 'line', state: 'missing', file: null,
  checklist: checklist(), version: 0, ...over,
});

const badge = () => screen.getByRole('article').querySelector('[data-tone]') as HTMLElement;

/** The badge is the completion rule's state in words: the office reads all four, agents two (`:681-696`). */
describe('PitchCard’s badge', () => {
  it.each<[string, Partial<PitchSlot>, PitchAudience, string, string]>([
    ['missing', {}, 'office', 'Missing', 'alert'],
    ['missing', {}, 'agent', 'Missing', 'alert'],
    ['complete', { state: 'complete', file: FILE, checklist: checklist(['career-path', 'income', 'support', 'commitment']) }, 'office', 'Complete', 'success'],
    ['complete', { state: 'complete', file: FILE, checklist: checklist(['career-path', 'income', 'support', 'commitment']) }, 'agent', 'Uploaded', 'success'],
    ['partial', { state: 'partial', file: FILE, checklist: checklist(['income']) }, 'office', '1/4 confirmed', 'review'],
    ['partial', { state: 'partial', file: FILE, checklist: checklist(['income']) }, 'agent', 'Uploaded', 'success'],
    ['uploaded', { slot: 'faq', title: 'FAQ', state: 'uploaded', file: FILE, checklist: [] }, 'office', 'Uploaded', 'success'],
    ['uploaded', { slot: 'faq', title: 'FAQ', state: 'uploaded', file: FILE, checklist: [] }, 'agent', 'Uploaded', 'success'],
  ])('a %s slot reads, to the %s’s reader… %s', (_state, over, audience, words, tone) => {
    render(<PitchCard slot={slot(over)} audience={audience} />);
    expect(badge()).toHaveTextContent(words);
    expect(badge()).toHaveAttribute('data-tone', tone);
  });

  it('navy words on the amber tint for a partly confirmed slot, never amber small text (I-116)', () => {
    render(<PitchCard slot={slot({ state: 'partial', file: FILE, checklist: checklist(['income']) })} audience="office" />);
    expect(badge().className).toContain('text-navy');
  });
});

describe('PitchCard’s checklist', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is drawn for the office alone, and only for a slot that holds a file', () => {
    const { rerender } = render(<PitchCard slot={slot({ state: 'partial', file: FILE })} audience="agent" canWrite />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    rerender(<PitchCard slot={slot()} audience="office" canWrite />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    rerender(<PitchCard slot={slot({ state: 'partial', file: FILE })} audience="office" canWrite />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('labels each box with the server’s words, and keeps the box focusable while it writes', async () => {
    let answer: (v: unknown) => void = () => undefined;
    stubFetch({});
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { answer = resolve; })));
    const onChanged = vi.fn();
    render(<PitchCard slot={slot({ state: 'partial', file: FILE, version: 4 })} audience="office" canWrite onChanged={onChanged} />);

    const box = screen.getByRole('checkbox', { name: 'Item income' });
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box).toBeEnabled();
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute('aria-busy', 'true');
    // A second press while the first is on its way is ignored, not sent.
    await userEvent.click(box);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const next = slot({ state: 'partial', file: FILE, checklist: checklist(['income']), version: 4 });
    answer({ ok: true, status: 200, json: async () => next });
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(next));
  });

  it('never writes without canWrite: the boxes are disabled', () => {
    render(<PitchCard slot={slot({ state: 'partial', file: FILE })} audience="office" />);
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Replace/ })).not.toBeInTheDocument();
  });
});

describe('PitchBanner', () => {
  const summary = (over: Partial<PitchSummary>): PitchSummary => ({ done: 0, total: 4, missing: 4, unconfirmed: 0, ...over });

  it.each<[Partial<PitchSummary>, string]>([
    [{ done: 0, missing: 4 }, '4 not uploaded — not yet ready to rely on for candidates.'],
    [{ done: 3, missing: 0, unconfirmed: 1 }, '1 uploaded but not fully confirmed — not yet ready to rely on for candidates.'],
    [{ done: 1, missing: 2, unconfirmed: 1 }, '2 not uploaded, 1 uploaded but not fully confirmed — not yet ready to rely on for candidates.'],
    [{ done: 4, missing: 0 }, 'All 4 documents are uploaded and fully confirmed — ready to show or send to a candidate.'],
  ])('words %o as the prototype does (`:807-818`)', (over, line) => {
    render(<PitchBanner summary={summary(over)} />);
    expect(screen.getByText(line)).toBeInTheDocument();
    const s = summary(over);
    expect(screen.getByRole('img', { name: `${s.done} of 4 documents complete` })).toHaveTextContent(`${s.done}/4`);
  });

  it('hides the ring’s figure from assistive technology, which reads its name instead', () => {
    render(<PitchBanner summary={summary({ done: 2, missing: 2 })} />);
    const ring = screen.getByRole('img');
    expect(within(ring).getByText('2/4')).toHaveAttribute('aria-hidden', 'true');
  });
});
