'use strict';

const {
  app, BrowserWindow, ipcMain, nativeTheme, net, protocol, shell,
} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_NAME = 'Abudjagram';
const APP_SCHEME = 'app';
const APP_HOST = 'abudjagram';
const APP_URL = `${APP_SCHEME}://${APP_HOST}/`;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const DEV_URL = process.env.ABUDJAGRAM_DEV_URL;
// A named profile gets its own data folder, so it runs alongside the default one (e.g. a second account)
const PROFILE = process.env.ABUDJAGRAM_PROFILE;

if (PROFILE) {
  app.setPath('userData', path.join(app.getPath('appData'), `${APP_NAME}-${PROFILE.replace(/[^\w-]/g, '')}`));
}

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_WINDOW_STATE = { width: 1280, height: 820 };
const MIN_WIDTH = 380;
const MIN_HEIGHT = 500;
const WINDOWS_11_FIRST_BUILD = 22000;
const BACKGROUND_MATERIALS = new Set(['none', 'mica', 'acrylic', 'tabbed']);
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Native materials (Mica / Acrylic) are only drawn by DWM on Windows 11
const CAN_USE_BACKGROUND_MATERIAL = process.platform === 'win32'
  && Number(os.release().split('.')[2]) >= WINDOWS_11_FIRST_BUILD;

let mainWindow;

app.setName(APP_NAME);

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    allowServiceWorkers: true,
    corsEnabled: true,
    stream: true,
    codeCache: true,
  },
}]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppRequest);
    registerIpcHandlers();
    createMainWindow();

    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

function createMainWindow() {
  const windowState = readWindowState();

  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    // Transparent backing lets a native material show through once the page clears its background
    backgroundColor: CAN_USE_BACKGROUND_MATERIAL ? '#00000000' : getThemeBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (windowState.isMaximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => writeWindowState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  mainWindow.on('page-title-updated', (e, title) => {
    e.preventDefault();
    mainWindow.setTitle(title.replace(/^Telegram( Beta)?/, APP_NAME));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    openExternalUrl(url);
  });

  mainWindow.loadURL(DEV_URL || APP_URL);
}

function registerIpcHandlers() {
  ipcMain.handle('window:get-capabilities', () => ({
    platform: process.platform,
    canUseBackgroundMaterial: CAN_USE_BACKGROUND_MATERIAL,
  }));

  ipcMain.on('window:set-background-material', (e, material) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || !CAN_USE_BACKGROUND_MATERIAL || !BACKGROUND_MATERIALS.has(material)) return;

    win.setBackgroundMaterial(material);
  });

  ipcMain.on('window:set-theme', (e, theme) => {
    if (theme !== 'dark' && theme !== 'light') return;

    nativeTheme.themeSource = theme;
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !CAN_USE_BACKGROUND_MATERIAL) win.setBackgroundColor(getThemeBackgroundColor());
  });
}

function handleAppRequest(request) {
  const { pathname } = new URL(request.url);
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(DIST_DIR, relativePath);

  if (!filePath.startsWith(DIST_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Unknown routes fall back to the SPA entry
  const targetPath = fs.existsSync(filePath) ? filePath : path.join(DIST_DIR, 'index.html');
  return net.fetch(pathToFileURL(targetPath).toString());
}

function isAppUrl(url) {
  return url.startsWith(APP_URL) || Boolean(DEV_URL && url.startsWith(DEV_URL));
}

function openExternalUrl(url) {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) shell.openExternal(url);
  } catch (err) {
    // Malformed URLs are ignored
  }
}

function getThemeBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#212121' : '#ffffff';
}

function readWindowState() {
  try {
    return { ...DEFAULT_WINDOW_STATE, ...JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf8')) };
  } catch (err) {
    return DEFAULT_WINDOW_STATE;
  }
}

function writeWindowState(win) {
  const bounds = win.getNormalBounds();
  try {
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify({ ...bounds, isMaximized: win.isMaximized() }));
  } catch (err) {
    // Window state is a convenience; failing to save it is not fatal
  }
}
