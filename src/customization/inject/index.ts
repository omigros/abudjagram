// Entry of the bundle the desktop app injects into the official Telegram Web (web mode)
import { updateElectronBadge } from '../appBadge';
import { initCustomization } from '../applyCustomization';
import { ELECTRON_BRIDGE } from '../electronBridge';
import { initPanel } from './panel';

const INJECTED_FLAG = '__abudjagramInjected';

const pageGlobals = window as unknown as Record<string, unknown>;

if (ELECTRON_BRIDGE && !pageGlobals[INJECTED_FLAG]) {
  pageGlobals[INJECTED_FLAG] = true;

  initCustomization();
  hookAppBadge(ELECTRON_BRIDGE);
  initPanel(ELECTRON_BRIDGE);
}

// Telegram Web reports unread counts through the Badging API, which Windows lacks in Electron
function hookAppBadge(bridge: NonNullable<typeof ELECTRON_BRIDGE>) {
  navigator.setAppBadge = (count?: number) => {
    updateElectronBadge(bridge, count || 0);
    return Promise.resolve();
  };
  navigator.clearAppBadge = () => {
    updateElectronBadge(bridge, 0);
    return Promise.resolve();
  };
}
