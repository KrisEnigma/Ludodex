/** External URLs. Privacy and Terms pages are hosted on the marketing site;
 *  store links resolve once the apps are published. Update App Store ID after submission. */
export const LEGAL_URLS = {
  privacy: 'https://glitchsalad.app/privacy',
  terms: 'https://glitchsalad.app/terms'
} as const;

export const STORE_URLS = {
  // TODO: replace XXXXXXXXX with the real App Store ID once approved.
  appStore: 'https://apps.apple.com/app/idXXXXXXXXX',
  playStore: 'https://play.google.com/store/apps/details?id=app.glitchsalad.game'
} as const;