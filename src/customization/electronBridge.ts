export type BackgroundMaterial = 'none' | 'mica' | 'acrylic';
// `web` loads the official Telegram Web and injects the customization; `local` runs this fork's own build
export type AppMode = 'web' | 'local';

export type TrayIcon = {
  id: string;
  name: string;
  dataUrl: string;
  isSelected: boolean;
};

export type ElectronBridge = {
  titleBarHeight: number;
  isTransparentWindow: boolean;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  getCapabilities: () => Promise<{ platform: string; canUseBackgroundMaterial: boolean }>;
  setBackgroundMaterial: (material: BackgroundMaterial) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setBadge: (count: number, imageDataUrl?: string) => void;
  getAutoLaunch: () => Promise<boolean>;
  getTrayIcons: () => Promise<TrayIcon[]>;
  setTrayIcon: (id: string) => void;
  setAutoLaunch: (isEnabled: boolean) => void;
  setTransparentWindow: (isEnabled: boolean) => void;
  relaunch: () => void;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
};

export const ELECTRON_BRIDGE = (window as { abudjagram?: ElectronBridge }).abudjagram;

// Height of the custom title bar drawn above the page; the page itself is shifted down by it
export const TITLE_BAR_HEIGHT = ELECTRON_BRIDGE?.titleBarHeight || 0;

// A transparent window has no native frame, so the page draws its own window controls
export const IS_TRANSPARENT_WINDOW = Boolean(ELECTRON_BRIDGE?.isTransparentWindow);
