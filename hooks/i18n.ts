export type Lang = 'en' | 'nl'

export type Strings = {
  overview: string
  perDay: string
  perMonth: string
  perModel: string
  period: string
  day: string
  month: string
  model: string
  tokens: string
  responses: string
  apiValue: string
  today: string
  last7Days: string
  thisMonth: string
  total: string
  note: string
  notCounted: string
  noUsage: string
  usage: string
  unreadable: (n: number) => string
  status: (amount: string, limit: string) => string
  fiveHourLimit: (percent: string) => string
  commandDescription: string
  million: string
  billion: string
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    overview: 'Overview',
    perDay: 'Per day, last 14 days',
    perMonth: 'Per month',
    perModel: 'Per model, this month',
    period: 'Period',
    day: 'Day',
    month: 'Month',
    model: 'Model',
    tokens: 'Tokens',
    responses: 'Responses',
    apiValue: 'API value',
    today: 'Today',
    last7Days: 'Last 7 days',
    thisMonth: 'This month',
    total: 'Total',
    note: 'Estimate at API prices; on a subscription you pay your fixed monthly fee.',
    notCounted: 'Not counted (no known price)',
    noUsage: 'No usage found in ~/.claude/projects yet.',
    usage: 'Usage: /token-cost, /token-cost day or /token-cost month',
    unreadable: n => `${n} transcript(s) could not be read and are not counted.`,
    status: (amount, limit) => `≈ ${amount} API value${limit}`,
    fiveHourLimit: percent => ` · 5h limit ${percent}%`,
    commandDescription: 'What your Claude Code usage costs at API prices (token-cost [day|month])',
    million: 'M',
    billion: 'B',
  },
  nl: {
    overview: 'Overzicht',
    perDay: 'Per dag, laatste 14 dagen',
    perMonth: 'Per maand',
    perModel: 'Per model, deze maand',
    period: 'Periode',
    day: 'Dag',
    month: 'Maand',
    model: 'Model',
    tokens: 'Tokens',
    responses: 'Antwoorden',
    apiValue: 'API-waarde',
    today: 'Vandaag',
    last7Days: 'Laatste 7 dagen',
    thisMonth: 'Deze maand',
    total: 'Totaal',
    note: 'Schatting tegen API-prijzen; met een abonnement betaal je je vaste maandbedrag.',
    notCounted: 'Niet meegeteld (geen prijs bekend)',
    noUsage: 'Nog geen gebruik gevonden in ~/.claude/projects.',
    usage: 'Gebruik: /token-cost, /token-cost dag of /token-cost maand',
    unreadable: n => `${n} transcript(en) konden niet gelezen worden en tellen niet mee.`,
    status: (amount, limit) => `≈ ${amount} API-waarde${limit}`,
    fiveHourLimit: percent => ` · 5u-limiet ${percent}%`,
    commandDescription: 'Wat je Claude Code-gebruik tegen API-prijzen kost (token-cost [dag|maand])',
    million: ' mln',
    billion: ' mld',
  },
}

// Formats a number with the language's separators: 1,234.5 or 1.234,5.
export function formatNumber(n: number, decimals: number, lang: Lang): string {
  const [whole = '0', fraction] = n.toFixed(decimals).split('.')
  const [group, point] = lang === 'nl' ? ['.', ','] : [',', '.']
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return fraction === undefined ? grouped : `${grouped}${point}${fraction}`
}
