'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const TITLE_BAR_ARG_PREFIX = '--abj-title-bar-height=';

const titleBarArg = process.argv.find((arg) => arg.startsWith(TITLE_BAR_ARG_PREFIX));

// Exposed under a fork-specific name: upstream treats `window.electron` as a legacy Tauri build
contextBridge.exposeInMainWorld('abudjagram', {
  titleBarHeight: titleBarArg ? Number(titleBarArg.slice(TITLE_BAR_ARG_PREFIX.length)) : 0,
  getCapabilities: () => ipcRenderer.invoke('window:get-capabilities'),
  setBackgroundMaterial: (material) => ipcRenderer.send('window:set-background-material', material),
  setTheme: (theme) => ipcRenderer.send('window:set-theme', theme),
  setBadge: (count, imageDataUrl) => ipcRenderer.send('app:set-badge', count, imageDataUrl),
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (isEnabled) => ipcRenderer.send('app:set-auto-launch', isEnabled),
});
