// Exports the app icon and the tray icon choices as PNG files the desktop app ships with.
// Run with Electron, which renders the SVGs: npx electron design/icons/export-icons.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const { BRAND_VARIANTS, buildBrandSvg, buildPlaneSvg, PLANE_VARIANTS } = require('./generate.cjs');

const ELECTRON_DIR = path.join(__dirname, '..', '..', 'electron');
const TRAY_DIR = path.join(ELECTRON_DIR, 'tray-icons');
const APP_ICON_VARIANT = 'A';
const APP_ICON_SIZE = 512;
// Twice the 16 px tray size, so the icon stays sharp on high-DPI screens
const TRAY_ICON_SIZE = 64;

app.disableHardwareAcceleration();
// Each icon renders in its own window; closing one must not end the app before the next opens
app.on('window-all-closed', () => undefined);
app.whenReady().then(async () => {
  fs.mkdirSync(TRAY_DIR, { recursive: true });
  const brandSvgs = Object.fromEntries(BRAND_VARIANTS.map((variant) => [variant.id, buildBrandSvg(variant)]));

  await renderSvg(brandSvgs[APP_ICON_VARIANT], APP_ICON_SIZE, path.join(ELECTRON_DIR, 'icon.png'));

  const trayIcons = [
    ...BRAND_VARIANTS.map((variant) => ({ id: `girl-${variant.id}`, name: `Девушка ${variant.id}`, svg: brandSvgs[variant.id] })),
    ...PLANE_VARIANTS.map((variant) => ({ id: `plane-${variant.id}`, name: variant.name, svg: buildPlaneSvg(variant) })),
  ];
  for (const icon of trayIcons) {
    await renderSvg(icon.svg, TRAY_ICON_SIZE, path.join(TRAY_DIR, `${icon.id}.png`));
  }
  fs.writeFileSync(path.join(TRAY_DIR, 'index.json'),
    `${JSON.stringify(trayIcons.map(({ id, name }) => ({ id, name })), undefined, 2)}\n`);

  console.log(`App icon and ${trayIcons.length} tray icons exported`);
  app.quit();
});

async function renderSvg(svg, size, output) {

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
  fs.writeFileSync(output, image.resize({ width: size, height: size }).toPNG());
  win.destroy();
}
