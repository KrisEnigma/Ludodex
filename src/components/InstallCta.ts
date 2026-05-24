/**
 * Shared install CTA component — a "Get the app" row with UA-detected
 * store buttons. Used on the Win screen and the Archive screen's
 * web locked-gate.
 *
 * Behavior:
 *  - On Android user agents: shows the Google Play button.
 *  - On iOS user agents: shows the App Store button.
 *  - Anywhere else (desktop, unknown): shows both.
 *
 * The component is purely presentational; callers pass the headline and
 * supporting copy via i18n keys so each surface can tailor its message
 * (Win screen says "love the puzzle? get the app", Archive says "more
 * puzzles in the app", etc.).
 */

import { t, type StringKey } from '../i18n';
import { track } from '../services/AnalyticsService';
import { STORE_URLS } from '../config/legalUrls';

export type InstallCtaOptions = {
  /** Root element class. Lets each surface (win-install-cta, archive-install-cta) carry its own styles. */
  className: string;
  /** i18n key for the headline (e.g. "Get the app", "Unlock the full archive"). */
  headlineKey: StringKey;
  /** Optional second-line subhead i18n key. */
  subheadKey?: StringKey;
};

export function buildInstallCta(options: InstallCtaOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = options.className;

  const label = document.createElement('span');
  label.className = `${options.className}-label`;
  label.textContent = t(options.headlineKey);
  row.append(label);

  if (options.subheadKey) {
    const sub = document.createElement('p');
    sub.className = `${options.className}-sub`;
    sub.textContent = t(options.subheadKey);
    row.append(sub);
  }

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isIos     = /iphone|ipad|ipod/.test(ua);

  const makeLink = (href: string, text: string, store: 'app_store' | 'play_store'): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = `${options.className}-link button-secondary`;
    a.textContent = text;
    a.addEventListener('click', () => {
      track('web_install_cta_tapped', { store });
    });
    return a;
  };

  const links = document.createElement('div');
  links.className = `${options.className}-links`;

  if (isAndroid) {
    links.append(makeLink(STORE_URLS.playStore, t('web_cta.play_store'), 'play_store'));
  } else if (isIos) {
    links.append(makeLink(STORE_URLS.appStore, t('web_cta.app_store'), 'app_store'));
  } else {
    links.append(
      makeLink(STORE_URLS.appStore,  t('web_cta.app_store'),  'app_store'),
      makeLink(STORE_URLS.playStore, t('web_cta.play_store'), 'play_store'),
    );
  }

  row.append(links);
  return row;
}
