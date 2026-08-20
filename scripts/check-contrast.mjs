// Contrast audit for every text-on-surface pair in the interface.
//
// Translucent surfaces make this impossible to eyeball: a label sitting on a
// 2.5%-white tile over a 66%-opaque panel over a tinted page has no single
// background colour to compare against. Each pair is composited down to a real
// colour first, then measured. Run with `npm run check:contrast`.
//
// Failures are real accessibility bugs, not style opinions.

// WCAG contrast for every text/background pair the redesign introduced.
const hex = h => { const v=h.replace('#',''); return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)); };
const lin = c => { const s=c/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4); };
const L = rgb => 0.2126*lin(rgb[0]) + 0.7152*lin(rgb[1]) + 0.0722*lin(rgb[2]);
// composite a translucent layer over a base
const over = (fg, a, bg) => fg.map((c,i)=> c*a + bg[i]*(1-a));
const ratio = (a,b) => { const [x,y]=[L(a),L(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };

const INK975=hex('#0b0e13'), INK950=hex('#12161d'), WHITE=[255,255,255];
// page background carries a faint green wash at the top
const PAGE = over(hex('#128253'), 0.13, INK975);
const PANEL = over(hex('#12161d'), 0.66, PAGE);
const CORE  = over(hex('#0e1218'), 0.90, over(WHITE,0.032,PAGE));
const FIELD = over(hex('#080b0f'), 0.75, PANEL);
const MATERIAL = over(INK975, 0.72, PANEL);
const STATBG = over(WHITE, 0.025, PANEL);
const GHOST = over(WHITE, 0.045, PANEL);

const checks = [
  ['button / primary label',        WHITE,          hex('#1a8655'), 4.5],
  ['button / ghost label',          hex('#d3dae3'), GHOST,          4.5],
  ['button / danger label',         hex('#fca5a5'), over(hex('#ef4444'),0.11,PANEL), 4.5],
  ['field / typed value',           hex('#f6f7f9'), FIELD,          4.5],
  ['field / placeholder',           hex('#7388a4'), FIELD,          3.0],
  ['form label',                    hex('#8195ae'), PANEL,          4.5],
  ['section hint body',             hex('#8195ae'), PANEL,          4.5],
  ['stat label',                    hex('#7388a4'), STATBG,         4.5],
  ['stat value / default',          hex('#f6f7f9'), STATBG,         4.5],
  ['stat value / money',            hex('#f0c33f'), STATBG,         4.5],
  ['stat value / good',             hex('#7bd7a8'), STATBG,         4.5],
  ['stat value / bad',              hex('#fca5a5'), STATBG,         4.5],
  ['clock digits',                  hex('#f6f7f9'), CORE,           4.5],
  ['clock blinds',                  hex('#7bd7a8'), CORE,           4.5],
  ['clock ante',                    hex('#f0c33f'), CORE,           4.5],
  ['notice / info',                 hex('#d6f5e2'), over(hex('#1a8655'),0.09,PANEL), 4.5],
  ['notice / warn',                 hex('#f7d774'), over(hex('#e0a91b'),0.09,PANEL), 4.5],
  ['notice / error',                hex('#fecaca'), over(hex('#ef4444'),0.09,PANEL), 4.5],
  ['action bar note',               hex('#8195ae'), MATERIAL,       4.5],
  ['segmented / inactive label',    hex('#8195ae'), over([0,0,0],0.30,PANEL), 4.5],
  ['segmented / active label',      WHITE,          hex('#1a8655'), 4.5],
  ['header / game name',            hex('#8195ae'), PAGE,           4.5],
  ['muted meta (chips count)',      hex('#7388a4'), PANEL,          4.5],
];

let fails = 0;
console.log('WCAG AA contrast audit\n');
for (const [name, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)} : ${min}  ${name}`);
}
if (fails === 0) {
  console.log('\nAll pairs pass.');
} else {
  console.error(`\n${fails} failing pair(s).`);
  process.exit(1);
}
