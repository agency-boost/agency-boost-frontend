import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PageHeader, SubtitleOnPhone } from '@/components/app-shell';
import { Field, TextInput } from './field';
import { REMOVED_ON_PHONE } from './phone';
import { PhoneTip } from './phone-tip';

/**
 * **The client's two phone verdicts on a grey sentence** (P18.95-T7 AC-1; ADR-0167 §7, OD-202): *Remove* — not drawn
 * below 768px, its words kept at 768px and wider — and *ⓘ* — the words in an ⓘ beside their subject below 768px,
 * the glyph not drawn at 768px and wider. jsdom applies no stylesheet, so what is pinned is the class each asks for.
 */
const hiddenClasses = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => /hidden/.test(c));

describe('REMOVED_ON_PHONE', () => {
  it('P18.95-T7 AC-1 is the one class that hides below 768px and nothing at 768px and wider', () => {
    expect(REMOVED_ON_PHONE).toBe('max-md:hidden');
  });
});

describe('PhoneTip', () => {
  const TEXT = 'APE per closing. Increase if one appointment often yields multiple policies.';

  it('P18.95-T7 AC-1 is an ⓘ drawn below 768px only, named and tipped with the sentence', async () => {
    render(<PhoneTip text={TEXT} />);
    const glyph = screen.getByRole('button', { name: TEXT });
    expect(glyph).toHaveTextContent('ⓘ');
    expect(hiddenClasses(glyph.parentElement!)).toEqual(['md:hidden']);
    // The words are drawn on a tap, a focus or a hover, as every ⓘ's are.
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    await userEvent.click(glyph);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(TEXT);
  });

  it('P18.95-T7 AC-1 takes a shorter name where the sentence is long, and where it sits in its line', () => {
    render(<PhoneTip text={TEXT} name="About the case size" className="mt-0.5" />);
    const glyph = screen.getByRole('button', { name: 'About the case size' });
    expect(glyph).toHaveAccessibleDescription(TEXT);
    expect(glyph.parentElement).toHaveClass('md:hidden', 'mt-0.5');
  });
});

describe('a field’s hint on a phone', () => {
  it('P18.95-T7 AC-1 is drawn at every size by default, and with hintOnPhone false not below 768px — still the description', () => {
    render(
      <>
        <Field label="Preferred name" htmlFor="a" hint="What colleagues call you day to day."><TextInput id="a" /></Field>
        <Field label="Pronoun" htmlFor="b" hint="Yours to set." hintOnPhone={false}><TextInput id="b" /></Field>
      </>,
    );
    expect(hiddenClasses(screen.getByText('What colleagues call you day to day.'))).toEqual([]);
    expect(hiddenClasses(screen.getByText('Yours to set.'))).toEqual(['max-md:hidden']);
    expect(screen.getByLabelText('Pronoun')).toHaveAccessibleDescription('Yours to set.');
  });
});

describe('a page’s sub-line on a phone', () => {
  it('P18.95-T7 AC-1 is drawn at every size by default', () => {
    render(<PageHeader title="Leads Management" subtitle="Track and follow up." />);
    expect(hiddenClasses(screen.getByText('Track and follow up.'))).toEqual([]);
  });

  it('P18.95-T7 AC-1 is not drawn below 768px when the page says so, by its own prop or through a shell', () => {
    render(
      <>
        <PageHeader title="Log Activity" subtitle="Enter today's activities in 1 minute." subtitleOnPhone={false} />
        <SubtitleOnPhone.Provider value={false}>
          <PageHeader title="Notifications" subtitle="What has happened that you should know about." />
        </SubtitleOnPhone.Provider>
      </>,
    );
    expect(hiddenClasses(screen.getByText("Enter today's activities in 1 minute."))).toEqual(['max-md:hidden']);
    expect(hiddenClasses(screen.getByText('What has happened that you should know about.'))).toEqual(['max-md:hidden']);
    // The title stays at every size.
    expect(hiddenClasses(screen.getByRole('heading', { name: 'Notifications' }))).toEqual([]);
  });

  it('P18.95-T7 AC-1 a page’s own prop wins over the context it sits in', () => {
    render(
      <SubtitleOnPhone.Provider value={false}>
        <PageHeader title="Your account" subtitle="rina@kpm0417.test" subtitleOnPhone />
      </SubtitleOnPhone.Provider>,
    );
    expect(hiddenClasses(screen.getByText('rina@kpm0417.test'))).toEqual([]);
  });
});
