/**
 * gen-favicon.mjs — генератор favicon без внешних зависимостей.
 *
 * Создаёт:
 *   public/favicon.svg           — SVG-иконка (Chrome/Firefox/Edge/Safari 14.1+)
 *   public/favicon.ico           — ICO с 16×16 и 32×32 (legacy browsers)
 *   public/apple-touch-icon.png  — 180×180 PNG для iOS
 *
 * Дизайн: ✦ (4-pointed sparkle) золотого цвета на тёмном фоне.
 * Совпадает с символом ✦ в кнопке «Создать шедевр».
 *
 * Запуск: node scripts/gen-favicon.mjs
 */

import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// ── Palette ──────────────────────────────────────────────────────────────────
const BG   = { r: 12,  g: 12,  b: 14  }; // #0c0c0e — почти чёрный, с лёгким синим
const GOLD = { r: 232, g: 170, b: 40  }; // #e8aa28 — warm gold, premium amber

// ── 4-pointed star formula ────────────────────────────────────────────────────
// Пиксель золотой если:
//   (|nx| < barW OR |ny| < barW) AND |nx| + |ny| < reach
// nx, ny — нормализованные координаты [-1..1] от центра
function isGold(nx, ny, barW = 0.14, reach = 0.88) {
  const ax = Math.abs(nx), ay = Math.abs(ny);
  return (ax < barW || ay < barW) && (ax + ay < reach);
}

// Рисует иконку размером size×size, возвращает Uint8Array (RGBA)
function drawIcon(size) {
  const buf = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - half + 0.5) / half;
      const ny = (y - half + 0.5) / half;
      const gold = isGold(nx, ny);
      const i = (y * size + x) * 4;
      buf[i]   = gold ? GOLD.r : BG.r;
      buf[i+1] = gold ? GOLD.g : BG.g;
      buf[i+2] = gold ? GOLD.b : BG.b;
      buf[i+3] = 255;
    }
  }
  return buf;
}

// ── SVG favicon ───────────────────────────────────────────────────────────────
function makeSVG() {
  // Чистый SVG с viewBox — браузер рендерит в любом размере
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0c0c0e"/>
  <!-- ✦ 4-pointed star, gold -->
  <path d="
    M16 3 L17.5 14.5 L29 16 L17.5 17.5 L16 29
    L14.5 17.5 L3 16 L14.5 14.5 Z
  " fill="#e8aa28"/>
</svg>`;
}

// ── PNG encoder (pure Node.js, only zlib) ─────────────────────────────────────
function makePNG(rgba, size) {
  const crc32 = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    return (buf, init = 0xffffffff) => {
      let c = init;
      for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32([...typeB, ...data]));
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll convert RGBA → RGB, set alpha separately)
  // Use color type 6 (RGBA) for simplicity
  ihdr[9] = 6;

  // Raw scanlines: filter byte (0) + RGBA per pixel
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 4) + 1 + x * 4;
      raw[dst]   = rgba[src];
      raw[dst+1] = rgba[src+1];
      raw[dst+2] = rgba[src+2];
      raw[dst+3] = rgba[src+3];
    }
  }

  const compressed = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO encoder ───────────────────────────────────────────────────────────────
// ICO = header(6) + dir entries(16 each) + BMP data per image
// BMP inside ICO: BITMAPINFOHEADER(40) + BGRA pixels (top-to-bottom reversed)
//                 + AND mask (all zeros = fully opaque)
function makeBMPForICO(rgba, size) {
  const pixelCount = size * size;
  const pixelBytes = pixelCount * 4; // 32-bit BGRA
  const maskRowBytes = Math.ceil(size / 8 / 4) * 4; // padded to DWORD
  const maskBytes = maskRowBytes * size;

  const dibSize = 40 + pixelBytes + maskBytes;
  const dib = Buffer.alloc(dibSize, 0);

  // BITMAPINFOHEADER
  dib.writeUInt32LE(40, 0);           // biSize
  dib.writeInt32LE(size, 4);          // biWidth
  dib.writeInt32LE(size * 2, 8);      // biHeight × 2 (ICO quirk)
  dib.writeUInt16LE(1, 12);           // biPlanes
  dib.writeUInt16LE(32, 14);          // biBitCount
  dib.writeUInt32LE(0, 16);           // biCompression: BI_RGB
  dib.writeUInt32LE(pixelBytes, 20);  // biSizeImage
  // rest zeros

  // Pixel data — BMP is bottom-to-top, BGRA order
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcRow = size - 1 - y; // flip vertical
      const src = (srcRow * size + x) * 4; // RGBA
      const dst = 40 + (y * size + x) * 4;
      dib[dst]   = rgba[src + 2]; // B
      dib[dst+1] = rgba[src + 1]; // G
      dib[dst+2] = rgba[src];     // R
      dib[dst+3] = rgba[src + 3]; // A
    }
  }
  // AND mask: already zero (fully opaque) — Buffer.alloc initialises to 0

  return dib;
}

function makeICO(sizes) {
  const bmps = sizes.map(size => makeBMPForICO(drawIcon(size), size));
  const count = sizes.length;
  const headerSize = 6 + count * 16;

  // Calculate offsets
  const offsets = [];
  let offset = headerSize;
  for (const bmp of bmps) {
    offsets.push(offset);
    offset += bmp.length;
  }

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);

  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    const s = sizes[i];
    header[base]   = s >= 256 ? 0 : s; // width (0 = 256)
    header[base+1] = s >= 256 ? 0 : s; // height
    header[base+2] = 0;  // color count (0 = >256)
    header[base+3] = 0;  // reserved
    header.writeUInt16LE(1, base+4);  // planes
    header.writeUInt16LE(32, base+6); // bit count
    header.writeUInt32LE(bmps[i].length, base+8);
    header.writeUInt32LE(offsets[i], base+12);
  }

  return Buffer.concat([header, ...bmps]);
}

// ── Write files ───────────────────────────────────────────────────────────────
console.log('Generating favicons...');

writeFileSync(path.join(PUBLIC, 'favicon.svg'), makeSVG(), 'utf8');
console.log('  ✓ favicon.svg');

const ico = makeICO([16, 32]);
writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico);
console.log('  ✓ favicon.ico (16×16 + 32×32)');

const touch = drawIcon(180);
const touchPng = makePNG(touch, 180);
writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), touchPng);
console.log('  ✓ apple-touch-icon.png (180×180)');

console.log('\nDone. Add to index.html:');
console.log(`  <link rel="icon" type="image/svg+xml" href="/favicon.svg">`);
console.log(`  <link rel="icon" type="image/x-icon" href="/favicon.ico">`);
console.log(`  <link rel="apple-touch-icon" href="/apple-touch-icon.png">`);
