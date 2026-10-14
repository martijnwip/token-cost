import type { Lang } from './i18n'

export type Currency = 'usd' | 'eur'

// Regions that pay in euros, as the country part of a locale (`nl_NL`, `de-AT`).
const EUROZONE = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
])

export type LocaleHints = {
  // The `language` setting of Claude Code itself, e.g. "dutch" or "nl".
  claudeLanguage?: unknown
  // LC_ALL, LC_MESSAGES and LANG, in that order of precedence.
  systemLocales: (string | undefined)[]
}

const isDutch = (value: string) => /^(nl(?![a-z])|dutch|nederlands)/i.test(value.trim())

export function detectLang(hints: LocaleHints): Lang {
  if (typeof hints.claudeLanguage === 'string' && hints.claudeLanguage.trim() !== '') {
    return isDutch(hints.claudeLanguage) ? 'nl' : 'en'
  }
  const locale = hints.systemLocales.find(l => l !== undefined && l !== '' && l !== 'C' && l !== 'POSIX')
  return locale !== undefined && isDutch(locale) ? 'nl' : 'en'
}

export function detectCurrency(hints: LocaleHints): Currency {
  const locale = hints.systemLocales.find(l => l !== undefined && l !== '' && l !== 'C' && l !== 'POSIX')
  const region = locale?.match(/^[a-z]{2,3}[_-]([A-Z]{2})/i)?.[1]?.toUpperCase()
  return region !== undefined && EUROZONE.has(region) ? 'eur' : 'usd'
}

// An explicit setting wins; `auto` (or anything unrecognised) detects.
export function pickLang(option: unknown, hints: LocaleHints): Lang {
  return option === 'en' || option === 'nl' ? option : detectLang(hints)
}

export function pickCurrency(option: unknown, hints: LocaleHints): Currency {
  return option === 'usd' || option === 'eur' ? option : detectCurrency(hints)
}
