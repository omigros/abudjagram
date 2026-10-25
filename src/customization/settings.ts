export type BackdropKind = 'telegram' | 'aurora' | 'video' | 'mica' | 'acrylic';
export type AuroraPalette = 'aurora' | 'sunset' | 'ocean' | 'neon';
export type AnimationEasing = 'default' | 'smooth' | 'bouncy' | 'snappy';
export type MessageAppearance = 'default' | 'fade' | 'slide' | 'pop' | 'blur';

export type CustomizationSettings = {
  isGlassEnabled: boolean;
  glassBlur: number;
  glassOpacity: number;
  glassSaturation: number;
  hasGlassHighlight: boolean;
  isGlassBubbles?: boolean;
  backdrop: BackdropKind;
  auroraPalette: AuroraPalette;
  videoUrl?: string;
  hasVideoFile?: boolean;
  backdropDim: number;
  animationSpeed: number;
  animationEasing: AnimationEasing;
  messageAppearance: MessageAppearance;
  customCss: string;
};

export const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  isGlassEnabled: true,
  glassBlur: 24,
  glassOpacity: 55,
  glassSaturation: 160,
  hasGlassHighlight: true,
  isGlassBubbles: undefined,
  backdrop: 'aurora',
  auroraPalette: 'aurora',
  videoUrl: undefined,
  hasVideoFile: undefined,
  backdropDim: 0,
  animationSpeed: 1,
  animationEasing: 'default',
  messageAppearance: 'default',
  customCss: '',
};

const STORAGE_KEY = 'abj-customization';

type Listener = (settings: CustomizationSettings) => void;

let currentSettings = readSettings();
const listeners = new Set<Listener>();

export function getCustomization() {
  return currentSettings;
}

export function updateCustomization(update: Partial<CustomizationSettings>) {
  currentSettings = { ...currentSettings, ...update };
  writeSettings(currentSettings);
  listeners.forEach((listener) => listener(currentSettings));
}

export function resetCustomization() {
  updateCustomization(DEFAULT_CUSTOMIZATION);
}

export function subscribeToCustomization(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function exportCustomization() {
  return JSON.stringify({ ...currentSettings, hasVideoFile: undefined }, undefined, 2);
}

export function importCustomization(json: string) {
  const parsed = JSON.parse(json) as Partial<CustomizationSettings>;
  updateCustomization({ ...DEFAULT_CUSTOMIZATION, ...pickKnownFields(parsed), hasVideoFile: undefined });
}

function readSettings(): CustomizationSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CUSTOMIZATION, ...pickKnownFields(JSON.parse(saved)) } : DEFAULT_CUSTOMIZATION;
  } catch (err) {
    return DEFAULT_CUSTOMIZATION;
  }
}

function writeSettings(settings: CustomizationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    // Storage may be full or unavailable; settings still apply for the current session
  }
}

function pickKnownFields(value: Partial<CustomizationSettings>) {
  const result: Partial<CustomizationSettings> = {};
  (Object.keys(DEFAULT_CUSTOMIZATION) as (keyof CustomizationSettings)[]).forEach((key) => {
    if (key in value) (result as Record<string, unknown>)[key] = value[key];
  });
  return result;
}
