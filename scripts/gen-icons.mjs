// Rasterizes the app icon to PNG at several sizes.
// Kept dependency-free: draws the chip procedurally and encodes PNG with node:zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const FELT = hex('#0d4430');
const DARK = hex('#12161d');
const GOLD = hex('#e0a91b');
const GOLD_LT = hex('#f0c33f');

// Signed-distance style sampling in a normalized [-256, 256] space.
function sample(x, y, maskable) {
  const inset = maskable ? 1.22 : 1; // shrink art so it survives a maskable safe-zone crop
  const px = x * inset;
  const py = y * inset;
  const r = Math.hypot(px, py);
  const bg = maskable ? FELT : null;

  // Rounded-rect plate (only for the non-maskable variant; maskable fills edge to edge).
  if (!maskable) {
    const R = 112 * (512 / 512);
    const ax = Math.abs(x) - (256 - R);
    const ay = Math.abs(y) - (256 - R);
    const outside =
      ax > 0 && ay > 0 ? Math.hypot(ax, ay) > R : Math.abs(x) > 256 || Math.abs(y) > 256;
    if (outside) return null; // transparent corner
  }

  if (r <= 72 * 1.0 && Math.abs(px) / 62 + Math.abs(py) / 72 <= 1) return GOLD_LT; // pip
  if (Math.abs(px) / 62 + Math.abs(py) / 72 <= 1) return GOLD_LT;
  if (r <= 104) return FELT;

  // Edge spots: 8 radial notches between r=122 and r=168.
  if (r >= 118 && r <= 172) {
    const a = Math.atan2(py, px);
    const seg = Math.round((a / (Math.PI / 4)) * 1) * (Math.PI / 4);
    const d = Math.abs(((a - seg + Math.PI * 3) % (Math.PI / 2)) - Math.PI / 4) - Math.PI / 4;
    // width of the notch in radians shrinks with radius so it reads as a rounded bar
    if (Math.abs(d) < 0.19) return GOLD;
  }
  if (r >= 154 && r <= 168) return GOLD; // outer ring
  if (r <= 168) return DARK;
  return bg ?? FELT;
}

function render(size, maskable) {
  const SS = 3; // supersample factor
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = ((px + (sx + 0.5) / SS) / size) * 512 - 256;
          const ny = ((py + (sy + 0.5) / SS) / size) * 512 - 256;
          const c = sample(nx, ny, maskable);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const alpha = a / n;
      // premultiplied-average colour, then un-premultiply against coverage
      buf[i] = alpha ? Math.round(r / (a / 255)) : 0;
      buf[i + 1] = alpha ? Math.round(g / (a / 255)) : 0;
      buf[i + 2] = alpha ? Math.round(b / (a / 255)) : 0;
      buf[i + 3] = Math.round(alpha);
    }
  }
  return buf;
}

function crc32(buf) {
  let c,
    table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size, render(size, true)));
  console.log(`public/icon-${size}.png`);
}
