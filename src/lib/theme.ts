/**
 * Light/dark theme, stored per device.
 *
 * The stored value is the host's explicit choice. With nothing stored the
 * system preference wins and keeps winning, so a phone that flips to dark at
 * sunset takes the app with it until someone says otherwise.
 */
export type Theme = 'light' | 'dark';

const KEY = 'hgh.theme';

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function storedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // Keep the browser chrome (address bar, form controls) in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b1417' : '#dff1f1');
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice just won't survive a reload */
  }
}

/**
 * Calls back when the system preference changes, but only while the host has
 * not made a choice of their own.
 */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    if (!storedTheme()) onChange(e.matches ? 'dark' : 'light');
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
