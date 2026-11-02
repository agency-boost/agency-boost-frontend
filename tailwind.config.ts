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
        // UI V1 (UI-008, the report's token table). A card's edge: the hairline, and none on a V1 surface (`globals.css`).
        'card-edge': token('card-edge'),
        // The four status pills, tint and words (D-27: never a dot).
        pill: {
          red: token('pill-red'),
          'red-ink': token('pill-red-ink'),
          amber: token('pill-amber'),
          'amber-ink': token('pill-amber-ink'),
          green: token('pill-green'),
          'green-ink': token('pill-green-ink'),
          grey: token('pill-grey'),
          'grey-ink': token('pill-grey-ink'),
          // The Group Tree's *Anda* pill on the reader's own row (UI-059; W1-B's shared person row).
          blue: token('pill-blue'),
          'blue-ink': token('pill-blue-ink'),
        },
        // Words on white, and words on navy.
        signal: { red: token('signal-red'), green: token('signal-green'), grey: token('signal-grey') },
        'on-navy': {
          red: token('on-navy-red'),
          green: token('on-navy-green'),
          lavender: token('on-navy-lavender'),
          // The ratio card's *Target X*, and the line between its rows (UI-053; W1-B).
          muted: token('on-navy-muted'),
          line: token('on-navy-line'),
        },
        // WhatsApp's round button (UI-081; W1-B's `ContactButtons`).
        whatsapp: token('whatsapp'),
        // The one ink, the desktop's row under the pointer, a divider between rows, the tree's lines, the Recruitment bar.
        ink: token('ink'),
        'hover-row': token('hover-row'),
        divider: token('divider'),
        line: token('line'),
        lavender: token('lavender'),
        'sidebar-text': token('sidebar-text'),
        'input-focus': token('input-focus'),
        success: token('success'),
        club: { chairman: token('club-chairman') },
        // MDRT's poster fill, and its ✓ on the roster at 4.03:1 (P18.5-T7, row 44).
        gold: { DEFAULT: token('gold'), ink: token('gold-ink') },
        alert: token('alert'),
        neutral: token('neutral'),
        info: token('info'),
        // Travel (H-19). `DEFAULT` and `ink` merge into Tailwind's own teal scale, which no component
        // uses: `bg-teal`, `border-teal` and `text-teal-ink` are the calendar's.
        teal: { DEFAULT: token('teal'), ink: token('teal-ink') },
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
      //
      // **The five steps under 16px are custom properties** (`globals.css`), at the same rem they
      // always had, so a phone can move them and nothing wider does (ADR-0167, the client's UI review
      // of 2026-10-26): below 768px `2xs` and `xs` read 12px, the floor (UI-029), and inside a field all
      // five read 16px, so iOS does not zoom the page on focus (UI-014). One rule each, rather than a
      // `max-md:` class on 244 call sites. `theme.spec.ts` pins the values.
      fontSize: {
        '2xs': ['var(--text-2xs)', '1.4'],
        xs: ['var(--text-xs)', '1.4'],
        sm: ['var(--text-sm)', '1.45'],
        base: ['var(--text-base)', '1.45'],
        md: ['var(--text-md)', '1.45'],
        lg: ['1rem', '1.45'],
        xl: ['1.125rem', '1.2'],
        '2xl': ['1.25rem', '1.2'],
        '3xl': ['1.75rem', '1.2'],
        // A page's title (UI V1, UI-004, UI-008): 20px, 22px from 768px, 24px from 1024px — the width is the stylesheet's.
        title: ['var(--text-title)', '1.2'],
      },
      // `lg` is a card's corner: 12px, and 16px on a V1 surface; `row` a row's or a tile's inside one, 14px there (UI-008).
      borderRadius: { sm: '4px', md: '8px', lg: 'var(--radius-card)', row: 'var(--radius-row)', pill: '999px' },
      boxShadow: { modal: 'var(--shadow-modal)', bar: 'var(--shadow-bar)' },
      spacing: { sidebar: 'var(--sidebar-width)' },
    },
  },
  plugins: [],
};

export default config;
