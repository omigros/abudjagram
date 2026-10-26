'use strict';

const {
  app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, net, protocol, screen, shell, Tray,
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
const ICON_PATH = path.join(__dirname, 'icon.png');
const DEV_URL = process.env.ABUDJAGRAM_DEV_URL;
// A named profile gets its own data folder, so it runs alongside the default one (e.g. a second account)
const PROFILE = process.env.ABUDJAGRAM_PROFILE;

if (PROFILE) {
  app.setPath('userData', path.join(app.getPath('appData'), `${APP_NAME}-${PROFILE.replace(/[^\w-]/g, '')}`));
}

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const WINDOW_CONFIG_FILE = path.join(app.getPath('userData'), 'window-config.json');
const DEFAULT_WINDOW_STATE = { width: 1280, height: 820 };
const MIN_WIDTH = 380;
const MIN_HEIGHT = 500;
const TITLE_BAR_HEIGHT = 32;
const TRAY_ICON_SIZE = 16;
const HIDDEN_LAUNCH_ARG = '--hidden';
const TRANSPARENT_WINDOW_ARG = '--abj-transparent-window';
const WINDOWS_11_FIRST_BUILD = 22000;
const BACKGROUND_MATERIALS = new Set(['none', 'mica', 'acrylic', 'tabbed']);
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Native materials (Mica / Acrylic) are only drawn by DWM on Windows 11
const CAN_USE_BACKGROUND_MATERIAL = process.platform === 'win32'
  && Number(os.release().split('.')[2]) >= WINDOWS_11_FIRST_BUILD;
// macOS keeps its own traffic lights; elsewhere the page draws the title bar under native window controls
const HAS_CUSTOM_TITLE_BAR = process.platform !== 'darwin';

let mainWindow;
let tray;
let isQuitting = false;
let badgeCount = 0;
// Transparent windows can't be maximized natively on Windows, so the bounds before maximizing are kept here
let boundsBeforeMaximize;
const TRANSPARENT_WINDOWS = new WeakSet();

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.abudjagram.desktop');

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
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppRequest);
    registerIpcHandlers();
    createMainWindow();
    createTray();

    app.on('activate', showMainWindow);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

function createMainWindow() {
  const windowState = readWindowState();
  const isLaunchedHidden = process.argv.includes(HIDDEN_LAUNCH_ARG);
  // Transparency can only be chosen when a window is created, so switching it needs a relaunch
  const isTransparent = HAS_CUSTOM_TITLE_BAR && readWindowConfig().isTransparent;
  const additionalArguments = [`--abj-title-bar-height=${HAS_CUSTOM_TITLE_BAR ? TITLE_BAR_HEIGHT : 0}`];
  if (isTransparent) additionalArguments.push(TRANSPARENT_WINDOW_ARG);

  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    icon: ICON_PATH,
    show: false,
    autoHideMenuBar: true,
    ...(isTransparent ? {
      transparent: true,
      frame: false,
    } : HAS_CUSTOM_TITLE_BAR && {
      titleBarStyle: 'hidden',
      titleBarOverlay: buildTitleBarOverlay(),
    }),
    // Transparent backing lets a native material or the desktop show through once the page clears its background
    backgroundColor: CAN_USE_BACKGROUND_MATERIAL || isTransparent ? '#00000000' : getThemeBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      additionalArguments,
    },
  });

  if (isTransparent) TRANSPARENT_WINDOWS.add(mainWindow);
  if (windowState.isMaximized && !isTransparent) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    if (!isLaunchedHidden) mainWindow.show();
  });
  mainWindow.on('focus', () => mainWindow.flashFrame(false));
  // Closing the window keeps the app running in the tray, like other desktop messengers
  mainWindow.on('close', (e) => {
    writeWindowState(mainWindow);
    if (isQuitting || !tray) return;

    e.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  mainWindow.on('page-title-updated', (e, title) => {
    e.preventDefault();
    mainWindow.setTitle(title.replace(/Telegram( Beta)?/, APP_NAME));
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

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH).resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE }));
  tray.setToolTip(APP_NAME);
  tray.on('click', showMainWindow);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  tray.setToolTip(badgeCount ? `${APP_NAME} — ${badgeCount}` : APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть Abudjagram', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Запускать вместе с Windows',
      type: 'checkbox',
      checked: getIsAutoLaunchEnabled(),
      click: (item) => setIsAutoLaunchEnabled(item.checked),
    },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() },
  ]));
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
    if (!win) return;

    if (isTransparentWindow(win)) return;

    if (!CAN_USE_BACKGROUND_MATERIAL) win.setBackgroundColor(getThemeBackgroundColor());
    if (HAS_CUSTOM_TITLE_BAR) win.setTitleBarOverlay(buildTitleBarOverlay());
  });

  ipcMain.on('window:set-transparent', (e, isEnabled) => {
    writeWindowConfig({ ...readWindowConfig(), isTransparent: Boolean(isEnabled) });
  });

  ipcMain.on('app:relaunch', () => {
    isQuitting = true;
    app.relaunch();
    app.quit();
  });

  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.on('window:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) toggleMaximize(win);
  });

  ipcMain.on('app:set-badge', (e, count, imageDataUrl) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || !Number.isInteger(count) || count < 0) return;

    if (count > badgeCount && !win.isFocused()) win.flashFrame(true);
    badgeCount = count;

    if (process.platform === 'win32') {
      const image = count && typeof imageDataUrl === 'string' ? nativeImage.createFromDataURL(imageDataUrl) : undefined;
      // eslint-disable-next-line no-null/no-null
      win.setOverlayIcon(image || null, count ? `${count}` : '');
    } else {
      app.setBadgeCount(count);
    }

    updateTrayMenu();
  });

  ipcMain.handle('app:get-auto-launch', getIsAutoLaunchEnabled);
  ipcMain.on('app:set-auto-launch', (e, isEnabled) => {
    setIsAutoLaunchEnabled(Boolean(isEnabled));
  });
}

function getIsAutoLaunchEnabled() {
  return app.getLoginItemSettings({ args: [HIDDEN_LAUNCH_ARG] }).openAtLogin;
}

function setIsAutoLaunchEnabled(isEnabled) {
  app.setLoginItemSettings({ openAtLogin: isEnabled, args: [HIDDEN_LAUNCH_ARG] });
  updateTrayMenu();
}

function toggleMaximize(win) {
  if (!isTransparentWindow(win)) {
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return;
  }

  if (boundsBeforeMaximize) {
    win.setBounds(boundsBeforeMaximize);
    boundsBeforeMaximize = undefined;
    return;
  }

  boundsBeforeMaximize = win.getBounds();
  win.setBounds(screen.getDisplayMatching(boundsBeforeMaximize).workArea);
}

function isTransparentWindow(win) {
  return TRANSPARENT_WINDOWS.has(win);
}

function readWindowConfig() {
  try {
    return JSON.parse(fs.readFileSync(WINDOW_CONFIG_FILE, 'utf8'));
  } catch (err) {
    return {};
  }
}

function writeWindowConfig(config) {
  try {
    fs.writeFileSync(WINDOW_CONFIG_FILE, JSON.stringify(config));
  } catch (err) {
    // Without the config the window keeps its current mode
  }
}

function buildTitleBarOverlay() {
  return {
    color: '#00000000',
    symbolColor: nativeTheme.shouldUseDarkColors ? '#FFFFFF' : '#000000',
    height: TITLE_BAR_HEIGHT,
  };
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
