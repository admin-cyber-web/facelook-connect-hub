import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, getPixelRGBA) {
  const rowSize = 1 + width * 4;
  const buffer = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    buffer[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      buffer[pxOffset] = r;
      buffer[pxOffset + 1] = g;
      buffer[pxOffset + 2] = b;
      buffer[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(buffer);

  function makeChunk(type, data) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // 8 bits per channel
  ihdrData[9] = 6;  // Color type 6: RGBA
  ihdrData[10] = 0; // Compression 0
  ihdrData[11] = 0; // Filter 0
  ihdrData[12] = 0; // Interlace 0

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Check single sub-pixel coordinate (nx, ny)
function sampleMonogram(nx, ny) {
  // Letter F check (Dark Sky Blue)
  const isF = (
    (nx >= 0.22 && nx <= 0.52 && ny >= 0.25 && ny <= 0.35) || // Top bar
    (nx >= 0.22 && nx <= 0.35 && ny >= 0.25 && ny <= 0.75) || // Left stem
    (nx >= 0.22 && nx <= 0.52 && ny >= 0.45 && ny <= 0.55)    // Middle bar
  );

  if (isF) {
    // Sky blue gradient: #38bdf8 (56, 189, 248) to #0284c7 (2, 132, 199)
    const factor = (ny - 0.25) / 0.50;
    const r = Math.round(56 + (2 - 56) * factor);
    const g = Math.round(189 + (132 - 189) * factor);
    const b = Math.round(248 + (199 - 248) * factor);
    return [r, g, b, 255];
  }

  // Letter L check (Dark Pink)
  const isL = (
    (nx >= 0.52 && nx <= 0.65 && ny >= 0.25 && ny <= 0.75) || // Right vertical stem
    (nx >= 0.52 && nx <= 0.78 && ny >= 0.65 && ny <= 0.75)    // Bottom horizontal leg
  );

  if (isL) {
    // Pink gradient: #f472b6 (244, 114, 182) to #db2777 (219, 39, 119)
    const factor = (ny - 0.25) / 0.50;
    const r = Math.round(244 + (219 - 244) * factor);
    const g = Math.round(114 + (39 - 114) * factor);
    const b = Math.round(182 + (119 - 182) * factor);
    return [r, g, b, 255];
  }

  return [0, 0, 0, 0]; // 100% Transparent
}

// 3x3 Supersampling Anti-Aliasing Pixel Generator
function getAntiAliasedPixelRGBA(x, y, width, height) {
  let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
  const samples = 3;

  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const subX = (x + (sx + 0.5) / samples) / width;
      const subY = (y + (sy + 0.5) / samples) / height;
      const [r, g, b, a] = sampleMonogram(subX, subY);
      totalR += r * (a / 255);
      totalG += g * (a / 255);
      totalB += b * (a / 255);
      totalA += a;
    }
  }

  const count = samples * samples;
  const avgA = Math.round(totalA / count);
  if (avgA === 0) return [0, 0, 0, 0];

  const avgR = Math.round((totalR / count) * (255 / avgA));
  const avgG = Math.round((totalG / count) * (255 / avgA));
  const avgB = Math.round((totalB / count) * (255 / avgA));

  return [avgR, avgG, avgB, avgA];
}

function main() {
  console.log('Generating transparent FL monogram PNG icons...');
  const rootDir = process.cwd();

  // 1. Generate public/logo.png (512x512)
  const logoBuffer = createPNG(512, 512, getAntiAliasedPixelRGBA);
  const logoPath = path.join(rootDir, 'public', 'logo.png');
  fs.writeFileSync(logoPath, logoBuffer);
  console.log('Generated 512x512 transparent PNG -> public/logo.png');

  // 2. Generate Android density PNG icons
  const densities = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 },
  ];

  for (const { name, size } of densities) {
    const dir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', `mipmap-${name}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const iconBuffer = createPNG(size, size, getAntiAliasedPixelRGBA);

    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), iconBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), iconBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), iconBuffer);

    console.log(`Generated transparent PNG icons for mipmap-${name} (${size}x${size})`);
  }

  console.log('All PNG icons generated successfully with 100% transparent backgrounds!');
}

main();
