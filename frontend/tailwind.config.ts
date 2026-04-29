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
        'kipar-green': 'var(--kipar-green)',
        'kipar-green-mid': 'var(--kipar-green-mid)',
        'kipar-green-light': 'var(--kipar-green-light)',
        'kipar-green-pale': 'var(--kipar-green-pale)',
        'kipar-text': 'var(--kipar-text)',
        'kipar-muted': 'var(--kipar-muted)',
        'kipar-light': 'var(--kipar-light)',
        'kipar-input': 'var(--kipar-input)',
        'kipar-border': 'var(--kipar-border)',
        'kipar-danger': 'var(--kipar-danger)',
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      borderRadius: {
        kipar: '14px',
        pill: '99px',
      },
      boxShadow: {
        kipar: '0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
