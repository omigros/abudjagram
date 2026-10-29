'use strict';

const {
  app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, net, protocol, screen, session, shell, Tray,
} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { resolveUserDataPath } = require('./userData.cjs');

const APP_NAME = 'Abudjagram';
const APP_SCHEME = 'app';
const APP_HOST = 'abudjagram';
const APP_URL = `${APP_SCHEME}://${APP_HOST}/`;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, 'icon.png');
const TRAY_ICONS_DIR = path.join(__dirname, 'tray-icons');
const DEFAULT_TRAY_ICON = 'girl-A';
const APP_ICONS_DIR = path.join(__dirname, 'app-icons');
// The icon built into the executable; choosing it puts shortcuts back on the executable's own icon
const DEFAULT_APP_ICON = 'girl-A';
const SHORTCUT_UPDATE_DELAY_MS = 3000;
const DEV_URL = process.env.ABUDJAGRAM_DEV_URL;
const WEB_URL = 'https://web.telegram.org/a/';
const WEB_HOST = 'web.telegram.org';
const WEB_ENTRY_PATHS = new Set(['/a/', '/a/index.html']);
const INJECT_DIR = path.join(__dirname, 'inject');
// Directives relaxed in Telegram Web's CSP, so custom fonts, images and videos from the internet load
const RELAXED_CSP_DIRECTIVES = ['style-src', 'font-src', 'img-src', 'media-src'];
// A named profile gets its own data folder, so it runs alongside the default one (e.g. a second account)
const PROFILE = process.env.ABUDJAGRAM_PROFILE;

app.setPath('userData', resolveUserDataPath({
  appData: app.getPath('appData'), isPackaged: app.isPackaged, profile: PROFILE,
}));

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const WINDOW_CONFIG_FILE = path.join(app.getPath('userData'), 'window-config.json');
const DEFAULT_WINDOW_STATE = { width: 1280, height: 820 };
const MIN_WIDTH = 380;
const MIN_HEIGHT = 500;
const TITLE_BAR_HEIGHT = 32;
const TRAY_ICON_SIZE = 16;
const HIDDEN_LAUNCH_ARG = '--hidden';
const TRANSPARENT_WINDOW_ARG = '--abj-transparent-window';
const APP_MODE_ARG_PREFIX = '--abj-app-mode=';
// After these, Chromium keeps stale draggable regions until the page layout changes
const DRAG_REGION_RESET_EVENTS = ['leave-full-screen', 'leave-html-full-screen', 'unmaximize', 'restore'];
const DRAG_REGION_RESET_DELAY_MS = 150;
const DRAG_REGION_REFRESH_SCRIPT = "(() => { const root = document.documentElement; root.classList.add('abj-drag-refresh'); "
  + "setTimeout(() => root.classList.remove('abj-drag-refresh'), 50); })()";
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
let isWebModeWindow = false;

app.setName(APP_NAME);
// A separate audio process costs memory for the few sounds Telegram plays
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');
// GPU acceleration holds the most memory after the page itself; without it the CPU draws, which is slower
if (readWindowConfig().isMemorySaver) app.disableHardwareAcceleration();
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
    if (getAppMode() === 'web') protocol.handle('https', handleWebRequest);
    registerIpcHandlers();
    createMainWindow();
    createTray();
    // The installer recreates shortcuts with the built-in icon, so a custom choice is applied again on start
    if (getAppIconId() !== DEFAULT_APP_ICON) {
      setTimeout(() => updateShortcutIcons(getAppIconId()), SHORTCUT_UPDATE_DELAY_MS);
    }

    app.on('activate', showMainWindow);
  });

  app.on('before-quit', () => {
    isQuitting = true;
    flushSessionData();
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
  const appMode = getAppMode();
  additionalArguments.push(`${APP_MODE_ARG_PREFIX}${appMode}`);

  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_NAME,
    icon: getWindowIcon(getAppIconId()),
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

  if (isTransparent) {
    TRANSPARENT_WINDOWS.add(mainWindow);
    // A native maximize (title bar double-click, Win+Up) leaves a transparent window stuck and immovable,
    // so it is replaced with the same bounds-based maximize the window controls use
    mainWindow.on('maximize', () => {
      const normalBounds = mainWindow.getNormalBounds();
      // Unmaximizing inside the event itself is ignored by Windows
      setTimeout(() => {
        mainWindow.unmaximize();
        // A second double-click on an already maximized window restores it
        if (boundsBeforeMaximize) {
          toggleMaximize(mainWindow);
        } else {
          maximizeToWorkArea(mainWindow, normalBounds);
        }
      });
    });
  }
  if (windowState.isMaximized && !isTransparent) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    if (!isLaunchedHidden) mainWindow.show();
  });
  mainWindow.on('focus', () => mainWindow.flashFrame(false));
  // Windows logs off or shuts down without a regular quit
  mainWindow.on('session-end', flushSessionData);
  DRAG_REGION_RESET_EVENTS.forEach((eventName) => {
    mainWindow.on(eventName, () => refreshDragRegions(mainWindow));
  });
  // Closing the window keeps the app running in the tray, like other desktop messengers
  mainWindow.on('close', (e) => {
    writeWindowState(mainWindow);
    if (isQuitting || !tray) return;

    e.preventDefault();
    mainWindow.hide();
    flushSessionData();
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

  if (appMode === 'web') {
    // Every load of Telegram Web gets the customization layer again
    // The preload asks for it on every load of the page (see `app:request-customization`)
    isWebModeWindow = true;
  }

  mainWindow.loadURL(DEV_URL || (appMode === 'web' ? WEB_URL : APP_URL));
}

function flushSessionData() {
  // Chromium writes storage lazily; a forced end (shutdown, crash) could otherwise drop the Telegram session
  session.defaultSession.flushStorageData();
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
  tray = new Tray(buildTrayImage(getTrayIconId()));
  tray.setToolTip(APP_NAME);
  tray.on('click', showMainWindow);
  updateTrayMenu();
}

function getTrayIcons() {
  return getIconList(TRAY_ICONS_DIR);
}

function getIconList(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  } catch (err) {
    return [];
  }
}

function getAppIconId() {
  const id = readWindowConfig().appIcon;
  return getIconList(APP_ICONS_DIR).some((icon) => icon.id === id) ? id : DEFAULT_APP_ICON;
}

function getWindowIcon(id) {
  const image = nativeImage.createFromPath(path.join(APP_ICONS_DIR, `${id}.png`));
  return image.isEmpty() ? ICON_PATH : image;
}

// Shortcuts show the icon they point at. Windows can't read icons from inside the app archive, so the chosen
// one is copied to the data folder under its own name (a fresh path also skips the shell's icon cache).
function updateShortcutIcons(id) {
  if (process.platform !== 'win32' || !app.isPackaged) return;

  let icon = process.execPath;
  if (id !== DEFAULT_APP_ICON) {
    icon = path.join(app.getPath('userData'), `app-icon-${id}.ico`);
    try {
      fs.copyFileSync(path.join(APP_ICONS_DIR, `${id}.ico`), icon);
    } catch (err) {
      return;
    }
  }

  const appData = app.getPath('appData');
  const shortcutDirs = [
    app.getPath('desktop'),
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'),
  ];
  shortcutDirs.forEach((dir) => {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.lnk'));
    } catch (err) {
      return;
    }

    files.forEach((file) => {
      const shortcutPath = path.join(dir, file);
      try {
        const { target } = shell.readShortcutLink(shortcutPath);
        if (path.resolve(target).toLowerCase() !== process.execPath.toLowerCase()) return;
        shell.writeShortcutLink(shortcutPath, 'update', { icon, iconIndex: 0 });
      } catch (err) {
        // Shortcuts that can't be read belong to other programs or are broken; they are left alone
      }
    });
  });

  // Icons of earlier choices are no longer used by any shortcut
  try {
    fs.readdirSync(app.getPath('userData'))
      .filter((file) => /^app-icon-.+\.ico$/.test(file) && file !== path.basename(icon))
      .forEach((file) => fs.rmSync(path.join(app.getPath('userData'), file), { force: true }));
  } catch (err) {
    // Leftover icon files are harmless
  }
}

function getTrayIconId() {
  const id = readWindowConfig().trayIcon;
  return getTrayIcons().some((icon) => icon.id === id) ? id : DEFAULT_TRAY_ICON;
}

// The tray draws 16 px icons; a 32 px representation keeps them sharp on scaled displays
function buildTrayImage(id) {
  const source = nativeImage.createFromPath(path.join(TRAY_ICONS_DIR, `${id}.png`));
  if (source.isEmpty()) {
    return nativeImage.createFromPath(ICON_PATH).resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  }

  const image = source.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE, quality: 'best' });
  image.addRepresentation({
    scaleFactor: 2,
    buffer: source.resize({ width: TRAY_ICON_SIZE * 2, height: TRAY_ICON_SIZE * 2, quality: 'best' }).toPNG(),
  });
  return image;
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

  ipcMain.on('app:request-customization', (e) => {
    if (isWebModeWindow && e.sender.getURL().startsWith(WEB_URL)) injectCustomization(e.sender);
  });

  ipcMain.handle('app:get-memory-saver', () => Boolean(readWindowConfig().isMemorySaver));
  ipcMain.on('app:set-memory-saver', (e, isEnabled) => {
    writeWindowConfig({ ...readWindowConfig(), isMemorySaver: Boolean(isEnabled) });
  });

  ipcMain.on('app:set-mode', (e, mode) => {
    if (mode !== 'web' && mode !== 'local') return;
    writeWindowConfig({ ...readWindowConfig(), mode });
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

  ipcMain.handle('app:get-tray-icons', () => {
    const selectedId = getTrayIconId();
    return getTrayIcons().map(({ id, name }) => ({
      id,
      name,
      isSelected: id === selectedId,
      dataUrl: nativeImage.createFromPath(path.join(TRAY_ICONS_DIR, `${id}.png`)).toDataURL(),
    }));
  });

  ipcMain.handle('app:get-app-icons', () => {
    const selectedId = getAppIconId();
    return getIconList(APP_ICONS_DIR).map(({ id, name }) => ({
      id,
      name,
      isSelected: id === selectedId,
      dataUrl: nativeImage.createFromPath(path.join(TRAY_ICONS_DIR, `${id}.png`)).toDataURL(),
    }));
  });

  ipcMain.on('app:set-app-icon', (e, id) => {
    if (!getIconList(APP_ICONS_DIR).some((icon) => icon.id === id)) return;

    writeWindowConfig({ ...readWindowConfig(), appIcon: id });
    mainWindow?.setIcon(getWindowIcon(id));
    updateShortcutIcons(id);
  });

  ipcMain.on('app:set-tray-icon', (e, id) => {
    if (!getTrayIcons().some((icon) => icon.id === id)) return;

    writeWindowConfig({ ...readWindowConfig(), trayIcon: id });
    tray?.setImage(buildTrayImage(id));
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

// Toggling the title bar's `app-region` makes the page report its draggable regions to the window again
function refreshDragRegions(win) {
  setTimeout(() => {
    if (win.isDestroyed()) return;
    win.webContents.executeJavaScript(DRAG_REGION_REFRESH_SCRIPT).catch(() => undefined);
  }, DRAG_REGION_RESET_DELAY_MS);
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

  maximizeToWorkArea(win, win.getBounds());
}

function maximizeToWorkArea(win, normalBounds) {
  boundsBeforeMaximize = normalBounds;
  win.setBounds(screen.getDisplayMatching(normalBounds).workArea);
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

// `web` runs the official Telegram Web with the injected customization and needs no API keys;
// `local` runs this fork's own build, which asks for keys from my.telegram.org
function getAppMode() {
  if (DEV_URL) return 'local';
  return readWindowConfig().mode === 'local' ? 'local' : 'web';
}

function injectCustomization(webContents) {
  try {
    const css = readInjectFile('abudjagram-inject.css');
    const js = readInjectFile('abudjagram-inject.js');
    webContents.insertCSS(css).catch(logInjectError);
    webContents.executeJavaScript(js).catch(logInjectError);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to inject the customization layer', err);
  }
}

function readInjectFile(name) {
  return fs.readFileSync(path.join(INJECT_DIR, name), 'utf8');
}

function logInjectError(err) {
  // eslint-disable-next-line no-console
  console.error('Failed to inject the customization layer', err);
}

// Telegram Web sets its CSP in a meta tag, so the entry page is rewritten on the way in
async function handleWebRequest(request) {
  const url = new URL(request.url);
  const response = await net.fetch(request, { bypassCustomProtocolHandlers: true });
  if (url.host !== WEB_HOST || request.method !== 'GET' || !WEB_ENTRY_PATHS.has(url.pathname)) return response;

  const html = await response.text();
  const relaxedHtml = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/,
    (match, start, policy, end) => `${start}${relaxCsp(policy)}${end}`);
  return new Response(relaxedHtml, { status: response.status, headers: response.headers });
}

function relaxCsp(policy) {
  return policy.split(';').map((directive) => {
    const name = directive.trim().split(/\s+/)[0];
    return RELAXED_CSP_DIRECTIVES.includes(name) ? `${directive} https:` : directive;
  }).join(';');
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
  return url.startsWith(APP_URL) || url.startsWith(WEB_URL) || Boolean(DEV_URL && url.startsWith(DEV_URL));
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
