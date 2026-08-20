// Contrast audit for every text-on-surface pair in the interface, in both themes.
//
// Translucent surfaces make this impossible to eyeball: a label sitting on a
// 2.5% tile over a 66%-opaque panel over a tinted page has no single background
// colour to compare against. Each pair is composited down to a real colour
// first, then measured. Run with `npm run check:contrast`.
//
// Failures are real accessibility bugs, not style opinions. The palette was
// chosen by hand; this is what keeps that choice honest.

const hex = (h) => {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
/** Composite a translucent layer over a base. */
const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const ratio = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const WHITE = [255, 255, 255];

/** Mirrors the token blocks in src/index.css. Keep the two in step. */
const THEMES = {
  light: {
    ink50: '#102024', ink100: '#16292e', ink200: '#22383e', ink300: '#335057',
    ink400: '#3f5f67', ink500: '#4e6e76', ink600: '#5a787f',
    ink900: '#f5f5f5', ink950: '#ffffff', ink975: '#dff1f1',
    accent300: '#c10000', accent500: '#d60000',
    money300: '#0b5a63', money400: '#0e6e78',
    red300: '#c10000', red500: '#ff0000',
    raise: '#115a64', pageWash: '#11828e', pageWashA: 0.1,
    chrome: '#dff1f1', chromeA: 0.78,
    panelBg: '#ffffff', panelA: 1,
    coreBg: '#ffffff', fieldBg: '#ffffff',
    btnInk: '#ffffff',
  },
  dark: {
    ink50: '#f5f5f5', ink100: '#dff1f1', ink200: '#c9e0e5', ink300: '#b0ced4',
    ink400: '#a9c0c6', ink500: '#93adb4', ink600: '#7e979e',
    ink900: '#16282d', ink950: '#101e22', ink975: '#0b1417',
    accent300: '#ff5252', accent500: '#d60000',
    money300: '#7ad6e0', money400: '#5fc8d4',
    red300: '#ff7a7a', red500: '#ff0000',
    raise: '#ffffff', pageWash: '#3caab8', pageWashA: 0.1,
    chrome: '#0b1417', chromeA: 0.72,
    panelBg: '#101e22', panelA: 0.66,
    coreBg: '#0d191d', fieldBg: '#081013',
    btnInk: '#ffffff',
  },
};

function auditTheme(name, t) {
  const PAGE = over(hex(t.pageWash), t.pageWashA, hex(t.ink975));
  const PANEL = over(hex(t.panelBg), t.panelA, PAGE);
  const CORE = over(hex(t.coreBg), 0.9, over(hex(t.raise), 0.032, PAGE));
  const FIELD = over(hex(t.fieldBg), 0.75, PANEL);
  const MATERIAL = over(hex(t.chrome), t.chromeA, PANEL);
  const STATBG = over(hex(t.raise), 0.025, PANEL);
  const GHOST = over(hex(t.raise), 0.045, PANEL);
  const ROW = over(hex(t.raise), 0.02, PANEL);

  const checks = [
    ['button / primary label', hex(t.btnInk), hex(t.accent500), 4.5],
    ['button / ghost label', hex(t.ink200), GHOST, 4.5],
    ['button / danger label', hex(t.red300), over(hex(t.red500), 0.11, PANEL), 4.5],
    ['field / typed value', hex(t.ink50), FIELD, 4.5],
    ['field / placeholder', hex(t.ink500), FIELD, 3.0],
    ['form label', hex(t.ink400), PANEL, 4.5],
    ['section hint body', hex(t.ink400), PANEL, 4.5],
    ['stat label', hex(t.ink500), STATBG, 4.5],
    ['stat value / default', hex(t.ink50), STATBG, 4.5],
    ['stat value / money', hex(t.money400), STATBG, 4.5],
    ['stat value / good', hex(t.money300), STATBG, 4.5],
    ['stat value / bad', hex(t.red300), STATBG, 4.5],
    ['clock digits', hex(t.ink50), CORE, 4.5],
    ['clock blinds', hex(t.money300), CORE, 4.5],
    ['clock ante', hex(t.money400), CORE, 4.5],
    ['notice / info', hex(t.ink100), over(hex(t.money400), 0.09, PANEL), 4.5],
    ['notice / warn', hex(t.ink100), over(hex(t.money500 ?? t.money400), 0.09, PANEL), 4.5],
    ['notice / error', hex(t.red300), over(hex(t.red500), 0.09, PANEL), 4.5],
    ['action bar note', hex(t.ink400), MATERIAL, 4.5],
    ['segmented / inactive label', hex(t.ink400), over([0, 0, 0], 0.06, PANEL), 4.5],
    ['segmented / active label', hex(t.btnInk), hex(t.accent500), 4.5],
    ['header / game name', hex(t.ink400), PAGE, 4.5],
    ['muted meta (chips count)', hex(t.ink500), PANEL, 4.5],
    ['list row / player name', hex(t.ink100), ROW, 4.5],
    ['list row / faint meta', hex(t.ink600), ROW, 4.5],
    ['accent text on panel', hex(t.accent300), PANEL, 4.5],
    ['theme toggle glyph', hex(t.ink300), PAGE, 3.0],
  ];

  let fails = 0;
  console.log(`\n${name} theme`);
  for (const [label, fg, bg, min] of checks) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)} : ${min}  ${label}`);
  }
  return fails;
}

console.log('WCAG AA contrast audit');
let fails = 0;
for (const [name, tokens] of Object.entries(THEMES)) fails += auditTheme(name, tokens);

if (fails === 0) {
  console.log('\nAll pairs pass in both themes.');
} else {
  console.error(`\n${fails} failing pair(s).`);
  process.exit(1);
}
