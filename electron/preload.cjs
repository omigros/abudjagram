'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Exposed under a fork-specific name: upstream treats `window.electron` as a legacy Tauri build
contextBridge.exposeInMainWorld('abudjagram', {
  getCapabilities: () => ipcRenderer.invoke('window:get-capabilities'),
  setBackgroundMaterial: (material) => ipcRenderer.send('window:set-background-material', material),
  setTheme: (theme) => ipcRenderer.send('window:set-theme', theme),
});
