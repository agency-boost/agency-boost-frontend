import type { Config } from 'tailwindcss';

/**
 * A colour token that takes an opacity modifier — `bg-amber/15`, `bg-navy/[0.06]`.
 *
 * **A bare `var(--color-amber)` does not.** Tailwind 3 cannot see a colour inside a custom
 * property, so it cannot split it into channels, and it drops every class that asks for an opacity
 * — no rule is emitted at all. That is how every tint in the product rendered transparent: the role
 * badge's wash, the leads table's status rungs, the notices, the hover states, the KPI tiles. Found
 * walking the *Active (MAA)* column in a browser (ADR-0054), whose tinted circles were not there,
 * after every jsdom test had passed — jsdom applies no stylesheet, so no test could have seen it.
 *
 * `color-mix` against `transparent` is how Tailwind 4 does it, and it keeps the token a token:
 * `<alpha-value>` is `1` for `bg-amber` and `0.15` for `bg-amber/15`. `theme.spec.ts` compiles the
 * classes and asserts the rules exist, so this cannot silently go back.
 */
const token = (name: string) => `color-mix(in srgb, var(--color-${name}) calc(<alpha-value> * 100%), transparent)`;

/**
 * The theme maps to the CSS custom properties in globals.css, so a token change
 * propagates without rebuilding class names — and so no component ever needs a raw
 * hex value. `bg-[#F2994A]` fails review.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    /**
     * **`text-base` is a size and must never also be a colour.**
     *
     * `colors.base` and `fontSize.base` both generate a `.text-base` rule, and the colour one is
     * emitted second — so `text-base` painted every element it was on in `--color-base`, a
     * near-white. It only showed where nothing set a colour afterwards and the class carried extra
     * specificity: `[&_td]:text-base` on the leads table (0,1,1) beat the cell's own `.text-navy`
     * (0,1,0), and the row number and the registered date came out invisible on white.
     *
     * **At `theme`, not `theme.extend`.** Inside `extend` this merged with the default scale, and
     * the default `textColor` *is* `theme('colors')` — so `base` came straight back through it and
     * the rule stayed in the stylesheet. Declared here it replaces the scale, and `theme('colors')`
     * resolves after the extend below, so every other colour survives, `text-white` included.
     *
     * Nothing wants near-white text on a light ground; `text-card` and `text-white` exist for the
     * dark ones. `theme.spec.ts` asserts no colour name collides with a font size again.
     */
    textColor: ({ theme }) => {
      const { base: _base, ...rest } = theme('colors') as Record<string, string>;
      return rest;
    },
    extend: {
      colors: {
        navy: { DEFAULT: token('navy'), soft: token('navy-soft') },
        amber: {
          DEFAULT: token('amber'),
          dark: token('amber-dark'),
          deep: token('amber-deep'),
          ink: token('amber-ink'),
        },
        base: token('base'),
        card: token('card'),
        muted: token('muted'),
        hairline: token('hairline'),
        'sidebar-text': token('sidebar-text'),
        'input-focus': token('input-focus'),
        success: token('success'),
        alert: token('alert'),
        neutral: token('neutral'),
        info: token('info'),
        role: {
          ab: token('role-ab'),
          aab: token('role-aab'),
          agent: token('role-agent'),
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      // Nine steps replacing the prototype's 18 sizes, several separated by half a
      // pixel. Declared in rem so browser zoom and OS text sizing work.
      fontSize: {
        '2xs': ['0.625rem', '1.4'],
        xs: ['0.6875rem', '1.4'],
        sm: ['0.75rem', '1.45'],
        base: ['0.8125rem', '1.45'],
        md: ['0.875rem', '1.45'],
        lg: ['1rem', '1.45'],
        xl: ['1.125rem', '1.2'],
        '2xl': ['1.25rem', '1.2'],
        '3xl': ['1.75rem', '1.2'],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '12px', pill: '999px' },
      boxShadow: { modal: 'var(--shadow-modal)' },
      spacing: { sidebar: 'var(--sidebar-width)' },
    },
  },
  plugins: [],
};

export default config;
