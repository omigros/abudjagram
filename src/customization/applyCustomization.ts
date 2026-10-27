import type { ElectronBridge } from './electronBridge';
import type { BackdropKind, CustomizationSettings } from './settings';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { CUSTOMIZATION_IDB_STORE } from '../util/browser/idb';
import buildClassName from '../util/buildClassName';
import { ELECTRON_BRIDGE, IS_TRANSPARENT_WINDOW, TITLE_BAR_HEIGHT } from './electronBridge';
import { buildGradientBackground, shadeColor, toRgbChannels } from './palette';
import { resolveFont } from './presets';
import {
  DEFAULT_BUBBLE_RADIUS, DEFAULT_CUSTOMIZATION, getCustomization, subscribeToCustomization,
} from './settings';

import './customization.scss';

export const BACKDROP_VIDEO_KEY = 'backdrop-video';

const AURORA_BLOB_COUNT = 4;
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2';
const WINDOW_CONTROL_ICON_ATTRS = 'width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"';
const WINDOW_CONTROL_ICONS = {
  minimize: `<svg ${WINDOW_CONTROL_ICON_ATTRS}><path d="M0 5h10"/></svg>`,
  maximize: `<svg ${WINDOW_CONTROL_ICON_ATTRS}><rect x="0.5" y="0.5" width="9" height="9"/></svg>`,
  close: `<svg ${WINDOW_CONTROL_ICON_ATTRS}><path d="M0 0l10 10M10 0L0 10"/></svg>`,
};

let canUseBackgroundMaterial = false;
let backdropElement: HTMLDivElement | undefined;
let videoElement: HTMLVideoElement | undefined;
let videoObjectUrl: string | undefined;
let videoSourceKey: string | undefined;
let customStyleElement: HTMLStyleElement | undefined;
let fontLinkElement: HTMLLinkElement | undefined;

export function initCustomization() {
  if (ELECTRON_BRIDGE) {
    const root = document.documentElement;
    root.classList.add('is-electron');
    if (TITLE_BAR_HEIGHT) {
      root.classList.add('has-custom-title-bar');
      root.style.setProperty('--abj-title-bar-height', `${TITLE_BAR_HEIGHT}px`);
      keepRootUnscrolled();
    }

    if (IS_TRANSPARENT_WINDOW) {
      root.classList.add('is-transparent-window');
      renderWindowControls(ELECTRON_BRIDGE);
    }

    syncNativeTheme(ELECTRON_BRIDGE);
    void ELECTRON_BRIDGE.getCapabilities().then((capabilities) => {
      canUseBackgroundMaterial = capabilities.canUseBackgroundMaterial;
      applyCustomization(getCustomization());
    });
  }

  applyCustomization(getCustomization());
  subscribeToCustomization(applyCustomization);
}

export function getCanUseBackgroundMaterial() {
  return canUseBackgroundMaterial;
}

export async function saveBackdropVideo(file: File) {
  await CUSTOMIZATION_IDB_STORE.set(BACKDROP_VIDEO_KEY, file);
  // A new key forces the backdrop to reload the file even if a file was already set
  videoSourceKey = undefined;
}

export function removeBackdropVideo() {
  return CUSTOMIZATION_IDB_STORE.del(BACKDROP_VIDEO_KEY);
}

function applyCustomization(settings: CustomizationSettings) {
  const backdrop = resolveBackdrop(settings.backdrop);
  const font = resolveFont(settings);
  const root = document.documentElement;

  requestMutation(() => {
    applyPalette(root, settings);
    root.classList.toggle('abj-bubble-radius', settings.bubbleRadius !== DEFAULT_BUBBLE_RADIUS);
    root.classList.toggle('abj-no-bubble-tails', !settings.hasBubbleTails);
    root.classList.toggle('abj-font', Boolean(font));
    root.classList.toggle('abj-ui-scale', settings.uiScale !== DEFAULT_CUSTOMIZATION.uiScale);
    root.style.setProperty('--abj-bubble-radius', `${settings.bubbleRadius}px`);
    root.style.setProperty('--abj-font-family', font?.family || '');
    root.style.setProperty('--abj-ui-scale', String(settings.uiScale / 100));
    updateFontStylesheet(font?.googleFamily);

    root.classList.toggle('abj-glass', settings.isGlassEnabled);
    root.classList.toggle('abj-glass-highlight', settings.isGlassEnabled && settings.hasGlassHighlight);
    root.classList.toggle('abj-glass-bubbles', settings.isGlassEnabled && Boolean(settings.isGlassBubbles));
    root.classList.toggle(
      'abj-custom-motion',
      settings.animationEasing !== 'default' || settings.animationSpeed !== DEFAULT_CUSTOMIZATION.animationSpeed,
    );
    root.dataset.abjBackdrop = backdrop;
    root.dataset.abjAurora = settings.auroraPalette;
    root.dataset.abjEasing = settings.animationEasing;
    root.dataset.abjAppearance = settings.messageAppearance;

    root.style.setProperty('--abj-glass-blur', `${settings.glassBlur}px`);
    root.style.setProperty('--abj-glass-opacity', `${settings.glassOpacity}%`);
    root.style.setProperty('--abj-glass-saturation', `${settings.glassSaturation}%`);
    root.style.setProperty('--abj-backdrop-dim', String(settings.backdropDim / 100));
    root.style.setProperty('--abj-speed', String(settings.animationSpeed));
    root.style.setProperty('--abj-grain', String(settings.grain / 100));
    root.style.setProperty('--abj-transparent-tint', `${settings.transparentTint}%`);

    updateBackdropElement(backdrop, settings);
    updateCustomCss(settings.customCss);
  });

  if (backdrop === 'video') {
    void updateBackdropVideo(settings);
  } else {
    releaseBackdropVideo();
  }

  ELECTRON_BRIDGE?.setBackgroundMaterial(backdrop === 'mica' || backdrop === 'acrylic' ? backdrop : 'none');
}

// Native materials need DWM support and a see-through backdrop needs a transparent window, so both fall back
function resolveBackdrop(backdrop: BackdropKind): BackdropKind {
  if ((backdrop === 'mica' || backdrop === 'acrylic') && !canUseBackgroundMaterial) {
    return 'aurora';
  }

  if (backdrop === 'transparent' && !IS_TRANSPARENT_WINDOW) {
    return 'aurora';
  }

  return backdrop;
}

function applyPalette(root: HTMLElement, settings: CustomizationSettings) {
  const { accentColor, glassTint } = settings;

  root.classList.toggle('abj-accent', Boolean(accentColor));
  root.classList.toggle('abj-own-bubble-tint', Boolean(accentColor && settings.isOwnBubbleTinted));
  if (accentColor) {
    const shade = shadeColor(accentColor);
    root.style.setProperty('--abj-accent', accentColor);
    root.style.setProperty('--abj-accent-shade', shade);
    root.style.setProperty('--abj-accent-shade-rgb', toRgbChannels(shade));
  } else {
    root.style.removeProperty('--abj-accent');
    root.style.removeProperty('--abj-accent-shade');
    root.style.removeProperty('--abj-accent-shade-rgb');
  }

  // Set inline, the custom tint overrides both theme defaults of `--abj-glass-tint`
  if (glassTint) {
    root.style.setProperty('--abj-glass-tint', glassTint);
  } else {
    root.style.removeProperty('--abj-glass-tint');
  }
}

function updateBackdropElement(backdrop: BackdropKind, settings: CustomizationSettings) {
  const shouldRender = backdrop === 'aurora' || backdrop === 'gradient' || backdrop === 'video';
  if (!shouldRender) {
    backdropElement?.remove();
    backdropElement = undefined;
    videoElement = undefined;
    return;
  }

  if (!backdropElement) {
    backdropElement = document.createElement('div');
    backdropElement.className = 'abj-backdrop';
    backdropElement.setAttribute('aria-hidden', 'true');
    // Lives outside `body`, which is offset by the custom title bar, so the backdrop also fills the title bar
    document.documentElement.prepend(backdropElement);
  }

  const isMesh = backdrop === 'aurora' || (backdrop === 'gradient' && settings.gradientKind === 'mesh');
  updateGradientStyle(backdropElement, backdrop, settings);
  backdropElement.classList.toggle('abj-backdrop-static', backdrop === 'gradient' && !settings.isGradientAnimated);

  const kindClassName = `abj-backdrop-${isMesh ? 'mesh' : backdrop}`;
  if (backdropElement.classList.contains(kindClassName)) return;

  const isStatic = backdropElement.classList.contains('abj-backdrop-static');
  backdropElement.className = buildClassName('abj-backdrop', kindClassName, isStatic && 'abj-backdrop-static');
  backdropElement.replaceChildren();
  videoElement = undefined;

  if (isMesh) {
    for (let i = 0; i < AURORA_BLOB_COUNT; i++) {
      const blob = document.createElement('div');
      blob.className = 'abj-aurora-blob';
      backdropElement.append(blob);
    }
  } else if (backdrop === 'video') {
    videoElement = document.createElement('video');
    videoElement.className = 'abj-backdrop-video';
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    backdropElement.append(videoElement);
  }

  const grain = document.createElement('div');
  grain.className = 'abj-backdrop-grain';
  const dim = document.createElement('div');
  dim.className = 'abj-backdrop-dim';
  backdropElement.append(grain, dim);
}

function updateGradientStyle(element: HTMLElement, backdrop: BackdropKind, settings: CustomizationSettings) {
  const isGradient = backdrop === 'gradient';
  const { gradientColors } = settings;

  // Mesh gradients reuse the aurora blobs, so custom colors replace the palette variables
  for (let i = 0; i < AURORA_BLOB_COUNT; i++) {
    const property = `--abj-aurora-${i + 1}`;
    if (isGradient) {
      element.style.setProperty(property, gradientColors[i % gradientColors.length]);
    } else {
      element.style.removeProperty(property);
    }
  }

  if (isGradient) {
    element.style.setProperty('--abj-aurora-base', gradientColors[0]);
    element.style.setProperty('--abj-gradient', buildGradientBackground(settings));
  } else {
    element.style.removeProperty('--abj-aurora-base');
    element.style.removeProperty('--abj-gradient');
  }
}

async function updateBackdropVideo(settings: CustomizationSettings) {
  const sourceKey = settings.hasVideoFile ? `file:${BACKDROP_VIDEO_KEY}` : settings.videoUrl;
  if (sourceKey === videoSourceKey) return;
  videoSourceKey = sourceKey;

  let source = settings.hasVideoFile ? undefined : settings.videoUrl;
  if (settings.hasVideoFile) {
    const file = await CUSTOMIZATION_IDB_STORE.get<Blob>(BACKDROP_VIDEO_KEY);
    releaseVideoObjectUrl();
    videoObjectUrl = file ? URL.createObjectURL(file) : undefined;
    source = videoObjectUrl;
  }

  requestMutation(() => {
    if (!videoElement) return;

    if (source) {
      videoElement.src = source;
      void videoElement.play().catch(() => undefined);
    } else {
      videoElement.removeAttribute('src');
    }
  });
}

function releaseBackdropVideo() {
  videoSourceKey = undefined;
  releaseVideoObjectUrl();
}

function releaseVideoObjectUrl() {
  if (!videoObjectUrl) return;

  URL.revokeObjectURL(videoObjectUrl);
  videoObjectUrl = undefined;
}

function updateFontStylesheet(googleFamily?: string) {
  const href = googleFamily ? `${GOOGLE_FONTS_URL}?family=${googleFamily}&display=swap` : undefined;
  if (fontLinkElement?.getAttribute('href') === href) return;

  fontLinkElement?.remove();
  fontLinkElement = undefined;
  if (!href) return;

  fontLinkElement = document.createElement('link');
  fontLinkElement.rel = 'stylesheet';
  fontLinkElement.href = href;
  document.head.append(fontLinkElement);
}

function updateCustomCss(css: string) {
  if (!css.trim()) {
    customStyleElement?.remove();
    customStyleElement = undefined;
    return;
  }

  if (!customStyleElement) {
    customStyleElement = document.createElement('style');
    customStyleElement.id = 'abj-custom-css';
  }

  customStyleElement.textContent = css;
  // Keeping the element last lets user rules win over app styles of equal specificity
  document.body.append(customStyleElement);
}

// A safety net for engines without `overflow: clip`: the root snaps back whenever something scrolls it
function keepRootUnscrolled() {
  const reset = () => {
    [document.documentElement, document.body].forEach((element) => {
      if (element.scrollTop || element.scrollLeft) {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      }
    });
  };
  window.addEventListener('scroll', reset, { passive: true });
  document.body.addEventListener('scroll', reset, { passive: true });
}

// A frameless transparent window has no native buttons, so they are drawn in the custom title bar
function renderWindowControls(bridge: ElectronBridge) {
  const controls = document.createElement('div');
  controls.className = 'abj-window-controls';

  const buttons: [string, string, () => void][] = [
    ['minimize', WINDOW_CONTROL_ICONS.minimize, bridge.minimizeWindow],
    ['maximize', WINDOW_CONTROL_ICONS.maximize, bridge.toggleMaximizeWindow],
    ['close', WINDOW_CONTROL_ICONS.close, bridge.closeWindow],
  ];

  buttons.forEach(([name, icon, handler]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `abj-window-control abj-window-control-${name}`;
    button.innerHTML = icon;
    button.addEventListener('click', () => handler());
    controls.append(button);
  });

  // Outside `body`, which is offset below the title bar
  document.documentElement.append(controls);
}

function syncNativeTheme(bridge: ElectronBridge) {
  const root = document.documentElement;
  let lastTheme: 'dark' | 'light' | undefined;

  const update = () => {
    const theme = root.classList.contains('theme-dark') ? 'dark' : 'light';
    if (theme === lastTheme) return;

    lastTheme = theme;
    bridge.setTheme(theme);
  };

  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['class'] });
  update();
}
