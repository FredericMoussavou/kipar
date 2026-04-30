import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'k-red':        'var(--k-red)',
        'k-red-light':  'var(--k-red-light)',
        'k-red-border': 'var(--k-red-border)',
        'k-charcoal':   'var(--k-charcoal)',
        'k-charcoal-2': 'var(--k-charcoal-2)',
        'k-bg':         'var(--k-bg)',
        'k-white':      'var(--k-white)',
        'k-sand':       'var(--k-sand)',
        'k-sand-2':     'var(--k-sand-2)',
        'k-taupe':      'var(--k-taupe)',
        'k-border':     'var(--k-border)',
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'Syne', 'sans-serif'],
        sans: ['var(--font-sans)', 'DM Sans', 'sans-serif'],
      },
      borderRadius: {
        kipar: '14px',
        pill:  '99px',
      },
      boxShadow: {
        kipar:    '0 2px 8px rgba(0,0,0,0.05)',
        'kipar-lg': '0 4px 16px rgba(0,0,0,0.08)',
        red:      '0 4px 16px rgba(220,0,41,0.25)',
      },
    },
  },
  plugins: [],
}

export default config
