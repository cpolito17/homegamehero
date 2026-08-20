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
          500: '#1a8655',
          600: '#17774b',
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
          500: '#7388a4',
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
        sans: ['"Geist Variable"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        shell: 'var(--r-shell)',
        core: 'var(--r-core)',
        control: 'var(--r-control)',
        inner: 'var(--r-inner)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        chip: '0 1px 2px rgba(0,0,0,.4), inset 0 0 0 2px rgba(255,255,255,.16)',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.45' },
        },
      },
      animation: {
        breathe: 'breathe 1.4s cubic-bezier(0.32, 0.72, 0, 1) infinite',
      },
    },
  },
  plugins: [],
};
