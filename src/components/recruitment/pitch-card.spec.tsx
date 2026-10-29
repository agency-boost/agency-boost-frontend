import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  slot: 'opportunity', title: 'Opportunity Overview', line: 'line', required: true, state: 'missing', file: null,
  checklist: checklist(), version: 0, ...over,
});
/** An optional document — Company Profile, as the server answers it (ADR-0177 §2). */
const optional = (over: Partial<PitchSlot> = {}): PitchSlot =>
  slot({ slot: 'company', title: 'Company Profile', required: false, checklist: [], ...over });

/** The state's pill — never the *Optional* tag, which is a chip of its own. */
const badge = () => screen.getByRole('article').querySelector('[data-badge]') as HTMLElement | null;

/**
 * The badge is the completion rule's state in words (`:681-696`): a partial document reads *Uploaded · needs
 * confirmation* to everybody (ADR-0177 §1); the office reads *Complete* where agents read *Uploaded*.
 */
describe('PitchCard’s badge', () => {
  it.each<[string, Partial<PitchSlot>, PitchAudience, string, string]>([
    ['missing', {}, 'office', 'Missing', 'alert'],
    ['missing', {}, 'agent', 'Missing', 'alert'],
    ['complete', { state: 'complete', file: FILE, checklist: checklist(['career-path', 'income', 'support', 'commitment']) }, 'office', 'Complete', 'success'],
    ['complete', { state: 'complete', file: FILE, checklist: checklist(['career-path', 'income', 'support', 'commitment']) }, 'agent', 'Uploaded', 'success'],
    ['partial', { state: 'partial', file: FILE, checklist: checklist(['income']) }, 'office', 'Uploaded · needs confirmation', 'review'],
    ['partial', { state: 'partial', file: FILE, checklist: checklist(['income']) }, 'agent', 'Uploaded · needs confirmation', 'review'],
    ['partial, nothing ticked', { state: 'partial', file: FILE, checklist: checklist() }, 'office', 'Uploaded · needs confirmation', 'review'],
    ['uploaded', { slot: 'faq', title: 'FAQ', state: 'uploaded', file: FILE, checklist: [] }, 'office', 'Uploaded', 'success'],
    ['uploaded', { slot: 'faq', title: 'FAQ', state: 'uploaded', file: FILE, checklist: [] }, 'agent', 'Uploaded', 'success'],
  ])('P18.97-T5 AC-1 a %s slot reads, to the %s’s reader… %s', (_state, over, audience, words, tone) => {
    render(<PitchCard slot={slot(over)} audience={audience} />);
    expect(badge()).toHaveTextContent(words);
    expect(badge()).toHaveAttribute('data-tone', tone);
    // Never the prototype's "{n}/{m} confirmed": the ring is the only x/y on the page.
    expect(screen.getByRole('article').textContent).not.toMatch(/\d\/\d confirmed/);
  });

  it('P18.97-T5 AC-1 the amber badge is the amber tint and the amber-dark dot, with navy words — never amber small text (I-116, I-519)', () => {
    render(<PitchCard slot={slot({ state: 'partial', file: FILE, checklist: checklist(['income']) })} audience="agent" />);
    expect(badge()!.className).toContain('bg-amber/[0.14]');
    expect(badge()!.className).toContain('text-navy');
    expect(badge()!.querySelector('[aria-hidden="true"]')!.className).toContain('bg-amber-dark');
  });

  it('P18.97-T5 AC-1 the office still sees which items are ticked, under the amber badge', () => {
    render(<PitchCard slot={slot({ state: 'partial', file: FILE, checklist: checklist(['career-path', 'support']) })} audience="office" canWrite />);
    expect(badge()).toHaveTextContent('Uploaded · needs confirmation');
    expect(screen.getAllByRole('checkbox').map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, true, false]);
  });
});

/**
 * **The amber badge's contrast, measured from the tokens** (P18.97-T5 AC-1; parity I-519): jsdom applies no
 * stylesheet, so this computes what the browser paints — the 14% amber tint composited over the card — and holds
 * each pair to WCAG 2.1 AA's 4.5:1 for small text. Why the words are navy: neither text amber clears it there.
 */
describe('P18.97-T5 AC-1 — the amber badge’s contrast (WCAG 2.1 AA 1.4.3)', () => {
  const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
  const token = (name: string) => {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(globals);
    if (!m) throw new Error(`no --color-${name} in globals.css`);
    return m[1];
  };
  const channel = (hex: string, i: number) => parseInt(hex.replace('#', '').slice(i, i + 2), 16);
  const luminance = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = channel(hex, i) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  /** A wash of `fg` at `alpha` over the opaque `bg`: the colour the words sit on. */
  const over = (fg: string, alpha: number, bg: string) =>
    `#${[0, 2, 4].map((i) => Math.round(channel(fg, i) * alpha + channel(bg, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
  const TINT = over(token('amber'), 0.14, token('card'));

  it('P18.97-T5 AC-1 navy words on the 14% amber tint over the card clear 4.5:1 — 12.7:1', () => {
    expect(ratio(token('navy'), TINT)).toBeGreaterThanOrEqual(4.5);
    expect(Math.round(ratio(token('navy'), TINT) * 10) / 10).toBe(12.7);
  });

  it('P18.97-T5 AC-1 neither text amber would: amber-dark and amber-ink both miss 4.5:1 on the tint', () => {
    expect(ratio(token('amber-dark'), TINT)).toBeLessThan(4.5);
    expect(ratio(token('amber-ink'), TINT)).toBeLessThan(4.5);
  });

  it('P18.97-T5 AC-2 the Optional tag, navy on the 6% navy chip over the card, clears 4.5:1', () => {
    expect(ratio(token('navy'), over(token('navy'), 0.06, token('card')))).toBeGreaterThanOrEqual(4.5);
  });
});

/** The two optional documents' cards (UI-042; ADR-0177 §2; P18.97-T5 AC-2). */
describe('PitchCard, an optional document', () => {
  it.each<PitchAudience>(['office', 'agent'])('P18.97-T5 AC-2 empty, to the %s’s reader: tagged Optional, “Not uploaded yet”, no badge — never Missing', (audience) => {
    render(<PitchCard slot={optional()} audience={audience} />);
    const card = screen.getByRole('article', { name: 'Company Profile' });
    expect(within(card).getByText('Optional')).toBeInTheDocument();
    expect(within(card).getByText('Not uploaded yet')).toBeInTheDocument();
    expect(badge()).toBeNull();
    expect(within(card).queryByText('Missing')).not.toBeInTheDocument();
    // Dashed, as an empty slot is — but not the missing card's red edge.
    expect(card.className).toContain('border-dashed');
    expect(card.className).toContain('border-hairline');
    expect(card.className).not.toContain('border-alert');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('P18.97-T5 AC-2 the tag is the quiet chip beside the title, and the card is still named by its title alone', () => {
    render(<PitchCard slot={optional({ state: 'uploaded', file: FILE, version: 1 })} audience="agent" />);
    const card = screen.getByRole('article', { name: 'Company Profile' });
    const tag = within(card).getByText('Optional');
    expect(tag).toHaveAttribute('data-tone', 'navy');
    expect(tag.parentElement).toContainElement(within(card).getByRole('heading', { level: 2, name: 'Company Profile' }));
    expect(badge()).toHaveTextContent('Uploaded');
    expect(badge()).toHaveAttribute('data-tone', 'success');
  });

  it('P18.97-T5 AC-2 uploaded, it opens as the four do, for every reader — and the office replaces it', () => {
    const { rerender } = render(<PitchCard slot={optional({ state: 'uploaded', file: FILE, version: 1 })} audience="agent" />);
    expect(screen.getByRole('button', { name: 'View PDF, Company Profile — opens in a new tab' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Replace/ })).not.toBeInTheDocument();
    rerender(<PitchCard slot={optional({ state: 'uploaded', file: FILE, version: 1 })} audience="office" canWrite />);
    expect(screen.getByRole('button', { name: 'Replace, Company Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('P18.97-T5 AC-2 empty, the office uploads it as it would any other', () => {
    render(<PitchCard slot={optional({ slot: 'agency', title: 'Agency Profile' })} audience="office" canWrite />);
    expect(screen.getByRole('button', { name: 'Upload PDF, Agency Profile' })).toBeInTheDocument();
    expect(document.querySelector('input[type=file]')).not.toBeNull();
  });

  it('a required document carries no Optional tag', () => {
    render(<PitchCard slot={slot()} audience="agent" />);
    expect(screen.queryByText('Optional')).not.toBeInTheDocument();
  });
});

describe('PitchCard, a file’s size (P18.97-T5 AC-4)', () => {
  it('P18.97-T5 AC-4 a file under 1 KB reads “< 1 KB”, never 1 KB (UI-029; I-521)', () => {
    render(<PitchCard slot={slot({ slot: 'faq', title: 'FAQ', state: 'uploaded', checklist: [], version: 1, file: { name: 'faq.pdf', bytes: 642, uploadedOn: '2026-10-01' } })} audience="agent" />);
    // The size and the day in the spec's language since P18.98-T4 wired them (the harness's English is a chosen English).
    expect(screen.getByText('< 1 KB · updated 1 Oct 2026')).toBeInTheDocument();
  });

  it('P18.97-T5 AC-4 a kilobyte and more reads in KB, a megabyte and more in MB', () => {
    const { rerender } = render(<PitchCard slot={slot({ slot: 'faq', title: 'FAQ', state: 'uploaded', checklist: [], version: 1, file: { name: 'faq.pdf', bytes: 1024, uploadedOn: '2026-10-01' } })} audience="agent" />);
    expect(screen.getByText('1 KB · updated 1 Oct 2026')).toBeInTheDocument();
    rerender(<PitchCard slot={slot({ slot: 'faq', title: 'FAQ', state: 'uploaded', checklist: [], version: 1, file: FILE })} audience="agent" />);
    expect(screen.getByText('1.0 MB · updated 1 Oct 2026')).toBeInTheDocument();
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
    [{ done: 0, missing: 4 }, '4 missing.'],
    [{ done: 3, missing: 0, unconfirmed: 1 }, '1 needs checking.'],
    [{ done: 1, missing: 2, unconfirmed: 1 }, '2 missing, 1 needs checking.'],
    [{ done: 4, missing: 0 }, 'All 4 documents are uploaded and fully confirmed — ready to show or send to a candidate.'],
  ])('P18.95-T7 AC-1 words %o in the client’s line where it is incomplete, the prototype’s where it is complete (grey text row 11)', (over, line) => {
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
