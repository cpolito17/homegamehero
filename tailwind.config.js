/** Builds a Tailwind colour scale whose every step reads from a CSS variable. */
function rampVar(name, steps) {
  return Object.fromEntries(
    steps.map((step) => [step, `rgb(var(--${name}-${step}) / <alpha-value>)`]),
  );
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every scale resolves through a CSS variable so one set of class names
        // serves both themes. Light and dark are defined in index.css.
        accent: rampVar('accent', [100, 300, 400, 500, 600, 700]),
        money: rampVar('money', [300, 400, 500, 600]),
        ink: rampVar('ink', [50, 100, 200, 300, 400, 500, 600, 900, 950, 975]),
        red: rampVar('red', [100, 200, 300, 400, 500, 600]),
        // Overlay tints. `raise` lifts a surface off the one behind it, `line`
        // draws its edge. Both flip polarity between themes: white on dark,
        // deep ink on light.
        raise: 'rgb(var(--raise) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
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
