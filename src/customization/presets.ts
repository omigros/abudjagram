import type { RegularLangKey } from '../types/language';
import type { CustomizationSettings, FontPreset } from './settings';

import { DEFAULT_CUSTOMIZATION } from './settings';

export type ThemePreset = {
  id: string;
  nameKey: RegularLangKey;
  // Gradient of the gallery tile
  preview: string;
  settings: Partial<CustomizationSettings>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora',
    nameKey: 'AbjPresetAurora',
    preview: 'linear-gradient(135deg, #7F5AF0, #3DA9FC 50%, #2CB67D)',
    settings: DEFAULT_CUSTOMIZATION,
  },
  {
    id: 'sunset',
    nameKey: 'AbjPresetSunset',
    preview: 'linear-gradient(135deg, #FF6B6B, #FFB347 50%, #C06C84)',
    settings: {
      isGlassEnabled: true,
      glassBlur: 30,
      glassOpacity: 50,
      backdrop: 'aurora',
      auroraPalette: 'sunset',
      animationEasing: 'smooth',
      messageAppearance: 'fade',
      fontPreset: 'nunito',
      bubbleRadius: 20,
    },
  },
  {
    id: 'ocean',
    nameKey: 'AbjPresetOcean',
    preview: 'linear-gradient(135deg, #023E8A, #0077B6 45%, #48CAE4)',
    settings: {
      isGlassEnabled: true,
      glassBlur: 36,
      glassOpacity: 45,
      glassSaturation: 180,
      backdrop: 'aurora',
      auroraPalette: 'ocean',
      animationEasing: 'smooth',
      messageAppearance: 'slide',
      fontPreset: 'inter',
    },
  },
  {
    id: 'neon',
    nameKey: 'AbjPresetNeon',
    preview: 'linear-gradient(135deg, #FF00E5, #7B2FFF 50%, #00F0FF)',
    settings: {
      isGlassEnabled: true,
      glassBlur: 20,
      glassOpacity: 35,
      glassSaturation: 220,
      isGlassBubbles: true,
      backdrop: 'aurora',
      auroraPalette: 'neon',
      backdropDim: 20,
      animationEasing: 'bouncy',
      messageAppearance: 'pop',
      fontPreset: 'manrope',
    },
  },
  {
    id: 'terminal',
    nameKey: 'AbjPresetTerminal',
    preview: 'linear-gradient(135deg, #0D1117, #161B22 60%, #2EA043)',
    settings: {
      isGlassEnabled: false,
      backdrop: 'telegram',
      animationEasing: 'snappy',
      animationSpeed: 0.7,
      messageAppearance: 'fade',
      fontPreset: 'jetbrains',
      bubbleRadius: 4,
      hasBubbleTails: false,
    },
  },
  {
    id: 'classic',
    nameKey: 'AbjPresetClassic',
    preview: 'linear-gradient(135deg, #A8C78A, #D5E3B5 50%, #8DB36F)',
    settings: {
      isGlassEnabled: false,
      backdrop: 'telegram',
    },
  },
];

type FontDefinition = {
  family: string;
  // Google Fonts family query, loaded on demand
  googleFamily?: string;
};

const FONTS: Record<Exclude<FontPreset, 'default' | 'custom'>, FontDefinition> = {
  system: { family: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif' },
  inter: { family: '"Inter", sans-serif', googleFamily: 'Inter:wght@400;500;600;700' },
  manrope: { family: '"Manrope", sans-serif', googleFamily: 'Manrope:wght@400;500;600;700' },
  nunito: { family: '"Nunito", sans-serif', googleFamily: 'Nunito:wght@400;500;600;700' },
  jetbrains: { family: '"JetBrains Mono", monospace', googleFamily: 'JetBrains+Mono:wght@400;500;600;700' },
};

export function applyThemePreset(current: CustomizationSettings, preset: ThemePreset): CustomizationSettings {
  // Presets describe the look only; personal content such as custom CSS and the video survives
  return {
    ...DEFAULT_CUSTOMIZATION,
    ...preset.settings,
    customCss: current.customCss,
    videoUrl: current.videoUrl,
    hasVideoFile: current.hasVideoFile,
  };
}

export function resolveFont(settings: CustomizationSettings) {
  if (settings.fontPreset === 'default') return undefined;
  if (settings.fontPreset === 'custom') {
    const family = settings.customFontFamily?.trim();
    return family ? { family: `${JSON.stringify(family)}, sans-serif` } : undefined;
  }

  return FONTS[settings.fontPreset];
}
