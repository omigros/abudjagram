'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const TITLE_BAR_ARG_PREFIX = '--abj-title-bar-height=';
const TRANSPARENT_ARG = '--abj-transparent-window';
const APP_MODE_ARG_PREFIX = '--abj-app-mode=';

const titleBarArg = process.argv.find((arg) => arg.startsWith(TITLE_BAR_ARG_PREFIX));
const appModeArg = process.argv.find((arg) => arg.startsWith(APP_MODE_ARG_PREFIX));

// Exposed under a fork-specific name: upstream treats `window.electron` as a legacy Tauri build
contextBridge.exposeInMainWorld('abudjagram', {
  titleBarHeight: titleBarArg ? Number(titleBarArg.slice(TITLE_BAR_ARG_PREFIX.length)) : 0,
  isTransparentWindow: process.argv.includes(TRANSPARENT_ARG),
  appMode: appModeArg ? appModeArg.slice(APP_MODE_ARG_PREFIX.length) : 'local',
  setAppMode: (mode) => ipcRenderer.send('app:set-mode', mode),
  getCapabilities: () => ipcRenderer.invoke('window:get-capabilities'),
  setBackgroundMaterial: (material) => ipcRenderer.send('window:set-background-material', material),
  setTheme: (theme) => ipcRenderer.send('window:set-theme', theme),
  setBadge: (count, imageDataUrl) => ipcRenderer.send('app:set-badge', count, imageDataUrl),
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  getTrayIcons: () => ipcRenderer.invoke('app:get-tray-icons'),
  getAppIcons: () => ipcRenderer.invoke('app:get-app-icons'),
  setAppIcon: (id) => ipcRenderer.send('app:set-app-icon', id),
  setTrayIcon: (id) => ipcRenderer.send('app:set-tray-icon', id),
  setAutoLaunch: (isEnabled) => ipcRenderer.send('app:set-auto-launch', isEnabled),
  setTransparentWindow: (isEnabled) => ipcRenderer.send('window:set-transparent', isEnabled),
  relaunch: () => ipcRenderer.send('app:relaunch'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
