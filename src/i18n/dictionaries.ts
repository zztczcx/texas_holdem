import 'server-only';
import { cookies, headers } from 'next/headers';
import type en from './en.json';

export type Locale = 'en' | 'zh';
export type Dictionary = typeof en;

const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh'] as const;
const DEFAULT_LOCALE: Locale = 'en';
const COOKIE_NAME = 'NEXT_LOCALE';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./en.json').then((m) => m.default as Dictionary),
  zh: () => import('./zh.json').then((m) => m.default as Dictionary),
};

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Determine the active locale for the current request.
 * Priority: NEXT_LOCALE cookie > Accept-Language header > default (en).
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;

  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') ?? '';
  // zh, zh-CN, zh-TW, zh-Hans, etc. all map to 'zh'
  if (/\bzh\b/i.test(acceptLanguage)) return 'zh';

  return DEFAULT_LOCALE;
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
