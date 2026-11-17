export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** YouTube setVolume does nothing on iOS Safari. */
export const canCrossfadeYouTube = !isIOS
