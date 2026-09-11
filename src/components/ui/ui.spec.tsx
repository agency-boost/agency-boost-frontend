import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusPill, statusFor, STATUS_LABEL } from './status-pill';
import { Stepper } from './stepper';
import { ProgressBar } from './progress-bar';
import { EmptyState } from './empty-state';
import { RoleBadge, SEEDED_LADDER } from './role-badge';

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
