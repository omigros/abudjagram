export type BackgroundMaterial = 'none' | 'mica' | 'acrylic';

export type ElectronBridge = {
  titleBarHeight: number;
  getCapabilities: () => Promise<{ platform: string; canUseBackgroundMaterial: boolean }>;
  setBackgroundMaterial: (material: BackgroundMaterial) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setBadge: (count: number, imageDataUrl?: string) => void;
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (isEnabled: boolean) => void;
};

export const ELECTRON_BRIDGE = (window as { abudjagram?: ElectronBridge }).abudjagram;

// Height of the custom title bar drawn above the page; the page itself is shifted down by it
export const TITLE_BAR_HEIGHT = ELECTRON_BRIDGE?.titleBarHeight || 0;
