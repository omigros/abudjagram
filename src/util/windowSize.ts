import type { IDimensions } from '../types';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { TITLE_BAR_HEIGHT } from '../customization/electronBridge';
import { IS_IOS } from './browser/windowEnvironment';
import { throttle } from './schedulers';

const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = 100;
const WINDOW_RESIZE_THROTTLE_MS = 250;

let initialHeight = getInnerHeight();
let currentWindowSize = updateSizes();

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_RESIZE_THROTTLE_MS, true);

const handleOrientationChange = throttle(() => {
  initialHeight = getInnerHeight();
  handleResize();
}, WINDOW_ORIENTATION_CHANGE_THROTTLE_MS, false);

window.addEventListener('orientationchange', handleOrientationChange);
if (IS_IOS) {
  window.visualViewport!.addEventListener('resize', handleResize);
} else {
  window.addEventListener('resize', handleResize);
}

export function updateSizes(): IDimensions {
  let height: number;
  if (IS_IOS) {
    height = window.visualViewport!.height + window.visualViewport!.pageTop;
  } else {
    height = getInnerHeight();
  }

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  return {
    width: window.innerWidth,
    height: getInnerHeight(),
  };
}

// The custom title bar of the desktop app takes the top of the window, outside of the page
function getInnerHeight() {
  return window.innerHeight - TITLE_BAR_HEIGHT;
}

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
