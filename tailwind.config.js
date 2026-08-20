/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          50: '#eefbf3',
          100: '#d6f5e2',
          200: '#b0e9c9',
          300: '#7bd7a8',
          400: '#43bd83',
          500: '#1fa267',
          600: '#128253',
          700: '#0f6845',
          800: '#0f5238',
          900: '#0d4430',
          950: '#04261b',
        },
        ink: {
          50: '#f6f7f9',
          100: '#ebeef2',
          200: '#d3dae3',
          300: '#adbacb',
          400: '#8195ae',
          500: '#617795',
          600: '#4d5f7b',
          700: '#3f4d64',
          800: '#374254',
          900: '#313a48',
          950: '#12161d',
          975: '#0b0e13',
        },
        gold: {
          300: '#f7d774',
          400: '#f0c33f',
          500: '#e0a91b',
          600: '#c18512',
          700: '#9a6112',
        },
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        chip: '0 1px 2px rgba(0,0,0,.4), inset 0 0 0 2px rgba(255,255,255,.14)',
        card: '0 1px 3px rgba(0,0,0,.35), 0 8px 24px -12px rgba(0,0,0,.5)',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.35' },
        },
      },
      animation: {
        'slide-up': 'slide-up .18s ease-out',
        'pulse-ring': 'pulseRing 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
