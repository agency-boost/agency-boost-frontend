import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession } from '@test/harness';
import { product, SCRIPT } from '@test/sales-tools-fixtures';
import { PushBackBox } from '@/components/plan/push-back-box';
import { NextAction, OpeningLine, SayBox, ScriptText } from '@/components/plan/script-blocks';
import { PhoneBubbles, PhoneQuote } from '@/components/plan/phone-plan';
import { ProductScript } from './product-script';
import { PhoneSalesPlan } from './sales-plan-phone';

/** Objections typed one per line, as the company's team wrote them on production (the 11-03 handover's B1-2). */
const THEY_SAY = '1. "Preminya mahal"\n2. "Nanti saja"';
const YOU_SAY = '1. Mulai Rp 300 rb sebulan.\n2. Risiko tidak menunggu.';
const LINES = {
  ...SCRIPT,
  goodFit: 'Keluarga muda\ndengan cicilan rumah',
  opening: 'Halo Pak,\nboleh minta waktunya?',
  fullScript: 'Paragraf satu.\n\nParagraf dua.',
  // One card since P19.4-T4 (ADR-0209 §9): each side keeps its lines.
  objections: [{ objection: THEY_SAY, answer: YOU_SAY }],
  nextAction: 'Kirim ilustrasi.\nJadwalkan temu kedua.',
};

/**
 * **The innermost element holding `text`, line breaks and all**, and whether it draws them: jsdom applies no stylesheet,
 * so what is asserted is the class that does — `whitespace-pre-line`, on it or on the block around it.
 */
function drawsLines(root: HTMLElement, text: string) {
  const holders = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => el.textContent?.includes(text));
  const innermost = holders.filter((el) => !holders.some((other) => other !== el && el.contains(other)));
  expect(innermost.length).toBeGreaterThan(0);
  return innermost.every((el) => el.closest('.whitespace-pre-line') !== null);
}

/**
 * **A product's words are shown with the line breaks they were saved with** (P19-T6 AC-1; the 11-03 handover's B1-2):
 * every block of the agent's catalog and Sales Attack Plan that draws a paragraph of authored words, on a laptop and a
 * phone, keeps them as typed.
 */
describe('P19-T6 AC-1 a product’s words on several lines', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T6 AC-1 the shared blocks draw a paragraph’s line breaks', () => {
    const { container } = renderWithSession(
      <div>
        <ScriptText>{LINES.goodFit}</ScriptText>
        <OpeningLine text={LINES.opening} />
        <SayBox text={LINES.fullScript} />
        <NextAction>{LINES.nextAction}</NextAction>
        <PushBackBox theySayLabel="They say:" theySay={THEY_SAY} youSayLabel="You say:" youSay={YOU_SAY} />
        <PhoneQuote text={LINES.opening} />
        <PhoneBubbles theySay={THEY_SAY} youSay={YOU_SAY} />
      </div>,
    );
    for (const text of [LINES.goodFit, LINES.opening, LINES.fullScript, LINES.nextAction, THEY_SAY, YOU_SAY]) {
      expect(drawsLines(container, text), text).toBe(true);
    }
  });

  it.each(['page', 'drawer'] as const)('P19-T6 AC-1 the plan’s blocks in the %s keep every field’s line breaks', (place) => {
    const { container } = renderWithSession(<ProductScript script={LINES} place={place} />);
    for (const text of [LINES.goodFit, LINES.opening, LINES.fullScript, THEY_SAY, YOU_SAY, LINES.nextAction]) {
      expect(drawsLines(container, text), text).toBe(true);
    }
    // The text itself arrives as stored: nothing flattened it on the way.
    expect(container.textContent).toContain(YOU_SAY);
  });

  it('P19-T6 AC-1 the phone’s plan keeps them too: the fit, the opening, the objections and the next action', () => {
    const { container } = renderWithSession(
      <PhoneSalesPlan product={product({ script: LINES })} plan={null} onSwitch={() => undefined} />,
    );
    for (const text of [LINES.goodFit, LINES.opening, THEY_SAY, YOU_SAY, LINES.nextAction]) {
      expect(drawsLines(container, text), text).toBe(true);
    }
  });
});
