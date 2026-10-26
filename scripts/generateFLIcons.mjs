import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="skyBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f472b6" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
  </defs>
  <!-- Letter F in Dark Sky Blue -->
  <path d="M 112 144 H 256 V 200 H 176 V 248 H 256 V 304 H 176 V 384 H 112 Z" fill="url(#skyBlueGrad)" />
  <!-- Letter L in Dark Pink -->
  <path d="M 256 144 H 320 V 328 H 400 V 384 H 256 Z" fill="url(#pinkGrad)" />
</svg>
`;

async function main() {
  console.log('Launching browser to render FL icons...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set transparent page content
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: transparent;
            width: 512px;
            height: 512px;
            overflow: hidden;
          }
          svg {
            display: block;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `);

  const rootDir = process.cwd();

  // 1. Generate public/logo.png (512x512)
  const logoPath = path.join(rootDir, 'public', 'logo.png');
  await page.locator('svg').screenshot({ path: logoPath, omitBackground: true });
  console.log('Generated public/logo.png');

  // Helper to generate resized launcher icons
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

    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              width: ${size}px;
              height: ${size}px;
              overflow: hidden;
            }
            svg {
              display: block;
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `);

    const iconPath = path.join(dir, 'ic_launcher.png');
    const iconRoundPath = path.join(dir, 'ic_launcher_round.png');
    const iconFgPath = path.join(dir, 'ic_launcher_foreground.png');

    await page.locator('svg').screenshot({ path: iconPath, omitBackground: true });
    await page.locator('svg').screenshot({ path: iconRoundPath, omitBackground: true });
    await page.locator('svg').screenshot({ path: iconFgPath, omitBackground: true });

    console.log(`Generated transparent PNG icons for mipmap-${name} (${size}x${size})`);
  }

  await browser.close();
  console.log('All FL monogram icons generated successfully!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
