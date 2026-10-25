import type { ElectronBridge } from './electronBridge';
import type { BackdropKind, CustomizationSettings } from './settings';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { CUSTOMIZATION_IDB_STORE } from '../util/browser/idb';
import { ELECTRON_BRIDGE, TITLE_BAR_HEIGHT } from './electronBridge';
import { resolveFont } from './presets';
import {
  DEFAULT_BUBBLE_RADIUS, DEFAULT_CUSTOMIZATION, getCustomization, subscribeToCustomization,
} from './settings';

import './customization.scss';

export const BACKDROP_VIDEO_KEY = 'backdrop-video';

const AURORA_BLOB_COUNT = 4;
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2';

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

    updateBackdropElement(backdrop);
    updateCustomCss(settings.customCss);
  });

  if (backdrop === 'video') {
    void updateBackdropVideo(settings);
  } else {
    releaseBackdropVideo();
  }

  ELECTRON_BRIDGE?.setBackgroundMaterial(backdrop === 'mica' || backdrop === 'acrylic' ? backdrop : 'none');
}

// Native materials need DWM support, so other platforms fall back to the animated aurora
function resolveBackdrop(backdrop: BackdropKind): BackdropKind {
  if ((backdrop === 'mica' || backdrop === 'acrylic') && !canUseBackgroundMaterial) {
    return 'aurora';
  }

  return backdrop;
}

function updateBackdropElement(backdrop: BackdropKind) {
  const shouldRender = backdrop === 'aurora' || backdrop === 'video';
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

  const kindClassName = `abj-backdrop-${backdrop}`;
  if (backdropElement.classList.contains(kindClassName)) return;

  backdropElement.className = `abj-backdrop ${kindClassName}`;
  backdropElement.replaceChildren();
  videoElement = undefined;

  if (backdrop === 'aurora') {
    for (let i = 0; i < AURORA_BLOB_COUNT; i++) {
      const blob = document.createElement('div');
      blob.className = 'abj-aurora-blob';
      backdropElement.append(blob);
    }
  } else {
    videoElement = document.createElement('video');
    videoElement.className = 'abj-backdrop-video';
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    backdropElement.append(videoElement);
  }

  const dim = document.createElement('div');
  dim.className = 'abj-backdrop-dim';
  backdropElement.append(dim);
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
