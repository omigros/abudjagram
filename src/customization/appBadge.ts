import type { ElectronBridge } from './electronBridge';

const BADGE_SIZE = 32;
const MAX_BADGE_COUNT = 99;
const BADGE_COLOR = '#E53935';
const MUTED_BADGE_COLOR = '#8E8E93';
const BADGE_FONT = '600 18px "Roboto", "Segoe UI", sans-serif';
const LONG_BADGE_FONT = '600 14px "Roboto", "Segoe UI", sans-serif';

let lastBadgeKey: string | undefined;

// Windows has no numeric taskbar badge, so the badge is drawn here and shown as the taskbar overlay icon
export function updateElectronBadge(bridge: ElectronBridge, count: number, isMuted?: boolean) {
  const badgeKey = `${count}:${Boolean(isMuted)}`;
  if (badgeKey === lastBadgeKey) return;
  lastBadgeKey = badgeKey;

  bridge.setBadge(count, count ? drawBadge(count, isMuted) : undefined);
}

function drawBadge(count: number, isMuted?: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = BADGE_SIZE;
  canvas.height = BADGE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const label = count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);

  ctx.fillStyle = isMuted ? MUTED_BADGE_COLOR : BADGE_COLOR;
  ctx.beginPath();
  ctx.arc(BADGE_SIZE / 2, BADGE_SIZE / 2, BADGE_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = label.length > 2 ? LONG_BADGE_FONT : BADGE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, BADGE_SIZE / 2, BADGE_SIZE / 2 + 1);

  return canvas.toDataURL('image/png');
}
