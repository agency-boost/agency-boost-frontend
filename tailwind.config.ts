import type { Config } from 'tailwindcss';

/**
 * The theme maps to the CSS custom properties in globals.css, so a token change
 * propagates without rebuilding class names — and so no component ever needs a raw
 * hex value. `bg-[#F2994A]` fails review.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: 'var(--color-navy)', soft: 'var(--color-navy-soft)' },
        amber: { DEFAULT: 'var(--color-amber)', dark: 'var(--color-amber-dark)' },
        base: 'var(--color-base)',
        card: 'var(--color-card)',
        muted: 'var(--color-muted)',
        hairline: 'var(--color-hairline)',
        'sidebar-text': 'var(--color-sidebar-text)',
        'input-focus': 'var(--color-input-focus)',
        success: 'var(--color-success)',
        alert: 'var(--color-alert)',
        neutral: 'var(--color-neutral)',
        info: 'var(--color-info)',
        role: {
          ab: 'var(--color-role-ab)',
          aab: 'var(--color-role-aab)',
          agent: 'var(--color-role-agent)',
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
