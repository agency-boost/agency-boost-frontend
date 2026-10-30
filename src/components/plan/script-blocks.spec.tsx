import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PushBackBox } from './push-back-box';
import { BulletList, NextAction, OpeningLine, SayBox, ScriptBlock, ScriptNote, ScriptText } from './script-blocks';

/**
 * **The numbered script blocks and the push-back box** (D-components; P14-T7 AC-6). Shared with the
 * Recruitment Attack Plan (P17-T3), so what they promise is asserted here, apart from any product.
 */
describe('the script blocks (D-components)', () => {
  it('a block is a heading named by its number and its label, the number drawn once for the eye', () => {
    render(<ScriptBlock n={3} label="Full script — how to narrate it"><ScriptText>words</ScriptText></ScriptBlock>);
    expect(screen.getByRole('heading', { level: 3, name: '3 Full script — how to narrate it' })).toBeInTheDocument();
    expect(screen.getByText('words')).toBeInTheDocument();
  });

  it('the lead block is amber-ink, where the prototype’s amber-dark misses on a card', () => {
    const { container } = render(<ScriptBlock n={0} label="Good fit for" lead>x</ScriptBlock>);
    expect(container.querySelector('h3')).toHaveClass('text-amber-ink');
    expect(container.innerHTML).not.toMatch(/amber-dark/);
  });

  it('the opening line is in quotation marks', () => {
    render(<OpeningLine text="Halo Pak" />);
    expect(screen.getByText('“Halo Pak”')).toBeInTheDocument();
  });

  it('a list draws every point in order', () => {
    render(<BulletList items={['one', 'two', 'one']} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two', 'one']);
  });

  it('P14-T7 AC-6 renders authored words as text: a bold tag and a script tag print as characters', () => {
    const marked = 'Halo <b>Pak</b><script>noop</script>';
    const { container } = render(
      <>
        <OpeningLine text={marked} />
        <SayBox text={marked} />
        <BulletList items={[marked]} />
        <NextAction>{marked}</NextAction>
        <ScriptNote>{marked}</ScriptNote>
        <PushBackBox theySayLabel="They say:" theySay={marked} youSayLabel="You say:" youSay={marked} />
      </>,
    );
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByText(/<b>Pak<\/b><script>/).length).toBeGreaterThanOrEqual(5);
  });

  it('D-components: no plan component imports anything about products, and each names P17-T3 as its second user', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.tsx') && !f.includes('.spec.'));
    // UI V1 (UI-107) added the phone's parts — both plans' too, so they name the ticket rather than P17-T3.
    const UI_V1 = ['phone-plan.tsx', 'plan-button.tsx', 'plan-icons.tsx', 'plan-tabs.tsx'];
    expect(files.sort()).toEqual([
      'alternatives-row.tsx', 'brief-card.tsx', 'brief-summary.tsx', 'phone-plan.tsx', 'plan-button.tsx',
      'plan-icons.tsx', 'plan-tabs.tsx', 'push-back-box.tsx', 'result-head.tsx', 'script-blocks.tsx', 'step-pills.tsx',
    ]);
    for (const file of files) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect([file, /from '@\/lib\/product-catalog'|from '@\/lib\/api/.test(src)]).toEqual([file, false]);
      expect([file, src.includes(UI_V1.includes(file) ? 'UI-107' : 'P17-T3')]).toEqual([file, true]);
    }
  });
});
