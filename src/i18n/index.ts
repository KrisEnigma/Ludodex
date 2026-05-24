import { Preferences } from '@capacitor/preferences';
import { strings as enStrings } from './en';
import { strings as esStrings } from './es';
import { setLocale } from '../utils/i18n';

export type Language = 'en' | 'es';
export type StringKey = keyof typeof enStrings;

const STORAGE_KEY = 'ludodex.language';

const MAPS: Record<Language, Record<string, string>> = {
  en: enStrings,
  es: esStrings
};

let currentLang: Language = 'en';

function exposeDevOverride(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __setLang?: (lang: Language) => Promise<void> }).__setLang = setLang;
}

export async function initI18n(): Promise<void> {
  const stored = await Preferences.get({ key: STORAGE_KEY });
  if (stored.value === 'en' || stored.value === 'es') {
    currentLang = stored.value;
    setLocale(currentLang);
    exposeDevOverride();
    return;
  }

  const browserLang = (typeof navigator !== 'undefined' && navigator.language)
    ? navigator.language.toLowerCase()
    : 'en';
  currentLang = browserLang.startsWith('es') ? 'es' : 'en';
  setLocale(currentLang);

  exposeDevOverride();
}

export function getLang(): Language {
  return currentLang;
}

export async function setLang(lang: Language): Promise<void> {
  currentLang = lang;
  setLocale(currentLang);
  await Preferences.set({ key: STORAGE_KEY, value: lang });
}

export function t(key: StringKey, params?: Record<string, string | number>): string {
  const template = MAPS[currentLang][key] ?? MAPS.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in params ? String(params[name]) : `{${name}}`
  );
}

/** Plural helper. Looks up `${key}_one` when count is 1, `${key}_other` otherwise. */
export function tn(key: string, count: number, params?: Record<string, string | number>): string {
  const pluralSuffix = count === 1 ? '_one' : '_other';
  return t((key + pluralSuffix) as StringKey, { n: count, ...params });
}
