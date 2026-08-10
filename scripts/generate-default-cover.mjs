/**
 * Generates `public/task-cover-default.png` — the cover shown on tasks that
 * have no uploaded feature image.
 *
 * Committed as a script rather than a hand-placed binary so the asset can be
 * regenerated and reviewed as code: the palette below is the only place the
 * cover's look is defined.
 *
 * A mid-tone indigo is deliberate. One static file has to sit on both the
 * light (#f6f7fd) and dark (#0d1022) content surfaces, so it can be neither
 * pale nor near-black without looking like a hole in one of the two themes.
 *
 *   node scripts/generate-default-cover.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const WIDTH = 1200;
const HEIGHT = 630;
const BYTES_PER_PIXEL = 3;

/* Diagonal gradient endpoints, both mid-tone so neither theme swallows it. */
const FROM = { r: 0x3b, g: 0x43, b: 0x82 };
const TO = { r: 0x6f, g: 0x5c, b: 0xc8 };

const DOT_SPACING = 26;
const DOT_RADIUS = 1.6;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** Smoothstep keeps the corner-to-corner blend from banding. */
const smooth = (t) => t * t * (3 - 2 * t);

function pixel(x, y) {
  const nx = x / (WIDTH - 1);
  const ny = y / (HEIGHT - 1);

  /* Base diagonal ramp. */
  const t = smooth((nx + ny) / 2);
  let r = lerp(FROM.r, TO.r, t);
  let g = lerp(FROM.g, TO.g, t);
  let b = lerp(FROM.b, TO.b, t);

  /* Soft off-centre glow so the field is not a flat ramp. */
  const dx = nx - 0.72;
  const dy = ny - 0.28;
  const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.62) ** 2;
  r += glow * 46;
  g += glow * 44;
  b += glow * 34;

  /* Vignette, strongest in the bottom-left corner opposite the glow. */
  const vignette = Math.max(0, (nx * -0.5 + (1 - ny) * -0.5 + 1) - 0.55) * 0.5;
  r -= vignette * 26;
  g -= vignette * 26;
  b -= vignette * 20;

  /*
   * Dot lattice — the same texture the card surfaces use, so the default
   * cover belongs to the design system rather than looking imported.
   */
  const gx = Math.abs(((x % DOT_SPACING) + DOT_SPACING) % DOT_SPACING - DOT_SPACING / 2);
  const gy = Math.abs(((y % DOT_SPACING) + DOT_SPACING) % DOT_SPACING - DOT_SPACING / 2);
  const dot = Math.sqrt(gx * gx + gy * gy);
  if (dot < DOT_RADIUS) {
    /* Feathered edge, otherwise the dots alias badly when scaled down. */
    const strength = (1 - dot / DOT_RADIUS) * 16;
    r += strength;
    g += strength;
    b += strength;
  }

  return [clamp255(r), clamp255(g), clamp255(b)];
}

/* ── PNG container ───────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

function encodePng(width, height) {
  /*
   * One filter byte per scanline. Sub (1) predicts each pixel from its left
   * neighbour, which turns a horizontal ramp into a near-constant delta and
   * lets deflate collapse it — the same image with filter 0 is ~8x larger.
   */
  const stride = width * BYTES_PER_PIXEL;
  const raw = Buffer.alloc(height * (stride + 1));

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 1;

    const row = Buffer.alloc(stride);
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      row[x * 3] = r;
      row[x * 3 + 1] = g;
      row[x * 3 + 2] = b;
    }

    for (let i = 0; i < stride; i += 1) {
      const left = i >= BYTES_PER_PIXEL ? row[i - BYTES_PER_PIXEL] : 0;
      raw[rowStart + 1 + i] = (row[i] - left) & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const target = join(process.cwd(), "public", "task-cover-default.png");
const png = encodePng(WIDTH, HEIGHT);
writeFileSync(target, png);

console.log(`Wrote ${target} — ${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} kB`);
