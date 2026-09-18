import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusPill, statusFor, STATUS_LABEL } from './status-pill';
import { Stepper } from './stepper';
import { ProgressBar } from './progress-bar';
import { EmptyState } from './empty-state';
import { RoleBadge, SEEDED_LADDER } from './role-badge';
import { Button, ColorInput, Field, TextInput } from './field';

describe('StatusPill', () => {
  it('renders three distinct states, each with its own words', () => {
    render(
      <>
        <StatusPill status="success" />
        <StatusPill status="alert" />
        <StatusPill status="neutral" />
      </>,
    );
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText('Below benchmark')).toBeInTheDocument();
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(new Set(Object.values(STATUS_LABEL)).size).toBe(3);
  });

  it('never renders colour alone — the label is always present', () => {
    const { container } = render(<StatusPill status="alert" />);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  describe('statusFor', () => {
    it('treats a null value as not-enough-data, never as failure', () => {
      expect(statusFor(null, 0.15)).toBe('neutral');
      expect(statusFor(undefined, 0.15)).toBe('neutral');
      expect(statusFor(NaN, 0.15)).toBe('neutral');
    });
    it('counts a value exactly at benchmark as on track', () => {
      expect(statusFor(0.15, 0.15)).toBe('success');
    });
    it('flags a value below benchmark', () => {
      expect(statusFor(0.14, 0.15)).toBe('alert');
    });
    it('distinguishes zero from no data', () => {
      expect(statusFor(0, 0.15)).toBe('alert');
      expect(statusFor(null, 0.15)).toBe('neutral');
    });
  });
});

describe('Stepper', () => {
  it('labels the control by the activity name, not its number', () => {
    render(<Stepper value={0} onChange={() => {}} label="Submission polis" />);
    expect(screen.getByLabelText('Count for Submission polis')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Submission polis')).toBeInTheDocument();
  });

  it('increments and decrements', async () => {
    const onChange = vi.fn();
    render(<Stepper value={3} onChange={onChange} label="Leads" />);
    await userEvent.click(screen.getByLabelText('Increase Leads'));
    expect(onChange).toHaveBeenCalledWith(4);
    await userEvent.click(screen.getByLabelText('Decrease Leads'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('clamps at both bounds by disabling, so the value cannot leave 0..999', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper value={0} onChange={onChange} label="Leads" />);
    expect(screen.getByLabelText('Decrease Leads')).toBeDisabled();

    rerender(<Stepper value={999} onChange={onChange} label="Leads" />);
    expect(screen.getByLabelText('Increase Leads')).toBeDisabled();
  });

  it('coerces non-numeric typing to 0 rather than producing NaN', async () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} label="Leads" />);
    const input = screen.getByLabelText('Count for Leads');
    await userEvent.clear(input);
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onChange).not.toHaveBeenCalledWith(NaN);
  });

  it('has touch targets large enough for a phone', () => {
    render(<Stepper value={1} onChange={() => {}} label="Leads" />);
    expect(screen.getByLabelText('Increase Leads').className).toContain('h-11');
  });
});

describe('ProgressBar', () => {
  it('caps the bar at 100% while the label may exceed it', () => {
    render(<ProgressBar value={200} target={100} />);
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('renders no-target rather than NaN% when the target is zero', () => {
    render(<ProgressBar value={5} target={0} />);
    expect(screen.getByText('No target set')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a negative width for a negative value', () => {
    render(<ProgressBar value={-10} target={100} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('can hide its label', () => {
    render(<ProgressBar value={50} target={100} showLabel={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('distinguishes empty from filtered-empty', () => {
    const { container: a } = render(<EmptyState title="No leads yet — add your first one above." />);
    expect(a.querySelector('[data-variant="empty"]')).toBeTruthy();

    const { container: b } = render(<EmptyState title="No leads match." variant="filtered" />);
    expect(b.querySelector('[data-variant="filtered"]')).toBeTruthy();
  });

  it('can offer the action that resolves it', () => {
    render(<EmptyState title="No leads yet." action={<button>Add lead</button>} />);
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('draws its words from the ladder, not from a map here (P4-T9)', () => {
    /*
     * Five hard-coded maps keyed on a three-value enum were a second definition of a
     * company's own vocabulary, in a product where the ladder is company configuration
     * (ADR-0012). A second insurer publishing a fourth rung would have had members whose
     * badge said nothing at all.
     *
     * Outside a provider the badge falls back to the seeded ladder — which is what v1
     * ships, and what keeps every existing screen looking exactly as it did.
     */
    expect(SEEDED_LADDER.map((l) => [l.code, l.label])).toEqual([
      ['AGENT', 'Agent'],
      ['AAB', 'Associate Agency Builder'],
      ['AB', 'Agency Builder'],
    ]);
  });

  it('takes a ladder code or the v1 enum, because seven services still pass the enum', () => {
    render(<RoleBadge role="AAB" />);
    expect(screen.getByText('AAB')).toBeInTheDocument();
  });

  it('shortens an acronym and spells out a longer code', () => {
    // `AGENT` shouted would be a change nobody asked for; the label is used instead.
    render(<><RoleBadge role="ab" /><RoleBadge role="agent" /></>);
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('always carries a text label, with the full name available on hover', () => {
    render(<RoleBadge role="aab" />);
    const badge = screen.getByText('AAB');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Associate Agency Builder');
  });

  it('can render the long form', () => {
    render(<RoleBadge role="ab" short={false} />);
    expect(screen.getByText('Agency Builder')).toBeInTheDocument();
  });
});

describe('Button', () => {
  /*
   * HTML defaults a button inside a form to `submit`, so every Cancel on this project's
   * inline panels was submitting the form it was cancelling. The member-removal Cancel
   * removed the person; the add-a-ratio Cancel created the ratio.
   */
  it('does not submit the form it sits in', async () => {
    const submitted = vi.fn();
    render(
      <form onSubmit={submitted}>
        <Button variant="secondary">Cancel</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(submitted).not.toHaveBeenCalled();
  });

  it('still submits when a caller asks it to', () => {
    // The default is the harmless one; it is not a prohibition.
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('runs its own onClick either way', async () => {
    const clicked = vi.fn();
    const submitted = vi.fn();
    render(
      <form onSubmit={submitted}>
        <Button onClick={clicked}>Cancel</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clicked).toHaveBeenCalledOnce();
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('paints the primary navy with white text, not amber', () => {
    /*
     * `.btn-add` — the primary on every Owner settings screen in the prototype
     * (`KPM_Owner.html:225`) — is `background:var(--navy);color:#fff`. This was `bg-amber
     * text-navy`, on a line in `tokens.md` claiming the prototypes did that. They do not: every
     * amber button in every prototype file sets `color:#fff`, which is 2.2:1 and fails AA.
     * White on navy is 13:1.
     */
    render(<Button>Publish</Button>);

    const className = screen.getByRole('button').className;
    expect(className).toContain('bg-navy');
    expect(className).toContain('text-white');
    expect(className).not.toContain('bg-amber');
  });

  it('gives a row action text rather than a box', () => {
    // `.cfg-actions a` (`KPM_Owner.html:289-292`): a bare link, grey, hovering to navy. Still a
    // real `<button>` — only the paint changes, so the focus ring and the role stay.
    render(<><Button variant="inline">Edit</Button><Button variant="inlineDanger">Archive</Button></>);

    const [edit, archive] = screen.getAllByRole('button');
    expect(edit.className).not.toContain('h-10');
    expect(edit.className).not.toContain('border');
    expect(edit.className).toContain('hover:text-navy');
    // Grey at rest, red only on hover: a row of permanently red links reads as a list of warnings.
    expect(archive.className).toContain('text-muted');
    expect(archive.className).toContain('hover:text-alert');
  });
});

describe('Field', () => {
  it('links its hint to the control, rather than printing it beside one', () => {
    /*
     * It rendered as a loose `<p>`, so a screen reader announced the label and stopped —
     * every "Permanent once saved" was invisible to the readers most likely to need it.
     */
    render(
      <Field label="Code" htmlFor="c" hint="Permanent once saved.">
        <TextInput id="c" />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Code', description: 'Permanent once saved.' }))
      .toBeInTheDocument();
  });

  it('links an error the same way, alongside the hint', () => {
    render(
      <Field label="Code" htmlFor="c" hint="Permanent." error="Already taken.">
        <TextInput id="c" />
      </Field>,
    );
    expect(screen.getByRole('textbox', { description: 'Permanent. Already taken.' }))
      .toBeInTheDocument();
  });

  it('leaves a field with neither undescribed rather than pointing at nothing', () => {
    render(<Field label="Code" htmlFor="c"><TextInput id="c" /></Field>);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('puts the hint below the control, so two fields side by side line up', () => {
    /*
     * The client's report: a hinted field beside an unhinted one put their inputs on different
     * lines, because the hint sat between the label and the control and pushed it down. Nothing
     * held them apart but guidance that reads better after the thing it describes anyway.
     *
     * Asserted as **document order**, because that is the whole of the change — the
     * `aria-describedby` wiring above is id-based and was never affected.
     */
    render(
      <Field label="Code" htmlFor="c" hint="Permanent once saved." error="Already taken.">
        <TextInput id="c" />
      </Field>,
    );

    const label = screen.getByText('Code');
    const control = screen.getByRole('textbox');
    const hint = screen.getByText('Permanent once saved.');
    const error = screen.getByRole('alert');

    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(label, control)).toBe(true);
    expect(follows(control, hint)).toBe(true);
    // Hint before error, matching the order `aria-describedby` announces them in.
    expect(follows(hint, error)).toBe(true);
  });
});

describe('ColorInput', () => {
  it('offers a picker and a hex box, and keeps them in step', async () => {
    // The field asked for "a hash and six hex digits", and not everybody thinks in hex. The
    // text half stays: the picker is an OS dialog a screen reader cannot drive, and pasting a
    // colour somebody was handed is the other half of the job.
    function Harness() {
      const [value, setValue] = useState('#2D9CDB');
      return (
        <Field label="Color" htmlFor="c" hint="Optional.">
          <ColorInput id="c" value={value} onChange={setValue} />
        </Field>
      );
    }
    render(<Harness />);

    const text = screen.getByLabelText('Color');
    expect(text).toHaveValue('#2D9CDB');
    // The description reaches the **text** input, not the wrapper `<div>` around both.
    expect(text).toHaveAccessibleDescription('Optional.');

    await userEvent.clear(text);
    await userEvent.type(text, '#27AE60');
    expect(screen.getByLabelText('Color')).toHaveValue('#27AE60');
  });

  it('shows a blank surface rather than claiming black when nothing is set', () => {
    // `<input type="color">` has no empty state — it falls back to black, which would read as
    // a colour somebody chose.
    render(
      <Field label="Color" htmlFor="c">
        <ColorInput id="c" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText('Color')).toHaveValue('');
  });
});
