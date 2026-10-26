import type { CustomizationSettings } from './settings';

export const ACCENT_PRESETS = [
  '#3390EC', '#8774E1', '#E05FA8', '#F2544D', '#F5A623', '#4CAF50', '#00B8A9', '#5E6AD2', '#222222',
];

export const MIN_GRADIENT_COLORS = 2;
export const MAX_GRADIENT_COLORS = 4;

const HEX_REGEX = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
const SHADE_AMOUNT = 0.15;

export function isHexColor(value: string) {
  return HEX_REGEX.test(value);
}

// Channels in the `r,g,b` form used by the `*-rgb` theme variables
export function toRgbChannels(hex: string) {
  return parseHex(hex).join(',');
}

export function shadeColor(hex: string, amount = SHADE_AMOUNT) {
  const channels = parseHex(hex).map((channel) => Math.round(channel * (1 - amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function buildGradientBackground(settings: CustomizationSettings) {
  const { gradientColors, gradientKind, gradientAngle } = settings;
  const stops = gradientColors.join(', ');

  if (gradientKind === 'radial') {
    return `radial-gradient(circle at 30% 25%, ${stops})`;
  }

  return `linear-gradient(${gradientAngle}deg, ${stops})`;
}

function parseHex(hex: string) {
  const [, r, g, b] = HEX_REGEX.exec(hex)!;
  return [r, g, b].map((channel) => parseInt(channel, 16));
}
