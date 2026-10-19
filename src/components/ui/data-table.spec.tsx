import { render } from '@testing-library/react';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../../tailwind.config';
import { Cell, DataTable, Row } from './data-table';

/** The CSS Tailwind emits for `classes`, compiled from the real config — as `theme.spec.ts` does. */
async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css.replace(/\s+/g, ' ');
}

/** The rules of the compact table's own classes, as the browser will receive them. */
async function compactTableCss() {
  const { container } = render(
    <DataTable caption="Activity" columns={['Activity']} density="compact">
      <Row className="bg-amber/[0.16]">
        <Cell>Total — all categories</Cell>
      </Row>
    </DataTable>,
  );
  return compile(container.querySelector('table')!.className);
}

/**
 * **The row hover washes the hovered row, over its own colour** (`Overall.html:424`).
 *
 * It was `[&_tbody_tr]:hover:bg-navy/[0.015]`, which Tailwind 3 compiles to `.table:hover tbody tr`:
 * pointing anywhere at the Activity Dashboard repainted every row, and at (0,2,2) the wash beat each
 * row's own `bg-*` — the amber total row and the grey section rows went white until the pointer left
 * the table. A jsdom render cannot see `:hover`, so this asserts the CSS that decides it.
 */
describe('the compact table’s row hover', () => {
  it('is on the hovered row, not on every row of a hovered table', async () => {
    const css = await compactTableCss();

    expect(css).toMatch(/ tbody tr:hover \{/);
    expect(css).not.toMatch(/:hover tbody tr/);
  });

  it('is laid over the row’s colour as an image, never painted instead of it', async () => {
    const css = await compactTableCss();
    const hover = css.match(/ tbody tr:hover \{([^}]*)\}/)![1];

    expect(hover).toContain('background-image: linear-gradient(var(--row-hover),var(--row-hover))');
    expect(hover).not.toContain('background-color');
  });
});
