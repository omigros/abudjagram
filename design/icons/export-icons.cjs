// Exports the icons the desktop app ships with: the built-in app icon, the tray icon choices and the app icon
// choices (.ico for shortcuts, PNG for the window).
// Run with Electron, which renders the SVGs: npx electron design/icons/export-icons.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const { BRAND_VARIANTS, buildBrandSvg, buildPlaneSvg, PLANE_VARIANTS } = require('./generate.cjs');

const ELECTRON_DIR = path.join(__dirname, '..', '..', 'electron');
const TRAY_DIR = path.join(ELECTRON_DIR, 'tray-icons');
const APP_ICONS_DIR = path.join(ELECTRON_DIR, 'app-icons');
const APP_ICON_VARIANT = 'A';
const APP_ICON_SIZE = 512;
// Twice the 16 px tray size, so the icon stays sharp on high-DPI screens
const TRAY_ICON_SIZE = 64;
const WINDOW_ICON_SIZE = 256;
// Sizes Windows picks from for shortcuts, Explorer views and the taskbar
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

app.disableHardwareAcceleration();
// Each icon renders in its own window; closing one must not end the app before the next opens
app.on('window-all-closed', () => undefined);
app.whenReady().then(async () => {
  fs.mkdirSync(TRAY_DIR, { recursive: true });
  fs.mkdirSync(APP_ICONS_DIR, { recursive: true });
  const brandSvgs = Object.fromEntries(BRAND_VARIANTS.map((variant) => [variant.id, buildBrandSvg(variant)]));

  fs.writeFileSync(path.join(ELECTRON_DIR, 'icon.png'), (await renderSvg(brandSvgs[APP_ICON_VARIANT], APP_ICON_SIZE)).toPNG());

  const icons = [
    ...BRAND_VARIANTS.map((variant) => ({
      id: `girl-${variant.id}`, name: `Девушка ${variant.id}`, svg: brandSvgs[variant.id],
    })),
    ...PLANE_VARIANTS.map((variant) => ({ id: `plane-${variant.id}`, name: variant.name, svg: buildPlaneSvg(variant) })),
  ];
  for (const icon of icons) {
    fs.writeFileSync(path.join(TRAY_DIR, `${icon.id}.png`), (await renderSvg(icon.svg, TRAY_ICON_SIZE)).toPNG());
    fs.writeFileSync(path.join(APP_ICONS_DIR, `${icon.id}.png`), (await renderSvg(icon.svg, WINDOW_ICON_SIZE)).toPNG());

    const icoImages = [];
    for (const size of ICO_SIZES) icoImages.push({ size, image: await renderSvg(icon.svg, size) });
    fs.writeFileSync(path.join(APP_ICONS_DIR, `${icon.id}.ico`), buildIco(icoImages));
  }

  const index = `${JSON.stringify(icons.map(({ id, name }) => ({ id, name })), undefined, 2)}\n`;
  fs.writeFileSync(path.join(TRAY_DIR, 'index.json'), index);
  fs.writeFileSync(path.join(APP_ICONS_DIR, 'index.json'), index);

  console.log(`App icon, ${icons.length} tray icons and ${icons.length} app icons exported`);
  app.quit();
});

async function renderSvg(svg, size) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true },
  });
  await win.loadURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  win.destroy();
  return image.resize({ width: size, height: size });
}

// ICO container: the 256 px image as PNG, smaller ones as 32-bit bitmaps, which every Windows API can read
function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const payloads = images.map(({ size, image }) => (size >= 256 ? image.toPNG() : buildIcoBitmap(size, image.toBitmap())));
  let offset = headerSize + entrySize * images.length;
  const entries = images.map(({ size }, i) => {
    const entry = Buffer.alloc(entrySize);
    // A 256 px image is written as 0 in the one-byte size fields
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(payloads[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += payloads[i].length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...payloads]);
}

// BITMAPINFOHEADER + bottom-up BGRA pixels + an empty AND mask (transparency comes from the alpha channel)
function buildIcoBitmap(size, bgra) {
  const infoHeader = Buffer.alloc(40);
  infoHeader.writeUInt32LE(40, 0);
  infoHeader.writeInt32LE(size, 4);
  // The height covers both the color image and the mask
  infoHeader.writeInt32LE(size * 2, 8);
  infoHeader.writeUInt16LE(1, 12);
  infoHeader.writeUInt16LE(32, 14);

  const rowBytes = size * 4;
  const pixels = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) bgra.copy(pixels, (size - 1 - y) * rowBytes, y * rowBytes, (y + 1) * rowBytes);

  const maskRowBytes = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * size);
  return Buffer.concat([infoHeader, pixels, mask]);
}
