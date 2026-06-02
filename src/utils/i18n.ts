import type { LocalizedString, Locale } from '../types/puzzle';

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(str: LocalizedString | null, fallback = ''): string {
  if (!str) return fallback;
  return str[currentLocale] || str.en || fallback;
}
