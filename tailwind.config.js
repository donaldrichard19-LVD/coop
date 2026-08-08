/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        surface: {
          primary: 'var(--surface-primary)',
          elevated: 'var(--surface-elevated)',
          bubble: 'var(--surface-bubble)',
        },
        separator: {
          subtle: 'var(--separator-subtle)',
          strong: 'var(--separator-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        tint: {
          cta: 'var(--tint-cta)',
          primary: 'var(--tint-primary)',
        },
        fill: {
          DEFAULT: 'var(--fill)',
          strong: 'var(--fill-strong)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
      },
      fontSize: {
        largeTitle: ['34px', { lineHeight: '41px', letterSpacing: '-0.02em', fontWeight: '600' }],
        title: ['28px', { lineHeight: '34px', letterSpacing: '0em', fontWeight: '600' }],
        title2: ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '600' }],
        body: ['17px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        callout: ['16px', { lineHeight: '21px', letterSpacing: '0em', fontWeight: '400' }],
        subheadline: ['15px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '400' }],
        footnote: ['13px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '400' }],
        caption2: ['11px', { lineHeight: '13px', letterSpacing: '0em', fontWeight: '400' }],
        monospaced: ['17px', { lineHeight: '22px', letterSpacing: '0.06em', fontWeight: '400' }],
        savingsFigure: ['44px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      borderRadius: {
        small: '12px',
        medium: '18px',
        large: '24px',
        xlarge: '32px',
        capsule: '9999px',
      },
      scale: {
        press: '.97',
      },
      transitionDuration: {
        fast: '150ms',
        standard: '220ms',
        slow: '350ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.25, 1, 0.4, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'splash-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'splash-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        'rise-in': 'rise-in 220ms cubic-bezier(0.25, 1, 0.4, 1) both',
        'splash-in': 'splash-in 700ms cubic-bezier(0.25, 1, 0.4, 1) both',
        'splash-fade': 'splash-fade 500ms ease both',
      },
    },
  },
  plugins: [],
}
