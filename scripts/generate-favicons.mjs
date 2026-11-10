import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const OUT_DIR = path.resolve('src/assets/favicons');
const BRAND_BLUE = [59, 130, 246]; // #3b82f6
const BRAND_BLUE_DARK = [37, 99, 235]; // #2563eb
const WHITE = [255, 255, 255];

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xEDB88320;
      else crc = crc >>> 1;
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Draw a rounded square with a white X on a blue gradient background
function drawIcon(width, height, maskable = false) {
  const safeZone = maskable ? 0.8 : 1.0;
  const contentSize = Math.min(width, height) * safeZone;
  const offsetX = (width - contentSize) / 2;
  const offsetY = (height - contentSize) / 2;
  const radius = contentSize * 0.1875;

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const cx = x - offsetX;
      const cy = y - offsetY;
      let inSquare = false;
      if (cx >= 0 && cx <= contentSize && cy >= 0 && cy <= contentSize) {
        let dx = cx;
        let dy = cy;
        if (cx < radius) dx = cx - radius;
        if (cx > contentSize - radius) dx = cx - (contentSize - radius);
        if (cy < radius) dy = cy - radius;
        if (cy > contentSize - radius) dy = cy - (contentSize - radius);

        if (dx <= 0 && dy <= 0) inSquare = true;
        else if (dx > 0 && dy > 0 && dx * dx + dy * dy <= radius * radius) inSquare = true;
        else if (dx <= 0 && dy > 0 && dy <= contentSize - radius) inSquare = true;
        else if (dx > 0 && dy <= 0 && dx <= contentSize - radius) inSquare = true;
        else if (dy <= 0 && dx > contentSize - radius) inSquare = true;
        else if (dx <= 0 && dy > contentSize - radius) inSquare = true;
        else if (dx > contentSize - radius && dy > contentSize - radius && dx * dx + dy * dy <= radius * radius) inSquare = true;
        else if (dx > contentSize - radius && dy <= contentSize - radius && dy >= radius) inSquare = true;
        else if (dx <= contentSize - radius && dy > contentSize - radius && dx >= radius) inSquare = true;
      }

      if (inSquare) {
        const gx = cx / contentSize;
        const gy = cy / contentSize;
        const t = (gx + gy) / 2;
        const rgb = lerpColor(BRAND_BLUE, BRAND_BLUE_DARK, t);
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 255;
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }

      const lineWidth = Math.max(1, contentSize * 0.078);
      const x1 = offsetX + contentSize * 0.3125;
      const y1 = offsetY + contentSize * 0.3125;
      const x2 = offsetX + contentSize * 0.6875;
      const y2 = offsetY + contentSize * 0.6875;

      const dist1 = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
      const dist2 = Math.abs((y1 - y2) * x - (x1 - x2) * y + x1 * y2 - y1 * x2) / Math.sqrt((y1 - y2) ** 2 + (x1 - x2) ** 2);

      if (dist1 <= lineWidth || dist2 <= lineWidth) {
        data[idx] = WHITE[0];
        data[idx + 1] = WHITE[1];
        data[idx + 2] = WHITE[2];
        data[idx + 3] = 255;
      }
    }
  }

  return data;
}

function makePNG(width, height, maskable = false) {
  const raw = drawIcon(width, height, maskable);

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    scanlines.push(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      scanlines.push(raw[idx], raw[idx + 1], raw[idx + 2], raw[idx + 3]);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(scanlines), { level: 9 });

  const chunks = [];

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  chunks.push({ name: 'IHDR', data: ihdr });

  chunks.push({ name: 'IDAT', data: compressed });
  chunks.push({ name: 'IEND', data: Buffer.alloc(0) });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let body = signature;

  for (const chunk of chunks) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(chunk.data.length, 0);
    const crcInput = Buffer.concat([Buffer.from(chunk.name, 'ascii'), chunk.data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    body = Buffer.concat([body, len, Buffer.from(chunk.name, 'ascii'), chunk.data, crc]);
  }

  return body;
}

function makeICO(sizes) {
  const images = [];
  let offset = 6 + sizes.length * 16;

  for (const { width, height, data } of sizes) {
    images.push({ width, height, data, offset });
    offset += data.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let result = header;

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.width === 256 ? 0 : img.width;
    entry[1] = img.height === 256 ? 0 : img.height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(img.offset, 12);
    result = Buffer.concat([result, entry]);
  }

  for (const img of images) {
    result = Buffer.concat([result, img.data]);
  }

  return result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  const sizes = [16, 32, 48, 180, 192, 512];
  const pngData = {};

  for (const size of sizes) {
    const maskable = size === 512;
    const data = makePNG(size, size, maskable);
    const name = maskable ? 'icon-maskable-512.png' : `favicon-${size}x${size}.png`;
    pngData[size] = data;
    fs.writeFileSync(path.join(OUT_DIR, name), data);
    console.log(`Created ${name} (${data.length} bytes)`);
  }

  const icoEntries = [
    { width: 16, height: 16, data: pngData[16] },
    { width: 32, height: 32, data: pngData[32] },
    { width: 48, height: 48, data: pngData[48] },
  ];
  const icoData = makeICO(icoEntries);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), icoData);
  console.log(`Created favicon.ico (${icoData.length} bytes)`);

  fs.writeFileSync(path.join(OUT_DIR, 'apple-touch-icon.png'), pngData[180]);
  console.log(`Created apple-touch-icon.png`);

  console.log('\nAll favicon files generated successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
